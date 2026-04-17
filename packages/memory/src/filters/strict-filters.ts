import type { StrictFilters } from "../types.js";

export class FilterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterValidationError";
  }
}

/**
 * Valida os filtros do Mem0-pattern: `agent_id` e `business_id` são obrigatórios.
 *
 * Invariante reforçado por MP-04 (isolation cross-business) e SC-09 (multi-tenant).
 * Qualquer erro aqui é defeito de chamada — nunca é suprimido pelo `degradedMode`.
 */
export function validateFilters(
  filters: unknown,
): asserts filters is StrictFilters {
  if (!filters || typeof filters !== "object") {
    throw new FilterValidationError("[memory] filters é obrigatório");
  }
  const f = filters as Record<string, unknown>;

  if (typeof f.agent_id !== "string" || !f.agent_id.trim()) {
    throw new FilterValidationError(
      "[memory] filters.agent_id obrigatório — evita vazamento cross-agent (MP-04)",
    );
  }
  if (typeof f.business_id !== "string" || !f.business_id.trim()) {
    throw new FilterValidationError(
      "[memory] filters.business_id obrigatório — evita vazamento cross-business (SC-09)",
    );
  }
  if (f.user_id !== undefined && typeof f.user_id !== "string") {
    throw new FilterValidationError(
      "[memory] filters.user_id deve ser string quando informado",
    );
  }
  if (f.run_id !== undefined && typeof f.run_id !== "string") {
    throw new FilterValidationError(
      "[memory] filters.run_id deve ser string quando informado",
    );
  }
}
