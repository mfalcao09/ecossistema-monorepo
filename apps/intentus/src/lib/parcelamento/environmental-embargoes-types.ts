/**
 * Tipos para a Edge Function environmental-embargoes v1
 *
 * Sessão 143 — Bloco H Sprint 3 (US-126)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ============================================================
// US-126: Embargos IBAMA
// ============================================================

export interface IbamaEmbargoItem {
  id: string;
  numero_auto: string;
  data_embargo: string;
  municipio: string;
  uf: string;
  lat: number;
  lng: number;
  raio_km: number;
  area_ha: number;
  infração: string;
  situacao: "vigente" | "suspenso" | "anulado";
  autuado_doc: string;
  nome_autuado: string;
  bioma: string;
  tipo_vegetacao: string;
  ultima_atualizacao: string;
  /** Presente se busca por coordenadas */
  distancia_km?: number;
}

export interface CheckIbamaRequest {
  action: "check_ibama_embargoes";
  lat?: number;
  lng?: number;
  municipio?: string;
  uf?: string;
  raio_busca_km?: number;
  incluir_inativos?: boolean;
  limit?: number;
  offset?: number;
}

export interface CheckIbamaResult {
  ok: boolean;
  data?: {
    embargos: IbamaEmbargoItem[];
    total: number;
    offset: number;
    limit: number;
    risco: "baixo" | "moderado" | "alto" | "critico";
    resumo: string;
    fonte: string;
    ultima_consulta: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Unidades de Conservação ICMBio
// ============================================================

export interface ICMBioUCItem {
  id: string;
  nome: string;
  categoria: string;
  grupo: "proteção_integral" | "uso_sustentável";
  municipio: string;
  uf: string;
  lat: number;
  lng: number;
  raio_km: number;
  area_ha: number;
  zona_amortecimento_km: number;
  restricoes: string;
  ato_legal: string;
  plano_manejo: boolean;
  /** Presente se busca por coordenadas */
  distancia_km?: number;
  dentro_uc?: boolean;
  dentro_zona_amortecimento?: boolean;
  impacto?: "bloqueante" | "restritivo" | "informativo";
}

export interface CheckICMBioRequest {
  action: "check_icmbio_embargoes";
  lat?: number;
  lng?: number;
  municipio?: string;
  uf?: string;
  raio_busca_km?: number;
  limit?: number;
  offset?: number;
}

export interface CheckICMBioResult {
  ok: boolean;
  data?: {
    unidades_conservacao: ICMBioUCItem[];
    total: number;
    offset: number;
    limit: number;
    risco: "baixo" | "moderado" | "alto" | "critico";
    resumo: string;
    fonte: string;
    ultima_consulta: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Detalhes de Embargo
// ============================================================

export interface GetEmbargoDetailsRequest {
  action: "get_embargo_details";
  embargo_id: string;
}

export interface EmbargoDetailsResult {
  ok: boolean;
  data?: IbamaEmbargoItem & {
    recomendacoes: string[];
  };
  error?: { code: string; message: string };
}
