/**
 * @ecossistema/c-suite-templates
 *
 * Templates reutilizáveis de C-Suite e Diretores de Área.
 * Cada negócio herda base + variant + evolved-config-seed.
 *
 * Uso:
 *   import { generate, instantiate } from '@ecossistema/c-suite-templates';
 *   await generate({ business: 'fic', role: 'cfo', verbose: true });
 *
 * CLI:
 *   pnpm create-csuite-agent --business fic --role cfo
 */

export { instantiate } from './instantiator.js';
export { generate, listTemplates } from './generator.js';

export type {
  AgentConfig,
  AgentRole,
  BusinessId,
  CSuiteRole,
  DirectorRole,
  InstantiateOptions,
  InstantiateResult,
  PermissionMode,
  Variant,
} from './types.js';

export {
  BUSINESS_SUPABASE_MAP,
  BUSINESS_VARIANT_MAP,
  DEFAULT_MCPS_CSUITE,
  DEFAULT_MCPS_DIRECTOR,
} from './types.js';
