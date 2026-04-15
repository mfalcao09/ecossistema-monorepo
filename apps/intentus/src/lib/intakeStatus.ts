// Property Intake Workflow
export const intakeStatusLabels: Record<string, string> = {
  captado: "Captado",
  documentacao_pendente: "Documentação Pendente",
  em_analise: "Em Análise",
  aprovado: "Aprovado",
  publicado: "Publicado",
  locado: "Locado",
};

export const intakeStatusColors: Record<string, string> = {
  captado: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  documentacao_pendente: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  em_analise: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  aprovado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  publicado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  locado: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
};

export const intakePrevStage: Record<string, string | null> = {
  captado: null,
  documentacao_pendente: "captado",
  em_analise: "documentacao_pendente",
  aprovado: "em_analise",
  publicado: "aprovado",
};

export const intakeNextStage: Record<string, string | null> = {
  captado: "documentacao_pendente",
  documentacao_pendente: "em_analise",
  em_analise: "aprovado",
  aprovado: "publicado",
  publicado: null,
};

// Sale pipeline stages
export const saleStageLabels: Record<string, string> = {
  proposta: "Proposta",
  aceite: "Aceite",
  promessa_cv: "Promessa C&V",
  escritura: "Escritura",
  registro: "Registro",
};

export const saleStageColors: Record<string, string> = {
  proposta: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  aceite: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  promessa_cv: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  escritura: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  registro: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// Portal publishing options
export const portalOptions = [
  { value: "zap", label: "ZAP Imóveis" },
  { value: "olx", label: "OLX" },
  { value: "vivareal", label: "VivaReal" },
  { value: "imovelweb", label: "ImovelWeb" },
  { value: "site_proprio", label: "Site Público" },
];

// Guarantee type labels for contracts
export const contractGuaranteeLabels: Record<string, string> = {
  fiador: "Fiador",
  caucao_dinheiro: "Caução em Dinheiro",
  caucao_imovel: "Caução de Imóvel",
  seguro_fianca: "Seguro Fiança",
  titulo_capitalizacao: "Título de Capitalização",
  nenhuma: "Nenhuma",
};

// Installment line item types
export const lineItemTypeLabels: Record<string, string> = {
  aluguel: "Aluguel",
  iptu: "IPTU",
  condominio: "Condomínio",
  taxa_extra: "Taxa Extra",
  agua: "Água",
  luz: "Luz",
};
