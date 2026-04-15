/**
 * useCriMatricula — Bloco H Sprint 5
 *
 * Hooks para consulta de matrícula CRI:
 *   - useRegisterMatricula   → Registra matrícula manualmente
 *   - useGetMatricula        → Busca matrícula por ID
 *   - useListMatriculas      → Lista matrículas de um development
 *   - useValidateMatricula   → Valida formato da matrícula
 *
 * Sessão 145 — Bloco H Sprint 5 (US-133)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  RegisterMatriculaRequest,
  RegisterMatriculaResult,
  GetMatriculaRequest,
  GetMatriculaResult,
  ListMatriculasRequest,
  ListMatriculasResult,
  ValidateMatriculaRequest,
  ValidateMatriculaResult,
} from "@/lib/parcelamento/cri-matricula-types";

// ---------------------------------------------------------------------------
// Helper genérico
// ---------------------------------------------------------------------------

async function callCri<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cri-matricula", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Erro ao chamar cri-matricula");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Registrar matrícula
// ---------------------------------------------------------------------------

export function useRegisterMatricula() {
  return useMutation({
    mutationFn: (params: RegisterMatriculaRequest) =>
      callCri<RegisterMatriculaResult>({ action: "register_matricula", params }),
  });
}

// ---------------------------------------------------------------------------
// Buscar matrícula por ID
// ---------------------------------------------------------------------------

export function useGetMatricula() {
  return useMutation({
    mutationFn: (params: GetMatriculaRequest) =>
      callCri<GetMatriculaResult>({ action: "get_matricula", params }),
  });
}

// ---------------------------------------------------------------------------
// Listar matrículas
// ---------------------------------------------------------------------------

export function useListMatriculas() {
  return useMutation({
    mutationFn: (params: ListMatriculasRequest) =>
      callCri<ListMatriculasResult>({ action: "list_matriculas", params }),
  });
}

// ---------------------------------------------------------------------------
// Validar formato da matrícula
// ---------------------------------------------------------------------------

export function useValidateMatricula() {
  return useMutation({
    mutationFn: (params: ValidateMatriculaRequest) =>
      callCri<ValidateMatriculaResult>({ action: "validate_matricula", params }),
  });
}
