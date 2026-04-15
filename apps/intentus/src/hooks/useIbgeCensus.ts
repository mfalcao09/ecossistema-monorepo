/**
 * useIbgeCensus — Bloco H Sprint 3
 *
 * Hooks para dados censitários do IBGE:
 *   - useFetchCensusIncome       → Renda por setor censitário (US-124)
 *   - useFetchCensusDemographics → Demografia municipal
 *   - useFetchCensusHousing      → Dados de domicílios
 *
 * Todos usam a EF ibge-census (multi-action).
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CensusIncomeRequest,
  CensusIncomeResult,
  CensusDemographicsRequest,
  CensusDemographicsResult,
  CensusHousingRequest,
  CensusHousingResult,
} from "@/lib/parcelamento/ibge-census-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callIbgeCensus<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ibge-census", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar ibge-census");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-124: Renda por Setor Censitário
// ---------------------------------------------------------------------------

export function useFetchCensusIncome() {
  return useMutation({
    mutationFn: (args: Omit<CensusIncomeRequest, "action">) =>
      callIbgeCensus<CensusIncomeResult>({ action: "fetch_census_income", ...args }),
  });
}

// ---------------------------------------------------------------------------
// Demografia
// ---------------------------------------------------------------------------

export function useFetchCensusDemographics() {
  return useMutation({
    mutationFn: (args: Omit<CensusDemographicsRequest, "action">) =>
      callIbgeCensus<CensusDemographicsResult>({ action: "fetch_census_demographics", ...args }),
  });
}

// ---------------------------------------------------------------------------
// Domicílios
// ---------------------------------------------------------------------------

export function useFetchCensusHousing() {
  return useMutation({
    mutationFn: (args: Omit<CensusHousingRequest, "action">) =>
      callIbgeCensus<CensusHousingResult>({ action: "fetch_census_housing", ...args }),
  });
}
