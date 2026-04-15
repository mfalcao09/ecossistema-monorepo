// CLM Settings — types and defaults for multi-tenant CLM configuration
// Persisted in tenants.settings.clm_config (JSONB)

export interface ClmApprovalStep {
  step_name: string;
  role: string;
}

export interface ClmChecklistItem {
  key: string;
  label: string;
  required: boolean;
}

export interface ClmExtraField {
  key: string;
  label: string;
}

export interface ClmConfig {
  // ── Campos do formulário ──
  contract_hidden_fields: string[];
  contract_extra_fields: ClmExtraField[];

  // ── Workflow de aprovação ──
  approval_chain_enabled: boolean;
  default_approval_steps: ClmApprovalStep[];
  auto_create_approval_on_new_contract: boolean;
  require_all_approvals_for_activation: boolean;

  // ── Renovação ──
  default_renewal_term_months: number;
  default_adjustment_index: string;
  auto_create_addendum: boolean;
  renewal_checklist_items: ClmChecklistItem[];
  renewal_alert_days_before: number;

  // ── Renegociação / Cláusulas ──
  clause_categories_enabled: string[];
  require_clause_approval: boolean;
  allow_inline_comments: boolean;
  mandatory_clauses_by_type: Record<string, string[]>;

  // ── Documentos ──
  document_types_enabled: string[];
  custom_document_types: ClmExtraField[];
  max_file_size_mb: number;
  require_approval_before_signing: boolean;
  auto_version_on_upload: boolean;

  // ── Obrigações e Alertas ──
  obligation_types_enabled: string[];
  default_alert_days: number[];
  default_responsible_party: string;
  auto_generate_next_recurrence: boolean;

  // ── Auditoria ──
  audit_actions_tracked: string[];
  audit_retention_days: number;

  // ── Itens customizados (extensíveis pelo usuário) ──
  custom_clause_categories: ClmExtraField[];
  custom_approval_roles: ClmExtraField[];
  custom_obligation_types: ClmExtraField[];
  custom_responsible_parties: ClmExtraField[];
  custom_audit_actions: ClmExtraField[];
  custom_adjustment_indices: ClmExtraField[];
}

export const CLM_ADJUSTMENT_INDICES = [
  { value: "igpm", label: "IGP-M" },
  { value: "ipca", label: "IPCA" },
  { value: "inpc", label: "INPC" },
  { value: "igpdi", label: "IGP-DI" },
  { value: "manual", label: "Manual" },
];

export const CLM_APPROVAL_ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "financeiro", label: "Financeiro" },
  { value: "juridico", label: "Jurídico" },
  { value: "diretor", label: "Diretor" },
];

export const CLM_CLAUSE_CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "garantia", label: "Garantia" },
  { value: "multa", label: "Multa" },
  { value: "rescisao", label: "Rescisão" },
  { value: "reajuste", label: "Reajuste" },
  { value: "entrega", label: "Entrega" },
  { value: "sigilo", label: "Sigilo" },
];

export const CLM_DOCUMENT_TYPES = [
  { value: "minuta", label: "Minuta" },
  { value: "aditivo", label: "Aditivo" },
  { value: "termo_entrega", label: "Termo de Entrega" },
  { value: "laudo", label: "Laudo" },
  { value: "procuracao", label: "Procuração" },
  { value: "comprovante", label: "Comprovante" },
  { value: "outro", label: "Outro" },
];

export const CLM_OBLIGATION_TYPES = [
  { value: "financeira", label: "Financeira" },
  { value: "juridica", label: "Jurídica" },
  { value: "operacional", label: "Operacional" },
  { value: "documental", label: "Documental" },
];

export const CLM_RESPONSIBLE_PARTIES = [
  { value: "locatario", label: "Locatário" },
  { value: "proprietario", label: "Proprietário" },
  { value: "administradora", label: "Administradora" },
];

export const CLM_AUDIT_ACTIONS = [
  { value: "criado", label: "Criado" },
  { value: "editado", label: "Editado" },
  { value: "status_alterado", label: "Status Alterado" },
  { value: "documento_enviado", label: "Documento Enviado" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "aprovacao_rejeitada", label: "Aprovação Rejeitada" },
  { value: "assinatura", label: "Assinatura" },
  { value: "obrigacao_criada", label: "Obrigação Criada" },
  { value: "obrigacao_cumprida", label: "Obrigação Cumprida" },
];

export const DEFAULT_CLM_CONFIG: ClmConfig = {
  // Campos
  contract_hidden_fields: [],
  contract_extra_fields: [],

  // Aprovação
  approval_chain_enabled: true,
  default_approval_steps: [
    { step_name: "Análise Jurídica", role: "juridico" },
    { step_name: "Aprovação Gerência", role: "gerente" },
    { step_name: "Aprovação Final", role: "admin" },
  ],
  auto_create_approval_on_new_contract: true,
  require_all_approvals_for_activation: true,

  // Renovação
  default_renewal_term_months: 12,
  default_adjustment_index: "igpm",
  auto_create_addendum: false,
  renewal_checklist_items: [
    { key: "vistoria", label: "Vistoria realizada", required: true },
    { key: "garantias", label: "Garantias atualizadas", required: true },
    { key: "docs", label: "Documentação em dia", required: false },
  ],
  renewal_alert_days_before: 60,

  // Cláusulas
  clause_categories_enabled: ["geral", "garantia", "multa", "rescisao", "reajuste", "entrega", "sigilo"],
  require_clause_approval: false,
  allow_inline_comments: true,
  mandatory_clauses_by_type: {},

  // Documentos
  document_types_enabled: ["minuta", "aditivo", "termo_entrega", "laudo", "procuracao", "comprovante", "outro"],
  custom_document_types: [],
  max_file_size_mb: 25,
  require_approval_before_signing: true,
  auto_version_on_upload: true,

  // Obrigações
  obligation_types_enabled: ["financeira", "juridica", "operacional", "documental"],
  default_alert_days: [30, 15, 7],
  default_responsible_party: "administradora",
  auto_generate_next_recurrence: true,

  // Auditoria
  audit_actions_tracked: [
    "criado", "editado", "status_alterado", "documento_enviado",
    "aprovacao", "aprovacao_rejeitada", "assinatura",
    "obrigacao_criada", "obrigacao_cumprida",
  ],
  audit_retention_days: 365,

  // Itens customizados
  custom_clause_categories: [],
  custom_approval_roles: [],
  custom_obligation_types: [],
  custom_responsible_parties: [],
  custom_audit_actions: [],
  custom_adjustment_indices: [],
};

export function mergeClmConfig(saved: Partial<ClmConfig> | undefined | null): ClmConfig {
  if (!saved) return { ...DEFAULT_CLM_CONFIG };
  return {
    contract_hidden_fields: saved.contract_hidden_fields ?? DEFAULT_CLM_CONFIG.contract_hidden_fields,
    contract_extra_fields: saved.contract_extra_fields ?? DEFAULT_CLM_CONFIG.contract_extra_fields,
    approval_chain_enabled: saved.approval_chain_enabled ?? DEFAULT_CLM_CONFIG.approval_chain_enabled,
    default_approval_steps: saved.default_approval_steps ?? DEFAULT_CLM_CONFIG.default_approval_steps,
    auto_create_approval_on_new_contract: saved.auto_create_approval_on_new_contract ?? DEFAULT_CLM_CONFIG.auto_create_approval_on_new_contract,
    require_all_approvals_for_activation: saved.require_all_approvals_for_activation ?? DEFAULT_CLM_CONFIG.require_all_approvals_for_activation,
    default_renewal_term_months: saved.default_renewal_term_months ?? DEFAULT_CLM_CONFIG.default_renewal_term_months,
    default_adjustment_index: saved.default_adjustment_index ?? DEFAULT_CLM_CONFIG.default_adjustment_index,
    auto_create_addendum: saved.auto_create_addendum ?? DEFAULT_CLM_CONFIG.auto_create_addendum,
    renewal_checklist_items: saved.renewal_checklist_items ?? DEFAULT_CLM_CONFIG.renewal_checklist_items,
    renewal_alert_days_before: saved.renewal_alert_days_before ?? DEFAULT_CLM_CONFIG.renewal_alert_days_before,
    clause_categories_enabled: saved.clause_categories_enabled ?? DEFAULT_CLM_CONFIG.clause_categories_enabled,
    require_clause_approval: saved.require_clause_approval ?? DEFAULT_CLM_CONFIG.require_clause_approval,
    allow_inline_comments: saved.allow_inline_comments ?? DEFAULT_CLM_CONFIG.allow_inline_comments,
    mandatory_clauses_by_type: saved.mandatory_clauses_by_type ?? DEFAULT_CLM_CONFIG.mandatory_clauses_by_type,
    document_types_enabled: saved.document_types_enabled ?? DEFAULT_CLM_CONFIG.document_types_enabled,
    custom_document_types: saved.custom_document_types ?? DEFAULT_CLM_CONFIG.custom_document_types,
    max_file_size_mb: saved.max_file_size_mb ?? DEFAULT_CLM_CONFIG.max_file_size_mb,
    require_approval_before_signing: saved.require_approval_before_signing ?? DEFAULT_CLM_CONFIG.require_approval_before_signing,
    auto_version_on_upload: saved.auto_version_on_upload ?? DEFAULT_CLM_CONFIG.auto_version_on_upload,
    obligation_types_enabled: saved.obligation_types_enabled ?? DEFAULT_CLM_CONFIG.obligation_types_enabled,
    default_alert_days: saved.default_alert_days ?? DEFAULT_CLM_CONFIG.default_alert_days,
    default_responsible_party: saved.default_responsible_party ?? DEFAULT_CLM_CONFIG.default_responsible_party,
    auto_generate_next_recurrence: saved.auto_generate_next_recurrence ?? DEFAULT_CLM_CONFIG.auto_generate_next_recurrence,
    audit_actions_tracked: saved.audit_actions_tracked ?? DEFAULT_CLM_CONFIG.audit_actions_tracked,
    audit_retention_days: saved.audit_retention_days ?? DEFAULT_CLM_CONFIG.audit_retention_days,
    custom_clause_categories: saved.custom_clause_categories ?? DEFAULT_CLM_CONFIG.custom_clause_categories,
    custom_approval_roles: saved.custom_approval_roles ?? DEFAULT_CLM_CONFIG.custom_approval_roles,
    custom_obligation_types: saved.custom_obligation_types ?? DEFAULT_CLM_CONFIG.custom_obligation_types,
    custom_responsible_parties: saved.custom_responsible_parties ?? DEFAULT_CLM_CONFIG.custom_responsible_parties,
    custom_audit_actions: saved.custom_audit_actions ?? DEFAULT_CLM_CONFIG.custom_audit_actions,
    custom_adjustment_indices: saved.custom_adjustment_indices ?? DEFAULT_CLM_CONFIG.custom_adjustment_indices,
  };
}
