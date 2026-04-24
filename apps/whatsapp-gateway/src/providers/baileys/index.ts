/**
 * BaileysProvider — implementação de `WhatsAppProvider` usando Baileys.
 *
 * Isolado aqui pra restante do código não saber que Baileys existe.
 * Qualquer detalhe de protocolo/tipo Baileys vive dentro dessa pasta.
 */
import makeWASocket, {
  fetchLatestBaileysVersion,
  type BaileysEventMap,
  type ConnectionState,
  type MessageUpsertType,
  type WAMessage,
  type WAMessageUpdate,
  type WASocket,
} from "@whiskeysockets/baileys";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import type {
  InstanceStatus,
  SendMessageRequest,
} from "@ecossistema/whatsapp-types";
import { classifyJid, jidToPhoneNumber } from "@ecossistema/whatsapp-types";

import type {
  ProviderEvent,
  SendResult,
  WhatsAppProvider,
} from "../types.js";
import { useSupabaseAuthState } from "./auth-state.js";
import {
  extractPushName,
  translateConnectionStatus,
  translateMessage,
  translateMessageKind,
} from "./translators.js";

const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000, 60000];
const MAX_RECONNECT_ATTEMPTS = 10;

export interface BaileysProviderOpts {
  instanceId: string;
  supabase: SupabaseClient;
  logger: Logger;
  browserName: string;
}

export class BaileysProvider implements WhatsAppProvider {
  readonly instanceId: string;
  private sock: WASocket | null = null;
  private status: InstanceStatus = "pending";
  private listeners: Array<(e: ProviderEvent) => void | Promise<void>> = [];
  private reconnectAttempt = 0;
  private authStatePromise: ReturnType<typeof useSupabaseAuthState> | null = null;
  private stopped = false;
  private readonly supabase: SupabaseClient;
  private readonly log: Logger;
  private readonly browserName: string;

  constructor(opts: BaileysProviderOpts) {
    this.instanceId = opts.instanceId;
    this.supabase = opts.supabase;
    this.log = opts.logger.child({ instance_id: opts.instanceId });
    this.browserName = opts.browserName;
  }

  getStatus(): InstanceStatus {
    return this.status;
  }

  onEvent(cb: (e: ProviderEvent) => void | Promise<void>): void {
    this.listeners.push(cb);
  }

  private async emit(e: ProviderEvent): Promise<void> {
    for (const l of this.listeners) {
      try {
        await l(e);
      } catch (err) {
        this.log.error({ err, event: e.kind }, "listener threw");
      }
    }
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.openSocket();
  }

  private async openSocket(): Promise<void> {
    if (!this.authStatePromise) {
      this.authStatePromise = useSupabaseAuthState(this.supabase, this.instanceId);
    }
    const auth = await this.authStatePromise;

    // Snapshot pre-reconnect (defesa de estabilidade #9)
    if (this.reconnectAttempt > 0) {
      try {
        await auth.snapshot("pre_reconnect");
      } catch (err) {
        this.log.warn({ err }, "snapshot pre_reconnect failed (prosseguindo)");
      }
    }

    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 0] as [number, number, number],
      isLatest: false,
    }));

    this.log.info({ version }, "opening Baileys socket");

    const sock = makeWASocket({
      auth: auth.state,
      printQRInTerminal: false,
      logger: this.log.child({ component: "baileys" }) as unknown as Parameters<
        typeof makeWASocket
      >[0]["logger"],
      version,
      browser: [this.browserName, "Chrome", "1.0.0"],
      markOnlineOnConnect: false, // evita aparecer "online" no celular do Marcelo o tempo todo
    });

    this.sock = sock;

    sock.ev.on("creds.update", async () => {
      try {
        await auth.saveCreds();
      } catch (err) {
        this.log.error({ err }, "saveCreds failed");
      }
    });

    sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const expiresAt = new Date(Date.now() + 60_000);
        await this.emit({ kind: "qr", qrRaw: qr, expiresAt });
      }

      if (connection) {
        const { status, reason, loggedOut } = translateConnectionStatus(
          connection,
          lastDisconnect,
        );
        const prev = this.status;
        this.status = status;
        const phoneNumber =
          jidToPhoneNumber(sock.user?.id ?? "") ?? null;

        await this.emit({
          kind: "connection",
          status,
          phoneNumber,
          disconnectReason: reason,
        });
        this.log.info(
          { prev, status, reason, phone: phoneNumber },
          "connection update",
        );

        if (status === "connected") {
          this.reconnectAttempt = 0;
        }

        if (connection === "close" && !loggedOut && !this.stopped) {
          await this.scheduleReconnect();
        }
      }
    });

    sock.ev.on(
      "messages.upsert",
      async ({ messages, type }: BaileysEventMap["messages.upsert"]) => {
      if (type !== ("notify" as MessageUpsertType) && type !== ("append" as MessageUpsertType)) return;
      for (const msg of messages) {
        try {
          await this.handleIncomingMessage(msg);
        } catch (err) {
          this.log.error({ err, key: msg.key }, "handleIncomingMessage failed");
        }
      }
      },
    );

    sock.ev.on("messages.update", async (updates: WAMessageUpdate[]) => {
      for (const u of updates) {
        const newStatus = u.update?.status;
        if (!newStatus || !u.key.id) continue;
        // Baileys status int → nosso enum (1=error, 2=pending, 3=server_ack, 4=delivery_ack, 5=read)
        const mapped =
          newStatus === 5
            ? "read"
            : newStatus === 4
              ? "delivered"
              : newStatus === 3
                ? "sent"
                : newStatus === 1
                  ? "failed"
                  : null;
        if (!mapped) continue;
        await this.emit({
          kind: "message.status",
          externalId: u.key.id,
          status: mapped,
        });
      }
    });
  }

  private async handleIncomingMessage(msg: WAMessage): Promise<void> {
    const { isSystem } = translateMessageKind(msg);
    const translated = translateMessage(msg);
    await this.emit({
      kind: "message",
      message: translated,
      chatJid: msg.key.remoteJid ?? "",
      pushName: extractPushName(msg),
      isSystem,
    });
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.log.error({ attempts: this.reconnectAttempt }, "max reconnect attempts; giving up");
      this.status = "disconnected";
      return;
    }
    const delay =
      RECONNECT_BACKOFF_MS[Math.min(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.log.warn({ attempt: this.reconnectAttempt, delay }, "scheduling reconnect");
    setTimeout(() => {
      if (this.stopped) return;
      this.openSocket().catch((err) =>
        this.log.error({ err }, "openSocket in reconnect failed"),
      );
    }, delay);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    try {
      this.sock?.end(undefined);
    } catch (err) {
      this.log.warn({ err }, "stop: sock.end threw");
    }
    this.sock = null;
    this.status = "disconnected";
  }

  async logout(): Promise<void> {
    this.stopped = true;
    try {
      await this.sock?.logout();
    } catch (err) {
      this.log.warn({ err }, "logout threw (pode ser ok se já estava deslogado)");
    }
    this.sock = null;
    this.status = "logged_out";
  }

  async send(req: SendMessageRequest): Promise<SendResult> {
    const sock = this.sock;
    if (!sock || this.status !== "connected") {
      throw new Error(`provider não conectado (status=${this.status})`);
    }
    const jid = normalizeToJid(req.to);

    if (req.kind === "text") {
      const sent = await sock.sendMessage(
        jid,
        { text: req.body },
        req.reply_to_external_id
          ? {
              quoted: {
                key: { remoteJid: jid, fromMe: false, id: req.reply_to_external_id },
                message: { conversation: "" },
              },
            }
          : undefined,
      );
      return {
        externalId: sent?.key.id ?? "unknown",
        sentAt: new Date(Number(sent?.messageTimestamp ?? Date.now() / 1000) * 1000),
      };
    }

    if (req.kind === "reaction") {
      const sent = await sock.sendMessage(jid, {
        react: {
          text: req.emoji ?? "",
          key: { remoteJid: jid, fromMe: false, id: req.target_external_id },
        },
      });
      return {
        externalId: sent?.key.id ?? "unknown",
        sentAt: new Date(),
      };
    }

    // Media — upload via URL/data URI
    const media = req.media.startsWith("data:")
      ? Buffer.from(req.media.split(",")[1] ?? "", "base64")
      : { url: req.media };

    const content: Record<string, unknown> = {
      [req.kind]: media,
      ...(req.caption ? { caption: req.caption } : {}),
      ...(req.mimetype ? { mimetype: req.mimetype } : {}),
      ...(req.filename ? { fileName: req.filename } : {}),
    };
    const sent = await sock.sendMessage(jid, content as Parameters<WASocket["sendMessage"]>[1]);
    return {
      externalId: sent?.key.id ?? "unknown",
      sentAt: new Date(Number(sent?.messageTimestamp ?? Date.now() / 1000) * 1000),
    };
  }

  async resolveLid(lidJid: string): Promise<string | null> {
    if (classifyJid(lidJid) !== "lid") return jidToPhoneNumber(lidJid);
    const sock = this.sock;
    if (!sock) return null;
    try {
      const results = await sock.onWhatsApp(lidJid);
      const first = results?.[0];
      const resolved = first?.jid;
      return resolved ? jidToPhoneNumber(resolved) : null;
    } catch (err) {
      this.log.debug({ err, lidJid }, "resolveLid failed");
      return null;
    }
  }

  async requestPairingCode(phoneE164: string): Promise<string | null> {
    const sock = this.sock;
    if (!sock) {
      throw new Error("socket not started — call start() first");
    }
    // Sock precisa estar sem creds válidas (pré-pareamento)
    if (sock.authState.creds.registered) {
      this.log.warn({ phone: phoneE164 }, "requestPairingCode called on registered socket");
      return null;
    }
    // Baileys aceita número E.164 sem `+` (ex: "556781119511")
    const normalized = phoneE164.replace(/\D/g, "");
    try {
      const code = await sock.requestPairingCode(normalized);
      this.log.info({ phone: normalized, code_len: code.length }, "pairing code generated");
      return code;
    } catch (err) {
      this.log.error({ err, phone: normalized }, "requestPairingCode failed");
      throw err;
    }
  }
}

function normalizeToJid(to: string): string {
  if (to.includes("@")) return to;
  // Número puro → JID padrão
  return `${to.replace(/\D/g, "")}@s.whatsapp.net`;
}
