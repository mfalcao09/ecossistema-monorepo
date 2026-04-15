/**
 * Tipos para a Edge Function development-mapbiomas v1
 *
 * Sessão 144 — Bloco H Sprint 4 (US-117)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ============================================================
// Land Use Class (item individual do histograma)
// ============================================================

export interface MapBiomasLandUseClass {
  class_id: number;
  class_name: string;
  area_ha: number;
  percentage: number;
  color: string;
}

// ============================================================
// Resultado de um ano específico
// ============================================================

export interface MapBiomasYearResult {
  reference_year: number;
  land_use_classes: MapBiomasLandUseClass[];
  dominant_class: string;
  native_vegetation_pct: number;
  agriculture_pct: number;
  urban_pct: number;
  water_pct: number;
  pixel_count: number;
  collection_version: string;
}

// ============================================================
// ACTION: fetch_land_use
// ============================================================

export interface FetchLandUseParams {
  development_id: string;
  year?: number;
  buffer_radius_m?: number;
}

export interface FetchLandUseResult {
  data?: MapBiomasYearResult & { cached: boolean };
  error?: { code: string; message: string };
}

// ============================================================
// ACTION: fetch_time_series
// ============================================================

export interface FetchTimeSeriesParams {
  development_id: string;
  start_year?: number;
  end_year?: number;
  buffer_radius_m?: number;
}

export interface TimeSeriesTrend {
  deforestation_trend: "increasing" | "stable" | "decreasing";
  urbanization_trend: "increasing" | "stable" | "decreasing";
  native_veg_change_pct: number;
  years_analyzed: number[];
  change_summary: Record<string, {
    start_pct: number;
    end_pct: number;
    delta: number;
  }>;
}

export interface FetchTimeSeriesResult {
  data?: {
    years: MapBiomasYearResult[];
    trend: TimeSeriesTrend;
    total_years: number;
    cached_years: number;
  };
  error?: { code: string; message: string };
}

// ============================================================
// ACTION: get_cached
// ============================================================

export interface GetCachedParams {
  development_id: string;
}

export interface CachedEntry {
  reference_year: number;
  dominant_class: string;
  native_vegetation_pct: number;
  agriculture_pct: number;
  urban_pct: number;
  water_pct: number;
  fetched_at: string;
  expires_at: string;
}

export interface GetCachedResult {
  data?: {
    entries: CachedEntry[];
    count: number;
    has_trend: boolean;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Helpers — Mapeamento de categorias para labels/cores PT-BR
// ============================================================

export const CATEGORY_LABELS: Record<string, string> = {
  native_vegetation: "Vegetação Nativa",
  agriculture: "Agropecuária",
  urban: "Área Urbana",
  water: "Corpo D'Água",
  non_vegetated: "Não Vegetada",
  unobserved: "Não Observado",
  unknown: "Desconhecido",
};

export const CATEGORY_COLORS: Record<string, string> = {
  native_vegetation: "#1f8d49",
  agriculture: "#ffd966",
  urban: "#d4271e",
  water: "#2532e4",
  non_vegetated: "#db4d4f",
  unobserved: "#cccccc",
};

export const TREND_LABELS: Record<string, string> = {
  increasing: "Crescente",
  stable: "Estável",
  decreasing: "Decrescente",
};
