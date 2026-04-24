/**
 * Canary per-instance — a cada N segundos, envia uma msg pra si mesmo e
 * mede o tempo que o provider leva pra aceitar. Se falhar 3x, alerta.
 *
 * Importante: NÃO mede ACK delivered — isso exigiria tracking assíncrono
 * dos `messages.update` events. Versão 1 só valida que o send path está vivo.
 * Futuro: esperar ACK status=delivered em até 10s e medir latência real.
 */
import type { Logger } from "pino";
import type { InstanceManager } from "../instances/manager.js";
import { getInstance } from "../db/instances.js";
import { recordHealthCheck, recentFailures } from "../db/health.js";

export class CanaryLoop {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly instanceId: string,
    private readonly manager: InstanceManager,
    private readonly intervalSec: number,
    private readonly log: Logger,
  ) {}

  start(): void {
    if (this.timer || this.intervalSec <= 0) return;
    // Jitter maior — canary é caro (envia msg)
    const jitter = Math.floor(Math.random() * 60_000);
    setTimeout(() => {
      this.tick();
      this.timer = setInterval(() => this.tick(), this.intervalSec * 1000);
    }, jitter);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const start = Date.now();
    try {
      if (this.manager.getStatus(this.instanceId) !== "connected") {
        await recordHealthCheck(this.instanceId, "canary", false, null, {
          reason: "not_connected",
        });
        return;
      }
      const inst = await getInstance(this.instanceId);
      if (!inst?.phone_number) {
        // Sem phone ainda = recém-pareada. Pula.
        return;
      }
      // Enviar msg de texto pra si mesmo.
      await this.manager.sendDirect(this.instanceId, {
        kind: "text",
        to: inst.phone_number,
        body: `🤖 canary ${new Date().toISOString()}`,
      });
      const latency = Date.now() - start;
      await recordHealthCheck(this.instanceId, "canary", true, latency);
      this.log.debug({ latency_ms: latency }, "canary ok");

      // Alert if 3+ failures in last 5 canary runs
      const fails = await recentFailures(this.instanceId, "canary", 5);
      if (fails >= 3) {
        this.log.error(
          { fails },
          "canary: 3+ falhas em 5 runs — instância pode estar degradada",
        );
      }
    } catch (err) {
      await recordHealthCheck(this.instanceId, "canary", false, null, {
        error: err instanceof Error ? err.message : String(err),
      });
      this.log.warn({ err }, "canary failed");
    }
  }
}
