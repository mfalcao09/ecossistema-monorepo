/**
 * Tradutores de eventos do provider → persistência.
 *
 * Provider só emite eventos agnósticos. Aqui a gente traduz em writes
 * nas tabelas WhatsApp. Isolado aqui pra testar sem Baileys real.
 */
import QRCode from "qrcode";
import type { Logger } from "pino";
import type { WhatsAppMessage } from "@ecossistema/whatsapp-types";
import {
  classifyJid,
  jidToPhoneNumber,
} from "@ecossistema/whatsapp-types";

import type {
  ProviderConnectionEvent,
  ProviderMessageEvent,
  ProviderMessageStatusEvent,
  ProviderQrEvent,
  WhatsAppProvider,
} from "../providers/types.js";
import { upsertChatForMessage } from "../db/chats.js";
import { upsertContact } from "../db/contacts.js";
import { insertMessage, updateMessageStatus } from "../db/messages.js";
import {
  setInstanceQr,
  setInstanceStatus,
} from "../db/instances.js";

export async function handleQr(
  instanceId: string,
  e: ProviderQrEvent,
  log: Logger,
): Promise<void> {
  try {
    const dataUrl = await QRCode.toDataURL(e.qrRaw, { margin: 1, width: 300 });
    await setInstanceQr(instanceId, dataUrl, e.expiresAt.toISOString());
    log.info({ expires: e.expiresAt.toISOString() }, "QR updated");
  } catch (err) {
    log.error({ err }, "handleQr failed");
  }
}

export async function handleConnection(
  instanceId: string,
  e: ProviderConnectionEvent,
  log: Logger,
): Promise<void> {
  try {
    await setInstanceStatus(instanceId, e.status, {
      phone_number: e.phoneNumber ?? undefined,
      disconnect_reason: e.disconnectReason ?? undefined,
      last_seen_at: new Date().toISOString(),
    });
    // Se conectou, limpa QR
    if (e.status === "connected") {
      await setInstanceQr(instanceId, null, null);
    }
    log.info({ status: e.status }, "connection persisted");
  } catch (err) {
    log.error({ err, status: e.status }, "handleConnection failed");
  }
}

export async function handleMessage(
  instanceId: string,
  e: ProviderMessageEvent,
  provider: WhatsAppProvider,
  log: Logger,
): Promise<void> {
  // Filtro history-sync / system messages (defesa contra poluição)
  if (e.isSystem) {
    log.debug({ external_id: e.message.external_id }, "skip system message");
    return;
  }

  try {
    // 1. Upsert contact — tenta resolver LID pra phone
    const jid = e.chatJid;
    const contactKind = classifyJid(jid);
    let phone = jidToPhoneNumber(jid);
    if (contactKind === "lid" && !phone) {
      phone = await provider.resolveLid(jid).catch(() => null);
    }

    const contact = await upsertContact(instanceId, jid, {
      phone_number: phone ?? undefined,
      push_name: e.pushName ?? undefined,
    });

    // 2. Upsert chat
    const preview = e.message.body ?? `[${e.message.kind}]`;
    const chat = await upsertChatForMessage(
      instanceId,
      jid,
      preview,
      e.message.sent_at,
      contact.id,
      contact.name ?? contact.push_name ?? null,
    );

    // 3. Insert message
    const row: Omit<WhatsAppMessage, "id" | "created_at"> = {
      ...e.message,
      instance_id: instanceId,
      chat_id: chat.id,
    };
    await insertMessage(row);
  } catch (err) {
    log.error(
      { err, external_id: e.message.external_id, chat_jid: e.chatJid },
      "handleMessage failed",
    );
  }
}

export async function handleMessageStatus(
  instanceId: string,
  e: ProviderMessageStatusEvent,
  log: Logger,
): Promise<void> {
  try {
    await updateMessageStatus(instanceId, e.externalId, e.status);
  } catch (err) {
    log.error({ err, external_id: e.externalId }, "handleMessageStatus failed");
  }
}
