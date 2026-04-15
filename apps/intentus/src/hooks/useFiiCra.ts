/**
 * useFiiCra — Bloco H Sprint 5
 *
 * Hooks para simulação FII/CRA:
 *   - useSimulateFii        → Simula constituição de FII
 *   - useSimulateCriCra     → Simula securitização CRI/CRA
 *   - useCompareStructures  → Compara FII vs CRI/CRA
 *   - useListSimulations    → Lista simulações salvas
 *
 * Sessão 145 — Bloco H Sprint 5 (US-134/135)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  SimulateFiiRequest,
  SimulateFiiResult,
  SimulateCriCraRequest,
  SimulateCriCraResult,
  CompareStructuresRequest,
  CompareStructuresResult,
  ListSimulationsRequest,
  ListSimulationsResult,
} from "@/lib/parcelamento/fii-cra-types";

// ---------------------------------------------------------------------------
// Helper genérico
// ---------------------------------------------------------------------------

async function callFiiCra<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("fii-cra-simulator", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar fii-cra-simulator");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-134: Simular FII
// ---------------------------------------------------------------------------

export function useSimulateFii() {
  return useMutation({
    mutationFn: (params: SimulateFiiRequest) =>
      callFiiCra<SimulateFiiResult>({ action: "simulate_fii", params }),
  });
}

// ---------------------------------------------------------------------------
// US-135: Simular CRI/CRA
// ---------------------------------------------------------------------------

export function useSimulateCriCra() {
  return useMutation({
    mutationFn: (params: SimulateCriCraRequest) =>
      callFiiCra<SimulateCriCraResult>({ action: "simulate_cri_cra", params }),
  });
}

// ---------------------------------------------------------------------------
// Comparar FII vs CRI/CRA
// ---------------------------------------------------------------------------

export function useCompareStructures() {
  return useMutation({
    mutationFn: (params: CompareStructuresRequest) =>
      callFiiCra<CompareStructuresResult>({ action: "compare_structures", params }),
  });
}

// ---------------------------------------------------------------------------
// Listar simulações
// ---------------------------------------------------------------------------

export function useListSimulations() {
  return useMutation({
    mutationFn: (params: ListSimulationsRequest) =>
      callFiiCra<ListSimulationsResult>({ action: "list_simulations", params }),
  });
}
