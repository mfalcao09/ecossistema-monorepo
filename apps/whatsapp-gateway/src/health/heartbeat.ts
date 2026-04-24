/**
 * Heartbeat per-instance — a cada N segundos grava em whatsapp_health_checks
 * success=true se status=connected. Barato, detecta quando sai do ar sem
 * emitir connection.update (cenário raro mas acontece).
 */
import type { Logger } from "pino";
import type { InstanceManager } from "../instances/manager.js";
import { recordHealthCheck } from "../db/health.js";

export class HeartbeatLoop {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly instanceId: string,
    private readonly manager: InstanceManager,
    private readonly intervalSec: number,
    private readonly log: Logger,
  ) {}

  start(): void {
    if (this.timer) return;
    // Jitter inicial pra não alinhar todas as instâncias no mesmo tick
    const jitter = Math.floor(Math.random() * 5000);
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
    const status = this.manager.getStatus(this.instanceId);
    const success = status === "connected";
    await recordHealthCheck(this.instanceId, "heartbeat", success, null, { status });
    if (!success) {
      this.log.warn({ status }, "heartbeat unhealthy");
    }
  }
}
