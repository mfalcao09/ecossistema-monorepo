// ── Types ──────────────────────────────────────────────
export type DealRequestStatus =
  | "rascunho" | "enviado_juridico" | "analise_documental" | "aguardando_documentos"
  | "parecer_em_elaboracao" | "parecer_negativo" | "minuta_em_elaboracao" | "em_validacao"
  | "ajustes_pendentes" | "aprovado_comercial" | "contrato_finalizado" | "em_assinatura"
  | "concluido" | "cancelado";

export type DealType = "venda" | "locacao" | "administracao";

export interface DealRequestParty {
  id: string;
  person_id: string;
  role: string;
  people?: { id: string; name: string };
}

export interface DealRequest {
  id: string;
  property_id: string | null;
  deal_type: DealType;
  status: DealRequestStatus;
  proposed_value: number | null;
  proposed_monthly_value: number | null;
  proposed_start_date: string | null;
  proposed_duration_months: number | null;
  payment_terms: string | null;
  guarantee_type: string | null;
  commission_percentage: number | null;
  commercial_notes: string | null;
  captador_person_id: string | null;
  vendedor_person_id: string | null;
  earnest_money: number | null;
  earnest_money_date: string | null;
  created_by: string | null;
  submitted_at: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
  lost_reason: string | null;
  total_value: number | null;
  assigned_to: string | null;
  // Joined data (from useDealRequests select)
  properties?: { id: string; title: string };
  deal_request_parties?: DealRequestParty[];
}

export const dealRequestStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_juridico: "Enviado ao Jurídico",
  analise_documental: "Análise Documental",
  aguardando_documentos: "Aguardando Documentos",
  parecer_em_elaboracao: "Parecer em Elaboração",
  parecer_negativo: "Parecer Negativo",
  minuta_em_elaboracao: "Minuta em Elaboração",
  em_validacao: "Em Validação",
  ajustes_pendentes: "Ajustes Pendentes",
  aprovado_comercial: "Aprovação Comercial",
  contrato_finalizado: "Contrato Finalizado",
  em_assinatura: "Em Assinatura",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const dealRequestStatusColors: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  enviado_juridico: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  analise_documental: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  aguardando_documentos: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  parecer_em_elaboracao: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  parecer_negativo: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  minuta_em_elaboracao: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  em_validacao: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  ajustes_pendentes: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  aprovado_comercial: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  contrato_finalizado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  em_assinatura: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  concluido: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export const guaranteeTypeOptions = [
  { value: "fiador", label: "Fiador" },
  { value: "caucao_dinheiro", label: "Caução em Dinheiro" },
  { value: "caucao_imovel", label: "Caução de Imóvel" },
  { value: "seguro_fianca", label: "Seguro Fiança" },
  { value: "titulo_capitalizacao", label: "Título de Capitalização" },
  { value: "nenhuma", label: "Nenhuma" },
];

export const paymentTermsOptions = [
  { value: "a_vista", label: "À Vista" },
  { value: "parcelado", label: "Parcelado" },
  { value: "mensal", label: "Mensal (Locação)" },
  { value: "entrada_parcelas", label: "Entrada + Parcelas" },
];
