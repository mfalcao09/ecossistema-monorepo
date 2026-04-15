/**
 * useBrazilRegulations — Bloco H Sprint 1
 *
 * Hooks para as regulações brasileiras:
 *   - useCalcItbi          → Calcula ITBI estimado (US-127)
 *   - useCalcOutorga       → Calcula Outorga Onerosa (US-128)
 *   - useCheckLeiVerde     → Verifica Lei do Verde (US-129)
 *   - useValidateCnpjSpe   → Valida CNPJ de incorporador/SPE (US-132)
 *
 * Todos usam a EF brazil-regulations (multi-action).
 *
 * Sessão 141 — Bloco H Sprint 1
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ItbiRequest,
  ItbiResult,
  OutorgaRequest,
  OutorgaResult,
  LeiVerdeRequest,
  LeiVerdeResult,
  ValidateCnpjRequest,
  CnpjSpeResult,
} from "@/lib/parcelamento/brazil-regulations-types";

// ---------------------------------------------------------------------------
// Helper genérico para chamar a EF
// ---------------------------------------------------------------------------

async function callBrazilRegulations<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("brazil-regulations", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar brazil-regulations");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// US-127: ITBI
// ---------------------------------------------------------------------------

export function useCalcItbi() {
  return useMutation({
    mutationFn: (args: Omit<ItbiRequest, "action">) =>
      callBrazilRegulations<ItbiResult>({ action: "calc_itbi", ...args }),
  });
}

// ---------------------------------------------------------------------------
// US-128: Outorga Onerosa
// ---------------------------------------------------------------------------

export function useCalcOutorga() {
  return useMutation({
    mutationFn: (args: Omit<OutorgaRequest, "action">) =>
      callBrazilRegulations<OutorgaResult>({ action: "calc_outorga", ...args }),
  });
}

// ---------------------------------------------------------------------------
// US-129: Lei do Verde
// ---------------------------------------------------------------------------

export function useCheckLeiVerde() {
  return useMutation({
    mutationFn: (args: Omit<LeiVerdeRequest, "action">) =>
      callBrazilRegulations<LeiVerdeResult>({ action: "check_lei_verde", ...args }),
  });
}

// ---------------------------------------------------------------------------
// US-132: Validação CNPJ SPE
// ---------------------------------------------------------------------------

export function useValidateCnpjSpe() {
  return useMutation({
    mutationFn: (args: Omit<ValidateCnpjRequest, "action">) =>
      callBrazilRegulations<CnpjSpeResult>({ action: "validate_cnpj_spe", ...args }),
  });
}
