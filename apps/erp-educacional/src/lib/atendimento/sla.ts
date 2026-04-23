/**
 * Lógica de SLA de deals no Kanban.
 * Verde   — dentro do prazo
 * Amarelo — passou de `sla_warning_days` sem mover de etapa
 * Vermelho — passou de `sla_danger_days` sem mover de etapa
 */

export type SlaStatus = "green" | "yellow" | "red" | "none";

export interface SlaInput {
  entered_stage_at: string | Date;       // deals.entered_stage_at
  sla_warning_days: number | null | undefined;
  sla_danger_days:  number | null | undefined;
  now?: Date;                            // injetável para testes
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeSlaStatus(input: SlaInput): SlaStatus {
  const now = input.now ?? new Date();
  const entered =
    input.entered_stage_at instanceof Date
      ? input.entered_stage_at
      : new Date(input.entered_stage_at);

  if (isNaN(entered.getTime())) return "none";

  const diffDays = (now.getTime() - entered.getTime()) / MS_PER_DAY;

  const danger  = input.sla_danger_days  ?? null;
  const warning = input.sla_warning_days ?? null;

  if (danger != null  && diffDays >= danger)  return "red";
  if (warning != null && diffDays >= warning) return "yellow";
  if (warning == null && danger == null)      return "none";
  return "green";
}

export function slaBadgeColor(status: SlaStatus): string {
  switch (status) {
    case "red":    return "#F04438";
    case "yellow": return "#F79009";
    case "green":  return "#12B76A";
    default:       return "#98A2B3";
  }
}
