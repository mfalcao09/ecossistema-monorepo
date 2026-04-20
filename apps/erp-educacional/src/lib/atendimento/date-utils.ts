/**
 * Helpers mínimos de data/hora para agendamentos.
 * Evita dependência de date-fns — funções puras e testáveis.
 * Timezone default: America/Campo_Grande (FIC).
 */

export const DEFAULT_TZ = "America/Campo_Grande";

/**
 * Retorna o primeiro dia do mês (00:00 UTC) de um mês/ano.
 */
export function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0));
}

/**
 * Quantos dias tem um mês.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Retorna array de Dates para as 42 células (6 semanas × 7 dias)
 * de uma view de calendário mensal começando no domingo.
 */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = startOfMonth(year, month);
  const startDay = first.getUTCDay(); // 0 = domingo
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setUTCDate(1 - startDay + i);
    grid.push(d);
  }
  return grid;
}

/**
 * Formata data em "YYYY-MM-DD".
 */
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Formata "HH:mm" a partir de ISO.
 */
export function toTimeHHMM(iso: string, tz = DEFAULT_TZ): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
  } catch {
    return "";
  }
}

/**
 * Dia do mês (1-31) formatado no fuso TZ.
 */
export function toDayOfMonth(d: Date, tz = DEFAULT_TZ): number {
  const s = d.toLocaleString("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return Number(s.slice(-2));
}

/**
 * Avança um mês.
 */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const WEEKDAYS_PT_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
