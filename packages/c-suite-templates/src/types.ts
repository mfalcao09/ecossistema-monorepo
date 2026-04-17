/**
 * @ecossistema/c-suite-templates — tipos canônicos V9
 */

export type BusinessId = 'fic' | 'klesis' | 'intentus' | 'splendori' | 'nexvy' | 'ecosystem';

export type Variant = 'educacao' | 'imobiliario' | 'saas';

export type CSuiteRole =
  | 'ceo' | 'cfo' | 'cao' | 'cmo' | 'cso' | 'clo' | 'coo' | 'cto' | 'cpo' | 'chro';

export type DirectorRole =
  | 'd-estrategia' | 'd-sinergia' | 'd-infra' | 'd-memoria' | 'd-governanca' | 'd-relacionamento';

export type AgentRole = CSuiteRole | DirectorRole;

export type AgentModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001';

export type PermissionMode = 'default' | 'dangerouslySkipPermissions';

/** Config gerado pelo CLI e salvo em agent.config.yaml */
export interface AgentConfig {
  agent_id: string;
  name: string;
  role: AgentRole;
  business_id: BusinessId;
  variant?: Variant;
  model: AgentModel;
  permission_mode: PermissionMode;
  supabase_project: string;

  prompt: {
    base: string;        // path para base-prompt.md do template
    variant?: string;    // path para variant.md (relativo ao targetDir)
    evolved_config_path: string;
  };

  hooks: string;         // path para hooks.ts do template
  skills: string;        // path para skills.yaml do template

  mcps: string[];
}

/** Opções para o instantiador */
export interface InstantiateOptions {
  business: BusinessId;
  role: AgentRole;
  variant?: Variant;
  targetDir?: string;    // override do diretório destino
}

/** Resultado da instanciação */
export interface InstantiateResult {
  targetDir: string;
  agentId: string;
  filesCreated: string[];
}

/** Mapa de business → variant automático */
export const BUSINESS_VARIANT_MAP: Record<BusinessId, Variant> = {
  fic: 'educacao',
  klesis: 'educacao',
  intentus: 'imobiliario',
  splendori: 'imobiliario',
  nexvy: 'saas',
  ecosystem: 'educacao', // fallback
};

/** Mapa de business → Supabase project ID */
export const BUSINESS_SUPABASE_MAP: Record<BusinessId, string> = {
  fic: 'ifdnjieklngcfodmtied',
  klesis: 'ifdnjieklngcfodmtied',    // compartilha ERP-FIC por ora
  intentus: 'bvryaohkicnzkhpocftf',
  splendori: 'af-desenvolvimento',
  nexvy: 'a-criar',
  ecosystem: 'gqckbunsfjgerbuiyzvn',
};

/** MCPs padrão por role */
export const DEFAULT_MCPS_CSUITE = ['supabase-mcp', 'credential-mcp', 'memory-mcp'];
export const DEFAULT_MCPS_DIRECTOR = ['supabase-mcp', 'credential-mcp', 'memory-mcp', 'audit-mcp'];
