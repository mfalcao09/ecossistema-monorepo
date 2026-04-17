/**
 * @ecossistema/memory
 *
 * Cliente canônico das tabelas `memory_episodic`, `memory_semantic` e
 * `memory_procedural` no Supabase ECOSYSTEM. Referência: V9 §32/§40.
 *
 * Ver README.md para guia completo.
 */

export { MemoryClient } from "./client.js";
export { FilterValidationError, validateFilters } from "./filters/strict-filters.js";
export { reciprocalRankFusion } from "./retrieval/rrf.js";
export {
  entityOverlapScore,
  extractEntities,
} from "./retrieval/entity-boost.js";
export { GeminiEmbeddingProvider } from "./embeddings/gemini.js";
export { NullEmbeddingProvider } from "./embeddings/fallback.js";
export { createArtXXIIMemoryAdapter } from "./adapters/art-xxii.js";
export type {
  AddEpisodicRequest,
  AddProceduralRequest,
  AddRequest,
  AddResult,
  AddSemanticRequest,
  ContradictRequest,
  EmbeddingProvider,
  EpisodicTaskAdd,
  EpisodicType,
  MemoryConfig,
  MemoryHit,
  MemoryLogger,
  MemoryTier,
  Outcome,
  ProceduralRegisterInput,
  ProceduralStep,
  RecallOptions,
  RecallRequest,
  StrictFilters,
} from "./types.js";
