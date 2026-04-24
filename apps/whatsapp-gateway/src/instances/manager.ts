/**
 * InstanceManager — orquestra N instâncias WhatsApp em paralelo.
 *
 * - Cria/inicia/para providers sob demanda
 * - Rebind em cold-start: ao subir, lê todas as instâncias com status != terminal e reconecta
 * - Registra listeners que persistem (via persist.ts)
 *
 * Hoje só Baileys. Futuro: factory que escolhe provider por instance.metadata.
 */
import type { Logger } from "pino";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InstanceStatus,
  SendMessageRequest,
  WhatsAppInstance,
  WhatsAppInstanceInsert,
} from "@ecossistema/whatsapp-types";
import { TERMINAL_STATUSES } from "@ecossistema/whatsapp-types";

import { childLogger } from "../logger.js";
import { createInstance, listInstances } from "../db/instances.js";
import { BaileysProvider } from "../providers/baileys/index.js";
import type { WhatsAppProvider, SendResult } from "../providers/types.js";
import {
  handleConnection,
  handleMessage,
  handleMessageStatus,
  handleQr,
} from "./persist.js";
import { OutboundWorker } from "../queue/worker.js";
import { PerInstanceRateLimiter } from "../queue/rate-limiter.js";
import { HeartbeatLoop } from "../health/heartbeat.js";
import { CanaryLoop } from "../health/canary.js";

export interface InstanceManagerOpts {
  supabase: SupabaseClient;
  logger: Logger;
  browserName: string;
  rateLimitMinIntervalMs: number;
  heartbeatIntervalSec: number;
  canaryIntervalSec: number;
}

interface InstanceRuntime {
  provider: WhatsAppProvider;
  outbound: OutboundWorker;
  heartbeat: HeartbeatLoop;
  canary: CanaryLoop;
}

export class InstanceManager {
  private readonly runtimes = new Map<string, InstanceRuntime>();
  private readonly supabase: SupabaseClient;
  private readonly log: Logger;
  private readonly browserName: string;
  private readonly rateLimiter: PerInstanceRateLimiter;
  private readonly heartbeatIntervalSec: number;
  private readonly canaryIntervalSec: number;

  constructor(opts: InstanceManagerOpts) {
    this.supabase = opts.supabase;
    this.log = opts.logger.child({ component: "InstanceManager" });
    this.browserName = opts.browserName;
    this.rateLimiter = new PerInstanceRateLimiter(opts.rateLimitMinIntervalMs);
    this.heartbeatIntervalSec = opts.heartbeatIntervalSec;
    this.canaryIntervalSec = opts.canaryIntervalSec;
  }

  /** Chamado no boot do gateway — reabre sockets que não estão em status terminal. */
  async bootstrap(): Promise<void> {
    const all = await listInstances();
    const reopenable = all.filter(
      (i) =>
        !TERMINAL_STATUSES.includes(
          i.status as (typeof TERMINAL_STATUSES)[number],
        ),
    );
    this.log.info(
      { total: all.length, reopening: reopenable.length },
      "bootstrap: reabrindo instâncias",
    );
    for (const inst of reopenable) {
      this.startProvider(inst).catch((err) =>
        this.log.error({ err, instance_id: inst.id }, "bootstrap start failed"),
      );
    }
  }

  /** Cria uma nova instância (DB + provider + socket). */
  async createAndStart(input: WhatsAppInstanceInsert): Promise<WhatsAppInstance> {
    const inst = await createInstance(input);
    await this.startProvider(inst);
    return inst;
  }

  /** Retorna provider em memória (se existe). */
  get(instanceId: string): WhatsAppProvider | null {
    return this.runtimes.get(instanceId)?.provider ?? null;
  }

  /** Status atual de uma instância em memória (null se não estiver rodando). */
  getStatus(instanceId: string): InstanceStatus | null {
    return this.runtimes.get(instanceId)?.provider.getStatus() ?? null;
  }

  /** Envia direto (sem fila). Usado só pelo queue worker. */
  async sendDirect(
    instanceId: string,
    req: SendMessageRequest,
  ): Promise<SendResult> {
    const rt = this.runtimes.get(instanceId);
    if (!rt) throw new Error(`instance ${instanceId} not running`);
    return rt.provider.send(req);
  }

  async stopInstance(instanceId: string): Promise<void> {
    const rt = this.runtimes.get(instanceId);
    if (!rt) return;
    await this.stopRuntime(rt);
    this.runtimes.delete(instanceId);
  }

  async logoutInstance(instanceId: string): Promise<void> {
    const rt = this.runtimes.get(instanceId);
    if (!rt) return;
    await this.stopRuntime(rt, { logout: true });
    this.runtimes.delete(instanceId);
  }

  async shutdown(): Promise<void> {
    this.log.info({ count: this.runtimes.size }, "shutting down runtimes");
    await Promise.allSettled(
      [...this.runtimes.values()].map((rt) => this.stopRuntime(rt)),
    );
    this.runtimes.clear();
  }

  private async stopRuntime(
    rt: InstanceRuntime,
    opts?: { logout?: boolean },
  ): Promise<void> {
    rt.heartbeat.stop();
    rt.canary.stop();
    await rt.outbound.stop();
    if (opts?.logout) {
      await rt.provider.logout();
    } else {
      await rt.provider.stop();
    }
  }

  // --- internals -----------------------------------------------------------

  private async startProvider(inst: WhatsAppInstance): Promise<void> {
    if (this.runtimes.has(inst.id)) return;

    const log = childLogger({ instance_id: inst.id, label: inst.label });
    const provider = new BaileysProvider({
      instanceId: inst.id,
      supabase: this.supabase,
      logger: this.log,
      browserName: this.browserName,
    });

    provider.onEvent(async (e) => {
      if (e.kind === "qr") {
        await handleQr(inst.id, e, log);
      } else if (e.kind === "connection") {
        await handleConnection(inst.id, e, log);
      } else if (e.kind === "message") {
        await handleMessage(inst.id, e, provider, log);
      } else if (e.kind === "message.status") {
        await handleMessageStatus(inst.id, e, log);
      }
    });

    const outbound = new OutboundWorker({
      instanceId: inst.id,
      manager: this,
      rateLimiter: this.rateLimiter,
      logger: log,
    });
    const heartbeat = new HeartbeatLoop(
      inst.id,
      this,
      this.heartbeatIntervalSec,
      log,
    );
    const canary = new CanaryLoop(
      inst.id,
      this,
      this.canaryIntervalSec,
      log,
    );

    this.runtimes.set(inst.id, { provider, outbound, heartbeat, canary });

    await provider.start();
    outbound.start();
    heartbeat.start();
    canary.start();
  }
}
