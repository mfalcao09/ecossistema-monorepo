/**
 * Tipos para a Edge Function ibge-census v1
 *
 * Sessão 143 — Bloco H Sprint 3 (US-124)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ============================================================
// US-124: Renda por Setor Censitário
// ============================================================

export interface CensusIncomeItem {
  setor_codigo: string;
  municipio_codigo: string;
  municipio_nome: string;
  uf: string;
  renda_domiciliar_media: number;
  renda_per_capita: number;
  pct_renda_acima_5sm: number;
  pct_renda_abaixo_1sm: number;
  classe_predominante: string;
  fonte: string;
  ano_referencia: number;
  tipo_setor: "urbano" | "rural";
}

export interface CensusIncomeRequest {
  action: "fetch_census_income";
  municipio?: string;
  uf?: string;
  setor_codigo?: string;
  classe?: string;
  limit?: number;
  offset?: number;
}

export interface CensusIncomeResult {
  ok: boolean;
  data?: {
    items: CensusIncomeItem[];
    total: number;
    offset: number;
    limit: number;
    fonte: string;
    nota: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Demografia por Setor Censitário
// ============================================================

export interface CensusDemographicsItem {
  municipio_codigo: string;
  municipio_nome: string;
  uf: string;
  populacao_total: number;
  densidade_hab_km2: number;
  taxa_crescimento_anual_pct: number;
  populacao_urbana_pct: number;
  idade_media: number;
  indice_envelhecimento: number;
  razao_dependencia: number;
  fonte: string;
  ano_referencia: number;
}

export interface CensusDemographicsRequest {
  action: "fetch_census_demographics";
  municipio?: string;
  uf?: string;
  limit?: number;
  offset?: number;
}

export interface CensusDemographicsResult {
  ok: boolean;
  data?: {
    items: CensusDemographicsItem[];
    total: number;
    offset: number;
    limit: number;
    fonte: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Domicílios por Setor Censitário
// ============================================================

export interface CensusHousingItem {
  municipio_codigo: string;
  municipio_nome: string;
  uf: string;
  total_domicilios: number;
  domicilios_proprios_pct: number;
  domicilios_alugados_pct: number;
  domicilios_cedidos_pct: number;
  domicilios_com_esgoto_pct: number;
  domicilios_com_agua_rede_pct: number;
  domicilios_com_coleta_lixo_pct: number;
  media_moradores_domicilio: number;
  deficit_habitacional_estimado: number;
  fonte: string;
  ano_referencia: number;
}

export interface CensusHousingRequest {
  action: "fetch_census_housing";
  municipio?: string;
  uf?: string;
  limit?: number;
  offset?: number;
}

export interface CensusHousingResult {
  ok: boolean;
  data?: {
    items: CensusHousingItem[];
    total: number;
    offset: number;
    limit: number;
    fonte: string;
  };
  error?: { code: string; message: string };
}
