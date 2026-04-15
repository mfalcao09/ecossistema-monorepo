/**
 * useZoneamento — Bloco H Sprint 5
 *
 * Hooks para extração de zoneamento municipal via Gemini 2.0 Flash:
 *   - useAnalyzeZoneamentoPdf   → Extrai de PDF (base64 ou URL)
 *   - useAnalyzeZoneamentoManual → Valida dados tipados manualmente
 *   - useGetZoning              → Recupera zoneamento cacheado
 *   - useListZonings            → Lista análises de um development
 *
 * Todos usam a EF zoneamento-municipal (multi-action).
 *
 * Sessão 145 — Bloco H Sprint 5 (US-125)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AnalyzePdfParams,
  AnalyzePdfResult,
  AnalyzeManualParams,
  AnalyzeManualResult,
  GetZoningParams,
  GetZoningResult,
  ListZoningsParams,
  ListZoningsResult,
} from "@/lib/parcelamento/zoneamento-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callZoneamento<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("zoneamento-municipal", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar zoneamento-municipal");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-125: Análise de PDF (Plano Diretor)
// ---------------------------------------------------------------------------

export function useAnalyzeZoneamentoPdf() {
  return useMutation({
    mutationFn: (params: AnalyzePdfParams) =>
      callZoneamento<AnalyzePdfResult>({ action: "analyze_pdf", params }),
  });
}

// ---------------------------------------------------------------------------
// US-125: Análise manual (dados tipados)
// ---------------------------------------------------------------------------

export function useAnalyzeZoneamentoManual() {
  return useMutation({
    mutationFn: (params: AnalyzeManualParams) =>
      callZoneamento<AnalyzeManualResult>({ action: "analyze_manual", params }),
  });
}

// ---------------------------------------------------------------------------
// Recuperar zoneamento cacheado
// ---------------------------------------------------------------------------

export function useGetZoning() {
  return useMutation({
    mutationFn: (params: GetZoningParams) =>
      callZoneamento<GetZoningResult>({ action: "get_zoning", params }),
  });
}

// ---------------------------------------------------------------------------
// Listar análises de zoneamento
// ---------------------------------------------------------------------------

export function useListZonings() {
  return useMutation({
    mutationFn: (params: ListZoningsParams) =>
      callZoneamento<ListZoningsResult>({ action: "list_zonings", params }),
  });
}
