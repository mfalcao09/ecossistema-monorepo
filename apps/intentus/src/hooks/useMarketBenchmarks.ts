/**
 * useMarketBenchmarks — Bloco H Sprint 2
 *
 * Hooks para benchmarks de mercado imobiliário brasileiro:
 *   - useFetchSinapi      → Catálogo SINAPI de custos (US-121)
 *   - useFetchSecovi      → Benchmarks SECOVI de preços e IVV (US-122)
 *   - useFetchAbrainc     → Indicadores ABRAINC de lançamentos (US-123)
 *
 * Todos usam a EF market-benchmarks (multi-action).
 *
 * Sessão 142 — Bloco H Sprint 2
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  SinapiRequest,
  SinapiResult,
  SecoviRequest,
  SecoviResult,
  AbraincRequest,
  AbraincResult,
} from "@/lib/parcelamento/market-benchmarks-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callMarketBenchmarks<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("market-benchmarks", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar market-benchmarks");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-121: SINAPI
// ---------------------------------------------------------------------------

export function useFetchSinapi() {
  return useMutation({
    mutationFn: (args: Omit<SinapiRequest, "action">) =>
      callMarketBenchmarks<SinapiResult>({ action: "fetch_sinapi", ...args }),
  });
}

// ---------------------------------------------------------------------------
// US-122: SECOVI
// ---------------------------------------------------------------------------

export function useFetchSecovi() {
  return useMutation({
    mutationFn: (args: Omit<SecoviRequest, "action">) =>
      callMarketBenchmarks<SecoviResult>({ action: "fetch_secovi", ...args }),
  });
}

// ---------------------------------------------------------------------------
// US-123: ABRAINC
// ---------------------------------------------------------------------------

export function useFetchAbrainc() {
  return useMutation({
    mutationFn: (args: Omit<AbraincRequest, "action">) =>
      callMarketBenchmarks<AbraincResult>({ action: "fetch_abrainc", ...args }),
  });
}
