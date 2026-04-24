/**
 * Outbound queue worker — 1 por instância. Drena `whatsapp_outbound_queue`
 * com backoff exponencial + rate limit + graceful shutdown.
 */
import type { Logger } from "pino";
import type { InstanceManager } from "../instances/manager.js";
import {
  claimPendingJobs,
  markJobFailed,
  markJobSent,
  type QueueRow,
} from "../db/queue.js";
import { PerInstanceRateLimiter } from "./rate-limiter.js";

export interface OutboundWorkerOpts {
  instanceId: string;
  manager: InstanceManager;
  rateLimiter: PerInstanceRateLimiter;
  logger: Logger;
  /** Intervalo de polling quando a fila está vazia. */
  pollIntervalMs?: number;
}

export class OutboundWorker {
  private readonly instanceId: string;
  private readonly manager: InstanceManager;
  private readonly rl: PerInstanceRateLimiter;
  private readonly log: Logger;
  private readonly pollIntervalMs: number;
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(opts: OutboundWorkerOpts) {
    this.instanceId = opts.instanceId;
    this.manager = opts.manager;
    this.rl = opts.rateLimiter;
    this.log = opts.logger.child({ worker: "outbound", instance_id: opts.instanceId });
    this.pollIntervalMs = opts.pollIntervalMs ?? 1000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.loopPromise) await this.loopPromise;
    this.loopPromise = null;
  }

  private async loop(): Promise<void> {
    this.log.info("outbound worker started");
    while (this.running) {
      try {
        // Só processa se a instância está connected. Senão poll depois.
        const status = this.manager.getStatus(this.instanceId);
        if (status !== "connected") {
          await sleep(this.pollIntervalMs * 3);
          continue;
        }
        const jobs = await claimPendingJobs(this.instanceId, 5);
        if (jobs.length === 0) {
          await sleep(this.pollIntervalMs);
          continue;
        }
        for (const job of jobs) {
          if (!this.running) break;
          await this.processJob(job);
        }
      } catch (err) {
        this.log.error({ err }, "loop iteration failed");
        await sleep(this.pollIntervalMs * 5);
      }
    }
    this.log.info("outbound worker stopped");
  }

  private async processJob(job: QueueRow): Promise<void> {
    const start = Date.now();
    try {
      await this.rl.acquire(this.instanceId);
      const result = await this.manager.sendDirect(this.instanceId, job.payload);
      await markJobSent(job.id, null); // TODO: cross-link whatsapp_messages via external_id
      this.log.debug(
        { job_id: job.id, external_id: result.externalId, latency_ms: Date.now() - start },
        "job sent",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markJobFailed(job, msg);
      this.log.warn({ job_id: job.id, attempts: job.attempts + 1, err: msg }, "job failed");
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
