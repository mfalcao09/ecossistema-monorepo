/**
 * useMapBiomas — Bloco H Sprint 4
 *
 * Hooks para dados MapBiomas via Google Earth Engine:
 *   - useFetchLandUse       → Classificação para um ano específico
 *   - useFetchTimeSeries    → Histórico temporal com tendência
 *   - useGetMapBiomasCached → Dados cacheados
 *
 * Todos usam a EF development-mapbiomas (multi-action).
 *
 * Sessão 144 — Bloco H Sprint 4 (US-117)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  FetchLandUseParams,
  FetchLandUseResult,
  FetchTimeSeriesParams,
  FetchTimeSeriesResult,
  GetCachedParams,
  GetCachedResult,
} from "@/lib/parcelamento/mapbiomas-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callMapBiomas<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("development-mapbiomas", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar development-mapbiomas");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-117: Classificação para um ano específico
// ---------------------------------------------------------------------------

export function useFetchLandUse() {
  return useMutation({
    mutationFn: (params: FetchLandUseParams) =>
      callMapBiomas<FetchLandUseResult>({ action: "fetch_land_use", params }),
  });
}

// ---------------------------------------------------------------------------
// US-117: Histórico temporal (time series)
// ---------------------------------------------------------------------------

export function useFetchTimeSeries() {
  return useMutation({
    mutationFn: (params: FetchTimeSeriesParams) =>
      callMapBiomas<FetchTimeSeriesResult>({ action: "fetch_time_series", params }),
  });
}

// ---------------------------------------------------------------------------
// Dados cacheados
// ---------------------------------------------------------------------------

export function useGetMapBiomasCached() {
  return useMutation({
    mutationFn: (params: GetCachedParams) =>
      callMapBiomas<GetCachedResult>({ action: "get_cached", params }),
  });
}
