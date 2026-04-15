/**
 * Tipos para a Edge Function zoneamento-municipal v1
 *
 * Sessão 145 — Bloco H Sprint 5 (US-125)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ============================================================
// Parâmetros de Zoneamento
// ============================================================

export interface CoeficienteAproveitamento {
  basico?: number;
  maximo?: number;
  minimo?: number;
}

export interface Gabarito {
  andares?: number;
  altura_m?: number;
}

export interface Recuos {
  frontal_m?: number;
  lateral_m?: number;
  fundos_m?: number;
}

// ============================================================
// ACTION: analyze_pdf
// ============================================================

export interface AnalyzePdfParams {
  development_id: string;
  pdf_base64?: string;
  pdf_url?: string;
  municipality: string;
  state: string;
}

export interface AnalyzePdfResult {
  data?: ZoneamentoRecord;
  error?: { code: string; message: string };
}

// ============================================================
// ACTION: analyze_manual
// ============================================================

export interface AnalyzeManualParams {
  development_id: string;
  ca_basico?: number;
  ca_maximo?: number;
  ca_minimo?: number;
  to_percentual?: number;
  gabarito_andares?: number;
  gabarito_altura_m?: number;
  recuo_frontal_m?: number;
  recuo_lateral_m?: number;
  recuo_fundos_m?: number;
  zona_classificacao?: string;
  permeabilidade_percentual?: number;
  usos_permitidos?: string[];
  usos_proibidos?: string[];
  observacoes?: string;
}

export interface AnalyzeManualResult {
  data?: ZoneamentoRecord;
  error?: { code: string; message: string };
}

// ============================================================
// ACTION: get_zoning
// ============================================================

export interface GetZoningParams {
  development_id: string;
}

export interface GetZoningResult {
  data?: ZoneamentoRecord;
  error?: { code: string; message: string };
}

// ============================================================
// ACTION: list_zonings
// ============================================================

export interface ListZoningsParams {
  development_id: string;
  limit?: number;
}

export interface ZoneamentoSummary {
  id: string;
  development_id: string;
  ca_basico?: number;
  ca_maximo?: number;
  to_percentual?: number;
  zona_classificacao?: string;
  confidence_score?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ListZoningsResult {
  data?: {
    zonings: ZoneamentoSummary[];
    count: number;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Zoneamento Record (database shape)
// ============================================================

export interface ZoneamentoRecord {
  id: string;
  development_id: string;
  ca_basico?: number;
  ca_maximo?: number;
  ca_minimo?: number;
  to_percentual?: number;
  gabarito_andares?: number;
  gabarito_altura_m?: number;
  recuo_frontal_m?: number;
  recuo_lateral_m?: number;
  recuo_fundos_m?: number;
  zona_classificacao?: string;
  permeabilidade_percentual?: number;
  usos_permitidos: string[];
  usos_proibidos: string[];
  observacoes?: string;
  confidence_score?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Status labels PT-BR
// ============================================================

export const ZONEAMENTO_STATUS_LABELS: Record<string, string> = {
  generated: "Gerado",
  reviewed: "Revisado",
  approved: "Aprovado",
  submitted: "Protocolado",
};

export const ZONEAMENTO_STATUS_COLORS: Record<string, string> = {
  generated: "#f59e0b",
  reviewed: "#3b82f6",
  approved: "#22c55e",
  submitted: "#8b5cf6",
};

// ============================================================
// Zoning Classifications (common in Brazil)
// ============================================================

export const ZONING_CLASSIFICATIONS = [
  "Residencial 1",
  "Residencial 2",
  "Residencial 3",
  "Comercial 1",
  "Comercial 2",
  "Industrial 1",
  "Industrial 2",
  "Mista",
  "Serviços",
  "Especial",
  "Institucional",
  "Verde/Lazer",
] as const;

// ============================================================
// Use Types (common zoning uses)
// ============================================================

export const ZONING_USE_TYPES = {
  residential: [
    "Habitação unifamiliar",
    "Habitação multifamiliar",
    "Condomínio",
    "Moradia social",
  ],
  commercial: [
    "Comércio varejista",
    "Comércio atacadista",
    "Serviços profissionais",
    "Alimentação e bebidas",
    "Hotelaria",
  ],
  industrial: [
    "Indústria leve",
    "Indústria média",
    "Indústria pesada",
    "Depósito",
    "Fabricação",
  ],
  institutional: [
    "Administração pública",
    "Educação",
    "Saúde",
    "Religião",
    "Cultura",
  ],
  leisure: [
    "Parque",
    "Praça",
    "Área verde",
    "Recreação",
  ],
} as const;

// ============================================================
// Helper functions
// ============================================================

export function getStatusLabel(status: string): string {
  return ZONEAMENTO_STATUS_LABELS[status] || status;
}

export function getStatusColor(status: string): string {
  return ZONEAMENTO_STATUS_COLORS[status] || "#6b7280";
}

export function isValidZoneamento(data: Partial<ZoneamentoRecord>): boolean {
  // At least one zoneamento parameter should be provided
  return !!(
    data.ca_basico !== undefined ||
    data.to_percentual !== undefined ||
    data.gabarito_andares !== undefined ||
    data.zona_classificacao !== undefined
  );
}

export function formatZoneamentoForDisplay(data: ZoneamentoRecord): {
  ca: string;
  to: string;
  gabarito: string;
  recuos: string;
  zona: string;
  permeabilidade: string;
} {
  const ca = data.ca_basico
    ? `CA: ${data.ca_basico}${data.ca_maximo ? ` (máx: ${data.ca_maximo})` : ""}`
    : "CA: —";

  const to = data.to_percentual ? `TO: ${data.to_percentual}%` : "TO: —";

  const gabarito = data.gabarito_andares
    ? `${data.gabarito_andares} andares${data.gabarito_altura_m ? ` (${data.gabarito_altura_m}m)` : ""}`
    : "Gabarito: —";

  const recuos = data.recuo_frontal_m
    ? `Frontal: ${data.recuo_frontal_m}m${data.recuo_lateral_m ? `, Lateral: ${data.recuo_lateral_m}m` : ""}`
    : "Recuos: —";

  const zona = data.zona_classificacao || "Zona: —";

  const permeabilidade = data.permeabilidade_percentual
    ? `Permeabilidade: ${data.permeabilidade_percentual}%`
    : "Permeabilidade: —";

  return { ca, to, gabarito, recuos, zona, permeabilidade };
}

// ============================================================
// Brazilian states for select
// ============================================================

export const BRAZILIAN_STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;
