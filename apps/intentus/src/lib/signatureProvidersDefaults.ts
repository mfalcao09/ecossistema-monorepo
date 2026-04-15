// ── Signature Provider Types & Defaults ──

export type SignatureProviderKey = "docusign" | "clicksign" | "d4sign" | "registro_imoveis" | "govbr" | "manual";

export interface DocuSignConfig {
  enabled: boolean;
  integration_key: string;
  secret_key: string;
  account_id: string;
  base_url: string;
  environment: "sandbox" | "production";
}

export interface ClickSignConfig {
  enabled: boolean;
  api_token: string;
  environment: "sandbox" | "production";
}

export interface D4SignConfig {
  enabled: boolean;
  token_api: string;
  crypt_key: string;
  uuid_safe: string;
  environment: "sandbox" | "production";
}

export interface RegistroImoveisConfig {
  enabled: boolean;
  login: string;
  password: string;
  environment: "testes" | "producao";
}

export interface GovBrSignConfig {
  enabled: boolean;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  environment: "staging" | "production";
}

export interface SignatureProvidersConfig {
  docusign: DocuSignConfig;
  clicksign: ClickSignConfig;
  d4sign: D4SignConfig;
  registro_imoveis: RegistroImoveisConfig;
  govbr: GovBrSignConfig;
}

export const DEFAULT_SIGNATURE_PROVIDERS: SignatureProvidersConfig = {
  docusign: {
    enabled: false,
    integration_key: "",
    secret_key: "",
    account_id: "",
    base_url: "https://demo.docusign.net/restapi",
    environment: "sandbox",
  },
  clicksign: {
    enabled: false,
    api_token: "",
    environment: "sandbox",
  },
  d4sign: {
    enabled: false,
    token_api: "",
    crypt_key: "",
    uuid_safe: "",
    environment: "sandbox",
  },
  registro_imoveis: {
    enabled: false,
    login: "",
    password: "",
    environment: "testes",
  },
  govbr: {
    enabled: false,
    client_id: "",
    client_secret: "",
    redirect_uri: "",
    environment: "staging",
  },
};

export function mergeSignatureProviders(saved?: Partial<SignatureProvidersConfig> | null): SignatureProvidersConfig {
  if (!saved) return { ...DEFAULT_SIGNATURE_PROVIDERS };
  return {
    docusign: { ...DEFAULT_SIGNATURE_PROVIDERS.docusign, ...(saved.docusign || {}) },
    clicksign: { ...DEFAULT_SIGNATURE_PROVIDERS.clicksign, ...(saved.clicksign || {}) },
    d4sign: { ...DEFAULT_SIGNATURE_PROVIDERS.d4sign, ...(saved.d4sign || {}) },
    registro_imoveis: { ...DEFAULT_SIGNATURE_PROVIDERS.registro_imoveis, ...(saved.registro_imoveis || {}) },
    govbr: { ...DEFAULT_SIGNATURE_PROVIDERS.govbr, ...(saved.govbr || {}) },
  };
}

export const PROVIDER_LABELS: Record<SignatureProviderKey, string> = {
  docusign: "DocuSign",
  clicksign: "ClickSign",
  d4sign: "D4Sign",
  registro_imoveis: "Registro de Imóveis",
  govbr: "Assinatura gov.br",
  manual: "Manual",
};

export const PROVIDER_COLORS: Record<SignatureProviderKey, string> = {
  docusign: "text-blue-600",
  clicksign: "text-green-600",
  d4sign: "text-orange-600",
  registro_imoveis: "text-purple-600",
  govbr: "text-emerald-600",
  manual: "text-muted-foreground",
};

// ── Tipos de assinatura (Lei 14.063/2020) ──

export type SignatureLevel = "simples" | "avancada" | "qualificada";

export const SIGNATURE_LEVEL_LABELS: Record<SignatureLevel, string> = {
  simples: "Simples",
  avancada: "Avançada",
  qualificada: "Qualificada (ICP-Brasil)",
};

export const SIGNATURE_LEVEL_DESCRIPTIONS: Record<SignatureLevel, string> = {
  simples: "Identidade por dados básicos (login, email). Para interações de baixo risco.",
  avancada: "Associação unívoca ao signatário com rastreamento de IP, email e tokens. Padrão de mercado.",
  qualificada: "Certificado digital ICP-Brasil (e-CPF/e-CNPJ). Mesma validade que firma reconhecida.",
};

export const AUTH_METHOD_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  icpbrasil: "ICP-Brasil",
  manuscrita: "Assinatura manuscrita",
};

export const AUTH_METHODS_LIST = Object.entries(AUTH_METHOD_LABELS).map(([value, label]) => ({ value, label }));

export const SIGNER_ROLE_LABELS: Record<string, string> = {
  sign: "Assinar",
  approve: "Aprovar",
  witness: "Testemunha",
  acknowledge: "Acusar recebimento",
  homologar: "Homologar",
  parte: "Parte",
  contratante: "Contratante",
  contratada: "Contratada",
  administrador: "Administrador",
  anuente: "Anuente",
  arrendatario: "Arrendatário(a)",
  arrendador: "Arrendador(a)",
  primeiro_aditante: "Primeiro aditante",
  segundo_aditante: "Segundo aditante",
  associado: "Associado",
  avalista: "Avalista",
  cedente: "Cedente",
  cessionario: "Cessionário",
  comodante: "Comodante",
  comodatario: "Comodatário",
  contador: "Contador",
  correntista: "Correntista",
  corretor: "Corretor",
  corretor_imoveis: "Corretor de imóveis",
  corretor_seguros: "Corretor de seguros",
  credor: "Credor",
  credor_fiduciario: "Credor fiduciário",
  devedor: "Devedor",
  devedor_solidario: "Devedor solidário",
  distratada: "Distratada",
  distratante: "Distratante",
  emitente: "Emitente",
  empregado: "Empregado",
  empregador: "Empregador",
  endossante: "Endossante",
  endossatario: "Endossatário",
  fiador: "Fiador",
  fiel_depositario: "Fiel depositário",
  franqueado: "Franqueado",
  franqueador: "Franqueador",
  gestor: "Gestor",
  interveniente: "Interveniente",
  interveniente_anuente: "Interveniente Anuente",
  interveniente_garantidor: "Interveniente Garantidor",
  locador: "Locador",
  locatario: "Locatário",
  mutuante: "Mutuante",
  mutuario: "Mutuário(a)",
  outorgante: "Outorgante",
  outorgado: "Outorgado",
  parte_compradora: "Parte compradora",
  parte_vendedora: "Parte vendedora",
  presidente: "Presidente",
  procurador: "Procurador",
  representante_legal: "Representante legal",
  responsavel_solidario: "Responsável solidário",
  responsavel_legal: "Responsável legal",
  segurado: "Segurado",
  socio: "Sócio",
  validador: "Validador",
  caucionante: "Caucionante",
  consignado: "Consignado",
  consignatario: "Consignatário",
  advogado: "Advogado",
  conjuge_fiador: "Cônjuge do fiador",
  diretor: "Diretor(a)",
  licenciante: "Licenciante",
  licenciada: "Licenciada",
  prestador_servicos: "Prestador(a) de serviços",
  afiancado: "Afiançado",
  anuido: "Anuído",
  vistoriador: "Vistoriador",
  sindico: "Síndico(a)",
  intermediario: "Intermediário(a)",
  condomino: "Condômino",
  proprietario: "Proprietário(a)",
  morador: "Morador(a)",
  tesoureiro: "Tesoureiro(a)",
  secretario: "Secretário(a)",
  doador: "Doador",
  donatario: "Donatário",
  beneficiario: "Beneficiário",
  mandante: "Mandante",
  mandatario: "Mandatário",
  inventariante: "Inventariante",
  tutor: "Tutor(a)",
  curador: "Curador(a)",
  perito: "Perito",
  mediador: "Mediador(a)",
  arbitro: "Árbitro",
  investidor: "Investidor(a)",
  cotista: "Cotista",
  acionista: "Acionista",
  subscritor: "Subscritor",
  depositario: "Depositário",
  conselheiro: "Conselheiro(a)",
  sublocatario: "Sublocatário(a)",
  tomador_servicos: "Tomador(a) de serviços",
  garantidor: "Garantidor",
  permutante: "Permutante",
  estipulante: "Estipulante",
  incorporador: "Incorporador(a)",
  agente_fiduciario: "Agente fiduciário",
};

export const SIGNER_ROLES = Object.entries(SIGNER_ROLE_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

// ── Envelope-specific field types ──

export interface DocuSignSigner {
  name: string;
  email: string;
  routing_order: number;
  recipient_type: "signer" | "cc" | "in_person_signer";
}

export interface ClickSignSigner {
  name: string;
  email: string;
  cpf: string;
  autentica_via: "email" | "sms" | "whatsapp" | "pix";
  papel: "sign" | "approve" | "witness";
}

export interface D4SignSigner {
  email: string;
  acao: "assinar" | "aprovar" | "reconhecer" | "testemunhar" | "acusar_recebimento";
}

export interface RegistroImoveisSigner {
  name: string;
  cpf: string;
}

export interface DocuSignEnvelopeData {
  title: string;
  email_subject: string;
  email_blurb: string;
  status_inicial: "created" | "sent";
}

export interface ClickSignEnvelopeData {
  title: string;
  deadline_at: string;
  message: string;
  locale: "pt-BR" | "en";
  sequence_enabled: boolean;
}

export interface D4SignEnvelopeData {
  uuid_safe: string;
  message: string;
  webhook_url: string;
}

export interface RegistroImoveisEnvelopeData {
  title: string;
  tipo_protocolo: string;
  dados_indicador_real: string;
  tipo_pagamento: string;
}

export interface GovBrSigner {
  name: string;
  cpf: string;
}

export interface GovBrEnvelopeData {
  title: string;
  message: string;
}
