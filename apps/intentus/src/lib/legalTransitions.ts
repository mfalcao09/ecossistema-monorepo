import { dealRequestStatusLabels } from "@/lib/dealRequestSchema";

// Define allowed transitions per status for the legal team
export const legalStatusTransitions: Record<string, string[]> = {
  enviado_juridico: ["analise_documental", "cancelado"],
  analise_documental: ["aguardando_documentos", "parecer_em_elaboracao", "cancelado"],
  aguardando_documentos: ["analise_documental", "parecer_em_elaboracao", "cancelado"],
  parecer_em_elaboracao: ["parecer_negativo", "minuta_em_elaboracao"],
  minuta_em_elaboracao: ["em_validacao"],
  em_validacao: ["ajustes_pendentes", "aprovado_comercial"],
  ajustes_pendentes: ["em_validacao", "minuta_em_elaboracao", "cancelado"],
  aprovado_comercial: ["contrato_finalizado"],
  contrato_finalizado: ["em_assinatura"],
  em_assinatura: ["concluido", "ajustes_pendentes"],
  parecer_negativo: [],
  concluido: [],
  cancelado: [],
};

export function getNextStatuses(currentStatus: string): { value: string; label: string }[] {
  const allowed = legalStatusTransitions[currentStatus] || [];
  return allowed.map((s) => ({
    value: s,
    label: dealRequestStatusLabels[s] || s,
  }));
}
