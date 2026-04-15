// CLM - Contract Lifecycle Management schema constants

export const documentTypeLabels: Record<string, string> = {
  minuta: "Minuta",
  aditivo: "Aditivo",
  termo_entrega: "Termo de Entrega",
  laudo: "Laudo",
  procuracao: "Procuração",
  comprovante: "Comprovante",
  outro: "Outro",
};

export const documentStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  aprovado: "Aprovado",
  assinado: "Assinado",
  obsoleto: "Obsoleto",
};

export const documentStatusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_revisao: "bg-yellow-500/20 text-yellow-700",
  aprovado: "bg-green-500/20 text-green-700",
  assinado: "bg-blue-500/20 text-blue-700",
  obsoleto: "bg-red-500/20 text-red-700",
};

export const approvalStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  pulado: "Pulado",
};

export const approvalStatusColors: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-700",
  aprovado: "bg-green-500/20 text-green-700",
  rejeitado: "bg-red-500/20 text-red-700",
  pulado: "bg-muted text-muted-foreground",
};

export const obligationTypeLabels: Record<string, string> = {
  financeira: "Financeira",
  juridica: "Jurídica",
  operacional: "Operacional",
  documental: "Documental",
};

export const obligationStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  cumprida: "Cumprida",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export const obligationStatusColors: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-700",
  cumprida: "bg-green-500/20 text-green-700",
  vencida: "bg-red-500/20 text-red-700",
  cancelada: "bg-muted text-muted-foreground",
};

export const responsiblePartyLabels: Record<string, string> = {
  locatario: "Locatário",
  proprietario: "Proprietário",
  administradora: "Administradora",
};

export const recurrenceLabels: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const clauseCategoryLabels: Record<string, string> = {
  geral: "Geral",
  garantia: "Garantia",
  multa: "Multa",
  rescisao: "Rescisão",
  reajuste: "Reajuste",
  entrega: "Entrega",
  sigilo: "Sigilo",
};

export const auditActionLabels: Record<string, string> = {
  criado: "Criado",
  editado: "Editado",
  status_alterado: "Status Alterado",
  documento_enviado: "Documento Enviado",
  aprovacao: "Aprovação",
  aprovacao_rejeitada: "Aprovação Rejeitada",
  assinatura: "Assinatura",
  obrigacao_criada: "Obrigação Criada",
  obrigacao_cumprida: "Obrigação Cumprida",
  renovacao_formalizada: "Renovação Formalizada",
};

export const auditActionIcons: Record<string, string> = {
  criado: "plus",
  editado: "pencil",
  status_alterado: "refresh-cw",
  documento_enviado: "upload",
  aprovacao: "check-circle",
  aprovacao_rejeitada: "x-circle",
  assinatura: "pen-tool",
  obrigacao_criada: "clipboard-list",
  obrigacao_cumprida: "check-square",
};
