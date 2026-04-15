export const DEFAULT_FEATURES = [
  "Água Quente", "Aquecimento a Gás", "Aquecimento Ambiente",
  "Ar-condicionado Central", "Ar-condicionado Gaveta", "Ar-condicionado Split", "Área Serviço", "Automação", "Banho Auxiliar", "Banheiro Empregada",
  "Churrasqueira", "Closet", "Cobertura", "Copa", "Cozinha", "Cozinha Montada",
  "Deck", "Decorado", "Despensa", "Dormitório Armário",
  "Edícula", "Estar Íntimo", "Escritório", "Gabinete", "Gradeado",
  "Hall", "Hidro", "Home Theater", "Lareira", "Lavabo",
  "Mobiliado", "Pátio", "Piscina Privativa", "Quarto Empregada", "Quintal",
  "Reformado", "Sacada", "Sala Armário", "Sala Estar", "Sala Jantar",
  "Sauna", "Semi Mobiliado", "Suite Master",
  "Terraço", "Varanda", "Vista Panorâmica",
];

export const DEFAULT_CONDO_FEATURES = [
  "Alarme", "Casa em Condomínio", "Casa Individual", "Casa Térrea",
  "Churrasq Col", "Circuito de TV", "Depósito", "Edícula",
  "Espaço Gourmet", "Gás Central", "Gradil", "Interfone",
  "Jardim", "Lavanderia", "Lazer Completo", "Na Planta", "Pilotis",
  "Piscina Coberta", "Piscina Infantil", "Playground", "Portaria",
  "Portaria 24h", "Porteiro Eletrônico", "Quadra Esporte",
  "Quiosque", "Sala Jogos", "Sala Fitness", "Salão de Festas",
  "Sauna", "Segurança", "Sem Condomínio", "Terraço Coberto", "Zelador",
];

export const OPTIONAL_FIELDS: { key: string; label: string }[] = [
  { key: "industrial_area", label: "Área Fabril" },
  { key: "ceiling_height", label: "Pé Direito (m)" },
  { key: "docks", label: "Docas" },
  { key: "accepts_exchange", label: "Aceita Permuta" },
  { key: "private_area", label: "Área Privativa" },
  { key: "has_sign", label: "Tem Placa" },
  { key: "has_income", label: "Imóvel c/ Renda" },
  { key: "highlight_web", label: "Destaque Web" },
  { key: "region", label: "Região" },
  { key: "leasable_area", label: "ABL (Área Bruta Locável)" },
  { key: "power_capacity", label: "Carga Elétrica" },
  { key: "category", label: "Categoria (Padrão/Luxo)" },
  { key: "habite_se_status", label: "Habite-se" },
  { key: "avcb_expiry", label: "Validade AVCB" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "condominium_name", label: "Nome do Condomínio" },
];

export const PERSON_OPTIONAL_FIELDS: { key: string; label: string }[] = [
  { key: "rg", label: "RG" },
  { key: "date_of_birth", label: "Data de Nascimento" },
  { key: "phone2", label: "Telefone 2" },
  { key: "zip_code", label: "CEP" },
  { key: "street", label: "Rua" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "notes", label: "Observações" },
  { key: "marital_status", label: "Estado Civil" },
  { key: "profession", label: "Profissão" },
  { key: "nationality", label: "Nacionalidade" },
  { key: "email_billing", label: "E-mail Faturamento" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "bank_name", label: "Dados Bancários" },
  { key: "credit_analysis_status", label: "Análise de Crédito" },
  { key: "lgpd_consent_date", label: "LGPD" },
];

export const CONTRACT_OPTIONAL_FIELDS: { key: string; label: string }[] = [
  { key: "guarantee_type", label: "Tipo de Garantia" },
  { key: "guarantee_value", label: "Valor da Garantia" },
  { key: "guarantee_policy_number", label: "Nº Apólice/Título" },
  { key: "guarantee_details", label: "Detalhes da Garantia" },
  { key: "admin_fee_percentage", label: "Taxa de Administração" },
  { key: "adjustment_index", label: "Índice de Reajuste" },
  { key: "commission_percentage", label: "Comissão (%)" },
  { key: "commission_value", label: "Valor da Comissão" },
  { key: "notes", label: "Observações" },
  { key: "contract_number", label: "Nº do Contrato" },
  { key: "notice_period_days", label: "Aviso Prévio" },
  { key: "grace_period_months", label: "Carência" },
  { key: "allows_sublease", label: "Permite Sublocação" },
  { key: "exclusivity_clause", label: "Exclusividade de Ramo" },
  { key: "promotion_fund_pct", label: "Fundo de Promoção" },
  { key: "penalty_type", label: "Tipo de Multa Rescisória" },
  { key: "payment_due_day", label: "Dia de Vencimento" },
];



export interface FormCustomization {
  property_features: string[];
  condo_features: string[];
  extra_property_types: { key: string; label: string }[];
  hidden_fields: string[];
  extra_optional_fields: { key: string; label: string }[];
  person_hidden_fields: string[];
  person_extra_types: { key: string; label: string }[];
  person_extra_fields: { key: string; label: string }[];
  contract_hidden_fields: string[];
  contract_extra_fields: { key: string; label: string }[];
}

export function mergeFormCustomization(
  saved: Partial<FormCustomization> | undefined | null,
): FormCustomization {
  return {
    property_features: saved?.property_features ?? DEFAULT_FEATURES,
    condo_features: saved?.condo_features ?? DEFAULT_CONDO_FEATURES,
    extra_property_types: saved?.extra_property_types ?? [],
    hidden_fields: saved?.hidden_fields ?? [],
    extra_optional_fields: saved?.extra_optional_fields ?? [],
    person_hidden_fields: saved?.person_hidden_fields ?? [],
    person_extra_types: saved?.person_extra_types ?? [],
    person_extra_fields: saved?.person_extra_fields ?? [],
    contract_hidden_fields: saved?.contract_hidden_fields ?? [],
    contract_extra_fields: saved?.contract_extra_fields ?? [],
  };
}
