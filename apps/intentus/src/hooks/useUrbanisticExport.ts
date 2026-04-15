/**
 * useUrbanisticExport — Bloco H Sprint 3
 *
 * Hooks para exportação de pré-projetos urbanísticos:
 *   - useGenerateDxf        → Gera DXF/DWG do parcelamento (US-131)
 *   - useGeneratePdfLayout  → Dados para PDF do layout
 *
 * Todos usam a EF urbanistic-project-export (multi-action).
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  GenerateDxfRequest,
  GenerateDxfResult,
  GeneratePdfLayoutRequest,
  GeneratePdfLayoutResult,
} from "@/lib/parcelamento/urbanistic-export-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callUrbanisticExport<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("urbanistic-project-export", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar urbanistic-project-export");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-131: Gerar DXF
// ---------------------------------------------------------------------------

export function useGenerateDxf() {
  return useMutation({
    mutationFn: (args: Omit<GenerateDxfRequest, "action">) =>
      callUrbanisticExport<GenerateDxfResult>({ action: "generate_dxf", ...args }),
  });
}

// ---------------------------------------------------------------------------
// PDF Layout
// ---------------------------------------------------------------------------

export function useGeneratePdfLayout() {
  return useMutation({
    mutationFn: (args: Omit<GeneratePdfLayoutRequest, "action">) =>
      callUrbanisticExport<GeneratePdfLayoutResult>({ action: "generate_pdf_layout", ...args }),
  });
}
