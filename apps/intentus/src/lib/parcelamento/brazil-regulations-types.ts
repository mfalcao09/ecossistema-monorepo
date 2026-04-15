/**
 * Tipos para a Edge Function brazil-regulations v1
 *
 * Sessão 141 — Bloco H Sprint 1 (Quick Wins)
 * US-127 (ITBI), US-128 (Outorga), US-129 (Lei do Verde), US-132 (CNPJ SPE)
 */

// ============================================================
// US-127: ITBI
// ============================================================

export interface ItbiRequest {
  action: "calc_itbi";
  development_id?: string;
  vgv_total?: number;
  valor_terreno?: number;
  qtd_lotes?: number;
  cidade?: string;
  uf?: string;
  aliquota_override_pct?: number;
}

export interface ItbiResult {
  municipio: string;
  uf: string;
  aliquota_pct: number;
  fonte_legal: string;
  is_estimate: boolean;
  detalhamento: {
    valor_terreno: number;
    itbi_terreno: number;
    vgv_total: number;
    qtd_lotes: number;
    preco_medio_lote: number;
    itbi_por_lote: number;
    itbi_total_vendas: number;
  };
  resumo: {
    itbi_aquisicao_terreno: number;
    itbi_total_vendas_lotes: number;
    itbi_total: number;
    itbi_pct_vgv: number;
  };
  nota_legal: string;
  dicas: string[];
}

// ============================================================
// US-128: Outorga Onerosa
// ============================================================

export interface OutorgaRequest {
  action: "calc_outorga";
  development_id?: string;
  area_terreno_m2?: number;
  area_construida_m2?: number;
  valor_m2_terreno?: number;
  coeficiente_basico?: number;
  coeficiente_maximo?: number;
  coeficiente_utilizado?: number;
  fator_planejamento?: number;
  cidade?: string;
  uf?: string;
  tipo_empreendimento?: string;
}

export interface OutorgaResult {
  municipio: string;
  uf: string;
  fonte_legal: string;
  tipo_empreendimento: string;
  parametros_urbanisticos: {
    ca_basico: number;
    ca_maximo: number;
    ca_utilizado: number;
    fator_planejamento: number;
  };
  isento: boolean;
  motivo_isencao: string | null;
  calculo: {
    area_terreno_m2: number;
    area_construida_m2: number;
    valor_m2_terreno: number;
    excedente_ca: number;
    outorga_valor: number;
    formula: string;
  };
  nota_legal: string;
  dicas: string[];
}

// ============================================================
// US-129: Lei do Verde
// ============================================================

export interface LeiVerdeRequest {
  action: "check_lei_verde";
  development_id?: string;
  area_total_m2?: number;
  area_verde_m2?: number;
  area_permeavel_m2?: number;
  qtd_lotes?: number;
  extensao_vias_m?: number;
  cidade?: string;
  uf?: string;
  bioma?: string;
}

export interface LeiVerdeCheckItem {
  item: string;
  status: "pass" | "warn" | "fail" | "pending";
  exigido: string;
  atual: string;
  recomendacao: string;
}

export interface LeiVerdeResult {
  municipio: string;
  uf: string;
  bioma: string;
  fonte_legal: string;
  exigencias: {
    taxa_permeabilidade_min_pct: number;
    area_verde_min_pct: number;
    arvores_por_metro_via: number;
    compensacao_mudas_por_m2: number;
    reserva_legal_pct: number;
  };
  estimativas: {
    area_verde_min_m2: number;
    area_permeavel_min_m2: number;
    reserva_legal_min_m2: number;
    arvores_viarias: number;
    mudas_compensacao: number;
  };
  checklist: LeiVerdeCheckItem[];
  resumo: {
    total_checks: number;
    pass: number;
    fail: number;
    pending: number;
    warn: number;
  };
  nota_legal: string;
}

// ============================================================
// US-132: Validação CNPJ SPE
// ============================================================

export interface ValidateCnpjRequest {
  action: "validate_cnpj_spe";
  cnpj: string;
}

export interface CnpjCheckItem {
  check: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface CnpjSpeResult {
  valid: boolean;
  cnpj: string;
  cnpj_formatado: string;
  error?: string;
  dados_receita?: {
    razao_social: string;
    nome_fantasia: string;
    situacao: string;
    data_situacao: string;
    natureza_juridica: string;
    cnae_principal: { codigo: string; descricao: string };
    capital_social: string;
    data_abertura: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
    email: string;
    telefone: string;
  };
  is_spe?: boolean;
  checks: CnpjCheckItem[];
  resumo?: {
    total_checks: number;
    pass: number;
    warn: number;
    fail: number;
    status_geral: "aprovado" | "aprovado_com_ressalvas" | "reprovado";
  };
  dicas?: string[];
}

// Union type for all requests
export type BrazilRegulationsRequest =
  | ItbiRequest
  | OutorgaRequest
  | LeiVerdeRequest
  | ValidateCnpjRequest;
