/**
 * Tipos do Phantom 9-Layer Prompt Assembler.
 *
 * Cada agente (C-Suite, Diretor) carrega um `AgentConfig` +
 * contexto dinâmico por query (`QueryContext`). O assembler
 * produz um `AssembledPrompt` com o system prompt em 9 camadas
 * + metadados de versão/tamanho.
 */

export type BusinessId =
  | 'ecosystem'
  | 'fic'
  | 'klesis'
  | 'intentus'
  | 'splendori'
  | 'nexvy';

export interface AgentConfig {
  /** Identificador único curto (ex: "cfo-fic") */
  agent_id: string;
  /** Nome apresentável (ex: "CFO-IA FIC") */
  name: string;
  /** Cargo (ex: "Chief Financial Officer (IA)") */
  title: string;
  /** Descrição curta do agente */
  description: string;
  /** Slug do template YAML em templates/roles/ (ex: "cfo-ia") */
  role: string;
  /** Negócio ao qual pertence */
  business_id?: BusinessId;
  /** Projeto Supabase principal do agente */
  supabase_project?: string;
  /** Modelo LLM (ex: "claude-sonnet-4-6") */
  model: string;
  /** Path absoluto ou relativo para a pasta de evolved config */
  evolved_config_path: string;
  /** Nome do superior hierárquico (default: Marcelo via Claudinho) */
  reports_to?: string;
  /** Variante opcional do role (ex: "educacao" em cfo-ia) */
  role_variant?: string;
}

export interface QueryContext {
  /** Query do usuário na turn atual. Opcional para background tasks */
  query?: string;
  /** ID do usuário (obrigatório para filtrar memória) */
  user_id: string;
  /** ID da sessão em curso */
  session_id: string;
  /** Primeiro contato do agente com o usuário → onboarding layer */
  is_first_run?: boolean;
  /** Tools habilitadas nesta sessão */
  available_tools: string[];
  /** MCP servers conectados */
  available_mcps: string[];
  /** Ambiente de execução: "dev" | "staging" | "prod" */
  environment?: string;
  /**
   * Phantom preset flag — quando true, camadas dinâmicas
   * (memory context e partes de environment com timestamp) são
   * omitidas do system prompt para permitir prompt-cache-hit
   * entre usuários/sessões. O conteúdo dinâmico deve então ser
   * re-injetado na PRIMEIRA mensagem de user.
   */
  exclude_dynamic_sections?: boolean;
}

export interface RecallFilters {
  user_id: string;
  agent_id: string;
  business_id?: string;
  run_id?: string;
}

export interface Memory {
  id?: string;
  type: 'episodic' | 'semantic' | 'procedural' | string;
  importance: number;
  summary: string;
  [key: string]: unknown;
}

export interface RecallArgs {
  query: string;
  filters: RecallFilters;
  limit: number;
}

export type RecallFn = (args: RecallArgs) => Promise<Memory[]>;

export interface AssemblerDeps {
  recall?: RecallFn;
  /** Override do "now" para testes determinísticos */
  now?: () => Date;
}

export type LayerName =
  | 'identity'
  | 'environment'
  | 'security'
  | 'role'
  | 'onboarding'
  | 'evolved_config'
  | 'memory_instructions'
  | 'instructions'
  | 'memory_context';

export interface AssembledPrompt {
  system_prompt: string;
  meta: {
    agent_id: string;
    business_id?: BusinessId;
    assembled_at: string;
    layers_included: number;
    layer_sizes: Record<LayerName, number>;
    evolved_config_version: string;
    exclude_dynamic_sections: boolean;
  };
}

/** ---- Role template YAML ---- */

export interface RoleDecisionBoundaries {
  autonomous_actions?: string[];
  requires_approval?: string[];
}

export interface RoleTemplate {
  role: string;
  mission: string;
  responsibilities?: string[];
  decision_boundaries?: RoleDecisionBoundaries;
  kpis?: string[];
  /** Variantes sobrepõem campos base (ex: educacao) */
  variants?: Record<string, Partial<RoleTemplate>>;
}

/** ---- Errors ---- */

export class ConstitutionTamperedError extends Error {
  constructor(
    public readonly path: string,
    public readonly expectedHash: string,
    public readonly actualHash: string,
  ) {
    super(
      `Constitution file tampered at ${path}. Expected SHA-256 ${expectedHash}, got ${actualHash}. ` +
        `Use the governance process to update the canonical hash before modifying.`,
    );
    this.name = 'ConstitutionTamperedError';
  }
}

export class RoleTemplateNotFoundError extends Error {
  constructor(public readonly role: string, public readonly path: string) {
    super(`Role template "${role}" not found at ${path}`);
    this.name = 'RoleTemplateNotFoundError';
  }
}

export class EvolvedConfigMissingError extends Error {
  constructor(public readonly path: string) {
    super(`Evolved config file missing: ${path}`);
    this.name = 'EvolvedConfigMissingError';
  }
}
