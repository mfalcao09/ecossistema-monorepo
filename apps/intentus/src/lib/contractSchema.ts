import { z } from "zod";

export const contractSchema = z.object({
  property_id: z.string().optional().or(z.literal("")),
  contract_type: z.enum(["venda", "locacao", "administracao", "distrato"]),
  status: z.enum([
    "negociacao",
    "rascunho",
    "em_revisao",
    "em_aprovacao",
    "aguardando_assinatura",
    "vigencia_pendente",
    "ativo",
    "em_alteracao",
    "renovado",
    "expirado",
    "encerrado",
    "cancelado",
    "arquivado",
  ]),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  total_value: z.coerce.number().min(0).optional().or(z.literal(0)),
  monthly_value: z.coerce.number().min(0).optional().or(z.literal(0)),
  commission_percentage: z.coerce.number().min(0).max(100).optional().or(z.literal(0)),
  commission_value: z.coerce.number().min(0).optional().or(z.literal(0)),
  admin_fee_percentage: z.coerce.number().min(0).max(100).optional().or(z.literal(0)),
  adjustment_index: z.string().trim().max(50).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  guarantee_type: z.string().optional().or(z.literal("")),
  guarantee_value: z.coerce.number().min(0).optional().or(z.literal(0)),
  guarantee_details: z.string().trim().max(500).optional().or(z.literal("")),
  guarantee_policy_number: z.string().trim().max(100).optional().or(z.literal("")),
  // Assinatura
  signed_at: z.string().optional().or(z.literal("")),
  signing_platform: z.string().trim().max(100).optional().or(z.literal("")),
  // Financeiro
  down_payment: z.coerce.number().min(0).optional().or(z.literal(0)),
  remaining_balance: z.coerce.number().min(0).optional().or(z.literal(0)),
  payment_method: z.string().trim().max(200).optional().or(z.literal("")),
  bank_name: z.string().trim().max(100).optional().or(z.literal("")),
  bank_agency: z.string().trim().max(20).optional().or(z.literal("")),
  bank_account: z.string().trim().max(30).optional().or(z.literal("")),
  bank_holder: z.string().trim().max(200).optional().or(z.literal("")),
  has_intermediation: z.boolean().optional(),
  // Prazos
  deed_deadline_days: z.coerce.number().int().min(0).optional(),
  possession_deadline: z.string().trim().max(200).optional().or(z.literal("")),
  suspensive_conditions: z.array(z.string()).optional(),
  charges_transfer_date: z.string().optional().or(z.literal("")),
  // Penalidades
  late_interest_rate: z.coerce.number().min(0).max(100).optional().or(z.literal(0)),
  late_penalty_rate: z.coerce.number().min(0).max(100).optional().or(z.literal(0)),
  termination_penalty_rate: z.coerce.number().min(0).max(100).optional().or(z.literal(0)),
  // Campos operacionais
  contract_number: z.string().trim().max(50).optional().or(z.literal("")),
  notice_period_days: z.coerce.number().int().min(0).optional(),
  grace_period_months: z.coerce.number().int().min(0).optional(),
  grace_discount_value: z.coerce.number().min(0).optional(),
  grace_reason: z.string().trim().max(500).optional().or(z.literal("")),
  allows_sublease: z.boolean().optional(),
  exclusivity_clause: z.string().trim().max(500).optional().or(z.literal("")),
  tenant_pays_iptu: z.boolean().optional(),
  tenant_pays_condo: z.boolean().optional(),
  tenant_pays_insurance: z.boolean().optional(),
  promotion_fund_pct: z.coerce.number().min(0).max(100).optional(),
  penalty_type: z.string().trim().max(50).optional().or(z.literal("")),
  penalty_months: z.coerce.number().int().min(0).optional(),
  payment_due_day: z.coerce.number().int().min(1).max(31).optional(),
});

export type ContractFormValues = z.infer<typeof contractSchema>;

export const contractTypeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
  distrato: "Distrato",
};

export const contractStatusLabels: Record<string, string> = {
  negociacao: "Negociação",
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  em_aprovacao: "Em Aprovação",
  aguardando_assinatura: "Aguardando Assinatura",
  vigencia_pendente: "Vigência Pendente",
  ativo: "Ativo",
  em_alteracao: "Em Alteração",
  renovado: "Renovado",
  expirado: "Expirado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  arquivado: "Arquivado",
};

export const contractStatusColors: Record<string, string> = {
  negociacao: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  rascunho: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  em_revisao: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  em_aprovacao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  aguardando_assinatura: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  vigencia_pendente: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  em_alteracao: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  renovado: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  expirado: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  encerrado: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  arquivado: "bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400",
};

export const contractTypeColors: Record<string, string> = {
  venda: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  locacao: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  administracao: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  distrato: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
};

export const installmentStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export const installmentStatusColors: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  pago: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  atrasado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelado: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
};

export const partyRoleLabels: Record<string, string> = {
  locatario: "Locatário",
  comprador: "Comprador",
  proprietario: "Proprietário",
  fiador: "Fiador",
  administrador: "Administrador",
  testemunha: "Testemunha",
  locador: "Locador",
  vendedor: "Vendedor",
  intermediador: "Intermediador",
};

export const adjustmentIndexOptions = [
  "IGP-M",
  "IPCA",
  "INPC",
  "IGP-DI",
  "Outro",
];

export const penaltyTypeLabels: Record<string, string> = {
  proporcional: "Proporcional ao prazo restante",
  fixa: "Multa fixa",
  alugueis: "Nº de aluguéis",
};

export const defaultContractValues: ContractFormValues = {
  property_id: "",
  contract_type: "locacao",
  status: "rascunho",
  start_date: "",
  end_date: "",
  total_value: 0,
  monthly_value: 0,
  commission_percentage: 0,
  commission_value: 0,
  admin_fee_percentage: 10,
  adjustment_index: "",
  notes: "",
  guarantee_type: "",
  guarantee_value: 0,
  guarantee_details: "",
  guarantee_policy_number: "",
  signed_at: "",
  signing_platform: "",
  down_payment: 0,
  remaining_balance: 0,
  payment_method: "",
  bank_name: "",
  bank_agency: "",
  bank_account: "",
  bank_holder: "",
  has_intermediation: false,
  deed_deadline_days: undefined,
  possession_deadline: "",
  suspensive_conditions: [],
  charges_transfer_date: "",
  late_interest_rate: 0,
  late_penalty_rate: 0,
  termination_penalty_rate: 0,
  contract_number: "",
  notice_period_days: undefined,
  grace_period_months: undefined,
  grace_discount_value: undefined,
  grace_reason: "",
  allows_sublease: false,
  exclusivity_clause: "",
  tenant_pays_iptu: true,
  tenant_pays_condo: true,
  tenant_pays_insurance: false,
  promotion_fund_pct: undefined,
  penalty_type: "",
  penalty_months: undefined,
  payment_due_day: undefined,
};
