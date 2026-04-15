/**
 * useEnvironmentalEmbargoes — Bloco H Sprint 3
 *
 * Hooks para consulta de embargos ambientais:
 *   - useCheckIbamaEmbargoes  → Áreas embargadas IBAMA (US-126)
 *   - useCheckICMBioEmbargoes → Unidades de conservação ICMBio
 *   - useGetEmbargoDetails    → Detalhes de embargo específico
 *
 * Todos usam a EF environmental-embargoes (multi-action).
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CheckIbamaRequest,
  CheckIbamaResult,
  CheckICMBioRequest,
  CheckICMBioResult,
  GetEmbargoDetailsRequest,
  EmbargoDetailsResult,
} from "@/lib/parcelamento/environmental-embargoes-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callEnvironmentalEmbargoes<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("environmental-embargoes", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar environmental-embargoes");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-126: IBAMA Embargos
// ---------------------------------------------------------------------------

export function useCheckIbamaEmbargoes() {
  return useMutation({
    mutationFn: (args: Omit<CheckIbamaRequest, "action">) =>
      callEnvironmentalEmbargoes<CheckIbamaResult>({ action: "check_ibama_embargoes", ...args }),
  });
}

// ---------------------------------------------------------------------------
// ICMBio — Unidades de Conservação
// ---------------------------------------------------------------------------

export function useCheckICMBioEmbargoes() {
  return useMutation({
    mutationFn: (args: Omit<CheckICMBioRequest, "action">) =>
      callEnvironmentalEmbargoes<CheckICMBioResult>({ action: "check_icmbio_embargoes", ...args }),
  });
}

// ---------------------------------------------------------------------------
// Detalhes de Embargo
// ---------------------------------------------------------------------------

export function useGetEmbargoDetails() {
  return useMutation({
    mutationFn: (args: Omit<GetEmbargoDetailsRequest, "action">) =>
      callEnvironmentalEmbargoes<EmbargoDetailsResult>({ action: "get_embargo_details", ...args }),
  });
}
