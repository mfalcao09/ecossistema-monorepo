import { z } from "zod";
import { isValidCpfCnpj } from "./cpfCnpjValidation";

export const personSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
  person_type: z.enum(["cliente", "proprietario", "fiador", "locatario", "comprador", "lead"]),
  entity_type: z.enum(["pf", "pj"]).default("pf"),
  cpf_cnpj: z.string().trim().max(18).optional().or(z.literal("")).refine(
    (val) => !val || val === "" || isValidCpfCnpj(val),
    { message: "CPF ou CNPJ inválido" }
  ),
  rg: z.string().trim().max(20).optional().or(z.literal("")),
  rg_issuer: z.string().trim().max(50).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  email_billing: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  phone2: z.string().trim().max(20).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(20).optional().or(z.literal("")),
  notification_preference: z.string().trim().max(20).optional().or(z.literal("")),
  zip_code: z.string().trim().max(10).optional().or(z.literal("")),
  street: z.string().trim().max(200).optional().or(z.literal("")),
  number: z.string().trim().max(20).optional().or(z.literal("")),
  complement: z.string().trim().max(100).optional().or(z.literal("")),
  neighborhood: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(2).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  legal_representative_name: z.string().trim().max(200).optional().or(z.literal("")),
  legal_representative_cpf: z.string().trim().max(18).optional().or(z.literal("")),
  legal_representative_email: z.string().trim().max(255).optional().or(z.literal("")),
  legal_representative_phone: z.string().trim().max(20).optional().or(z.literal("")),
  // Qualificação Legal
  marital_status: z.string().trim().max(50).optional().or(z.literal("")),
  marriage_regime: z.string().trim().max(100).optional().or(z.literal("")),
  profession: z.string().trim().max(100).optional().or(z.literal("")),
  nationality: z.string().trim().max(100).optional().or(z.literal("")),
  natural_from: z.string().trim().max(100).optional().or(z.literal("")),
  // Dados Bancários
  bank_name: z.string().trim().max(100).optional().or(z.literal("")),
  bank_agency: z.string().trim().max(20).optional().or(z.literal("")),
  bank_account: z.string().trim().max(30).optional().or(z.literal("")),
  bank_account_type: z.string().trim().max(20).optional().or(z.literal("")),
  pix_key: z.string().trim().max(100).optional().or(z.literal("")),
  // PJ
  inscricao_estadual: z.string().trim().max(30).optional().or(z.literal("")),
  inscricao_municipal: z.string().trim().max(30).optional().or(z.literal("")),
  cnae: z.string().trim().max(20).optional().or(z.literal("")),
  // LGPD / Compliance
  lgpd_consent_date: z.string().optional().or(z.literal("")),
  lgpd_consent_ip: z.string().trim().max(50).optional().or(z.literal("")),
  credit_analysis_status: z.string().trim().max(50).optional().or(z.literal("")),
  credit_analysis_date: z.string().optional().or(z.literal("")),
});

export type PersonFormValues = z.infer<typeof personSchema>;

export const personTypeLabels: Record<string, string> = {
  cliente: "Cliente",
  proprietario: "Proprietário",
  fiador: "Fiador",
  locatario: "Locatário",
  comprador: "Comprador",
  lead: "Lead",
};

export const entityTypeLabels: Record<string, string> = {
  pf: "Pessoa Física",
  pj: "Pessoa Jurídica",
};

export const brazilianStates = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const maritalStatusLabels: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  separado: "Separado(a)",
  uniao_estavel: "União Estável",
};

export const marriageRegimeLabels: Record<string, string> = {
  comunhao_parcial: "Comunhão Parcial de Bens",
  comunhao_universal: "Comunhão Universal de Bens",
  separacao_total: "Separação Total de Bens",
  participacao_final: "Participação Final nos Aquestos",
};

export const notificationPreferenceLabels: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export const creditAnalysisStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  em_analise: "Em Análise",
};

export const defaultPersonValues: PersonFormValues = {
  name: "",
  person_type: "lead",
  entity_type: "pf",
  cpf_cnpj: "",
  rg: "",
  rg_issuer: "",
  date_of_birth: "",
  email: "",
  email_billing: "",
  phone: "",
  phone2: "",
  whatsapp: "",
  notification_preference: "email",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  notes: "",
  legal_representative_name: "",
  legal_representative_cpf: "",
  legal_representative_email: "",
  legal_representative_phone: "",
  marital_status: "",
  marriage_regime: "",
  profession: "",
  nationality: "Brasileira",
  natural_from: "",
  bank_name: "",
  bank_agency: "",
  bank_account: "",
  bank_account_type: "",
  pix_key: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  cnae: "",
  lgpd_consent_date: "",
  lgpd_consent_ip: "",
  credit_analysis_status: "",
  credit_analysis_date: "",
};
