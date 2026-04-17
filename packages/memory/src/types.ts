/**
 * @ecossistema/memory — types
 *
 * V9 §40 (schema cross-db) + §32 (pgvector 3-tier) + §27 (Mem0 ADD-only).
 */

export type MemoryTier = "episodic" | "semantic" | "procedural";

export type EpisodicType = "task" | "conversation" | "decision" | "incident";
export type Outcome = "success" | "failure" | "partial" | "in_progress";

/**
 * Filters estritos (Mem0 pattern).
 * `agent_id` e `business_id` são OBRIGATÓRIOS para impedir vazamento cross-agent / cross-business.
 */
export interface StrictFilters {
  agent_id: string;
  business_id: string;
  user_id?: string;
  run_id?: string;
}

export interface AddRequestBase {
  filters: StrictFilters;
  /**
   * Se informado, o cliente NÃO chamará o provider de embedding.
   * Útil para testes e para reuso de vetores pré-computados.
   */
  precomputedEmbedding?: number[] | null;
  metadata?: Record<string, unknown>;
}

export interface AddEpisodicRequest extends AddRequestBase {
  type: "episodic";
  episodicType: EpisodicType;
  summary: string;
  detail?: string;
  outcome?: Outcome;
  tools_used?: string[];
  files_touched?: string[];
  entities?: string[];
  importance?: number;
  run_id?: string;
  parent_id?: string;
  started_at?: string;
  ended_at?: string;
}

export interface AddSemanticRequest extends AddRequestBase {
  type: "semantic";
  /**
   * Triple atômico. Se somente `natural_language` for fornecido, o cliente
   * cairá num extractor simples (heurístico) — fica a cargo do chamador
   * passar uma versão LLM-extraída para maior qualidade.
   */
  subject?: string;
  predicate?: string;
  object?: string;
  natural_language: string;
  confidence?: number;
  source_episodic_id?: string;
}

export interface AddProceduralRequest extends AddRequestBase {
  type: "procedural";
  name: string;
  description?: string;
  steps: ProceduralStep[];
  preconditions?: unknown[];
  postconditions?: unknown[];
  tags?: string[];
  version?: number;
}

export interface ProceduralStep {
  tool: string;
  input_schema?: Record<string, unknown>;
  expected_output?: Record<string, unknown>;
  retry_policy?: { max_attempts?: number; backoff_ms?: number };
}

export type AddRequest =
  | AddEpisodicRequest
  | AddSemanticRequest
  | AddProceduralRequest;

export interface AddResult {
  id: string | null;
  action: "added" | "superseded" | "skipped" | "degraded";
  degraded?: boolean;
  notes?: string;
}

export interface RecallOptions {
  dense_weight?: number;
  sparse_weight?: number;
  entity_boost_weight?: number;
  /** RRF k parameter. Default 60 (padrão da literatura). */
  rrf_k?: number;
  /** Se `true`, atualiza `access_count`/`last_accessed` para hits episódicos. */
  bumpAccess?: boolean;
}

export interface RecallRequest {
  query: string;
  filters: StrictFilters;
  tiers?: MemoryTier[] | "all";
  limit?: number;
  options?: RecallOptions;
  /** Limita busca semantic a fatos não-supersedidos. Default true. */
  onlyValidSemantic?: boolean;
  /** Limita busca episodic a tipos (task, conversation, etc.). */
  episodicTypes?: EpisodicType[];
}

export interface MemoryHit {
  id: string;
  tier: MemoryTier;
  score: number;
  /** Scores individuais por canal (debug / tuning). */
  scores: {
    dense: number;
    sparse: number;
    entity: number;
  };
  /** Payload denormalizado — varia por tier. */
  payload: Record<string, unknown>;
}

export interface ContradictRequest {
  old_id: string;
  new_content: string;
  new_triple?: {
    subject: string;
    predicate: string;
    object: string;
  };
  filters: StrictFilters;
  metadata?: Record<string, unknown>;
}

export interface EpisodicTaskAdd {
  summary: string;
  outcome: Outcome;
  tools_used?: string[];
  files_touched?: string[];
  detail?: string;
  importance?: number;
  run_id?: string;
  parent_id?: string;
  entities?: string[];
  filters: StrictFilters;
  metadata?: Record<string, unknown>;
}

export interface ProceduralRegisterInput {
  name: string;
  description?: string;
  steps: ProceduralStep[];
  preconditions?: unknown[];
  postconditions?: unknown[];
  tags?: string[];
  version?: number;
  filters: StrictFilters;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[] | null>;
  isAvailable(): Promise<boolean>;
}

export interface MemoryConfig {
  supabaseUrl: string;
  supabaseKey: string;
  /** `gemini` (default, requer GEMINI_API_KEY ou config.geminiApiKey) ou `none` (degraded forçado). */
  embeddingProvider?: "gemini" | "none" | EmbeddingProvider;
  geminiApiKey?: string;
  /** Se `true` (default), erros são suprimidos: add retorna {id:null,degraded:true}; recall retorna []. */
  degradedMode?: boolean;
  /** Logger custom. Default: console. */
  logger?: MemoryLogger;
  /**
   * Dimensão esperada do embedding. Deve casar com o schema (768 atualmente).
   * Se o provider retornar outra dimensão, a inserção é feita com vec=null e log de warning.
   */
  embeddingDimensions?: number;
}

export interface MemoryLogger {
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug?(msg: string, meta?: Record<string, unknown>): void;
}
