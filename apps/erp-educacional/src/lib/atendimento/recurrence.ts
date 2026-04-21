/**
 * Atendimento — Regras de recorrência de mensagens agendadas.
 *
 * Extraído de `api/cron/dispatch-scheduled-messages/route.ts` porque Next.js 15
 * App Router só aceita exports canônicos (HTTP methods/config) em `route.ts`.
 * Testes unitários importam direto deste módulo.
 */

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval?: number;
  until?: string;
}

/**
 * Calcula o próximo disparo de uma regra de recorrência.
 * Retorna null se já passou do `until`.
 */
export function computeNextOccurrence(
  current: Date,
  rule: RecurrenceRule,
): Date | null {
  const next = new Date(current);
  const interval = rule.interval ?? 1;
  if (rule.freq === "DAILY") {
    next.setUTCDate(next.getUTCDate() + interval);
  } else if (rule.freq === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7 * interval);
  } else if (rule.freq === "MONTHLY") {
    next.setUTCMonth(next.getUTCMonth() + interval);
  }
  if (rule.until && next > new Date(rule.until)) return null;
  return next;
}
