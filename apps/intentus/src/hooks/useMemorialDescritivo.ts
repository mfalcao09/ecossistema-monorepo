/**
 * useMemorialDescritivo — Bloco H Sprint 5
 *
 * Hooks para Memorial Descritivo (Lei 6.015/73):
 *   - useGenerateMemorial   → Gera memorial descritivo via Gemini
 *   - useGetMemorial        → Retorna memorial por ID
 *   - useListMemorials      → Lista memoriais de um development
 *
 * Sessão 145 — Bloco H Sprint 5 (US-130)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  GenerateMemorialParams,
  GenerateMemorialResult,
  GetMemorialParams,
  GetMemorialResult,
  ListMemorialsParams,
  ListMemorialsResult,
} from "@/lib/parcelamento/memorial-descritivo-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callMemorial<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("memorial-descritivo", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar memorial-descritivo");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-130: Gerar memorial descritivo
// ---------------------------------------------------------------------------

export function useGenerateMemorial() {
  return useMutation({
    mutationFn: (params: GenerateMemorialParams) =>
      callMemorial<GenerateMemorialResult>({ action: "generate", params }),
  });
}

// ---------------------------------------------------------------------------
// Buscar memorial por ID
// ---------------------------------------------------------------------------

export function useGetMemorial() {
  return useMutation({
    mutationFn: (params: GetMemorialParams) =>
      callMemorial<GetMemorialResult>({ action: "get_memorial", params }),
  });
}

// ---------------------------------------------------------------------------
// Listar memoriais de um development
// ---------------------------------------------------------------------------

export function useListMemorials() {
  return useMutation({
    mutationFn: (params: ListMemorialsParams) =>
      callMemorial<ListMemorialsResult>({ action: "list_memorials", params }),
  });
}
