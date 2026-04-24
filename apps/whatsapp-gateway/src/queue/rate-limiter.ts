/**
 * Rate limiter simples — intervalo mínimo entre sends por instância.
 *
 * WhatsApp não publica limites oficiais; comunidade observa ~20 msg/min
 * pra novos contatos antes de flaggear. 3s entre sends = 20/min cap.
 * Reações e responses pra conversas já estabelecidas são menos sensíveis,
 * mas aplicamos o limite uniforme por simplicidade.
 */
export class PerInstanceRateLimiter {
  private readonly lastSendAt = new Map<string, number>();

  constructor(private readonly minIntervalMs: number) {}

  /** Espera até poder enviar. Atualiza o "last" atomically quando libera. */
  async acquire(instanceId: string): Promise<void> {
    const now = Date.now();
    const last = this.lastSendAt.get(instanceId) ?? 0;
    const delta = now - last;
    if (delta < this.minIntervalMs) {
      await sleep(this.minIntervalMs - delta);
    }
    this.lastSendAt.set(instanceId, Date.now());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
