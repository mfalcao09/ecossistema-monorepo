import {
  AgentConfig,
  AssembledPrompt,
  AssemblerDeps,
  LayerName,
  QueryContext,
} from './types.js';
import { byteSize, collapseBlankLines, LAYER_SEPARATOR } from './utils.js';
import { identityLayer } from './layers/01-identity.js';
import { environmentLayer } from './layers/02-environment.js';
import { securityLayer } from './layers/03-security.js';
import { roleLayer } from './layers/04-role.js';
import { onboardingLayer } from './layers/05-onboarding.js';
import {
  evolvedConfigLayer,
  EvolvedConfigOptions,
} from './layers/06-evolved-config.js';
import { memoryInstructionsLayer } from './layers/07-memory-instructions.js';
import { instructionsLayer } from './layers/08-instructions.js';
import { memoryContextLayer } from './layers/09-memory-context.js';
import { evolvedConfigHash } from './loaders/md-loader.js';

export * from './types.js';
export { ROLE_TEMPLATES_DIR } from './loaders/yaml-loader.js';

export interface AssembleOptions extends EvolvedConfigOptions {
  /** Diretório alternativo para templates/roles (testing). */
  roleTemplatesDir?: string;
}

/**
 * Monta o system prompt em 9 camadas phantom.
 *
 * Camadas que retornam string vazia são filtradas antes do join —
 * isso mantém o output limpo e ajuda debug do `layer_sizes`.
 */
export async function assemble(
  config: AgentConfig,
  context: QueryContext,
  deps: AssemblerDeps = {},
  opts: AssembleOptions = {},
): Promise<AssembledPrompt> {
  const l1 = identityLayer(config);
  const l2 = environmentLayer(config, context, deps);
  const l3 = securityLayer();
  const l4 = roleLayer(config, { baseDir: opts.roleTemplatesDir });
  const l5 = onboardingLayer(context);
  const l6 = evolvedConfigLayer(config, {
    constitutionExpectedHash: opts.constitutionExpectedHash,
  });
  const l7 = memoryInstructionsLayer();
  const l8 = instructionsLayer(config);
  const l9 = await memoryContextLayer(config, context, deps);

  const layerEntries: [LayerName, string][] = [
    ['identity', l1],
    ['environment', l2],
    ['security', l3],
    ['role', l4],
    ['onboarding', l5],
    ['evolved_config', l6],
    ['memory_instructions', l7],
    ['instructions', l8],
    ['memory_context', l9],
  ];

  const nonEmpty = layerEntries.filter(([, v]) => v.trim().length > 0);
  const systemPrompt = collapseBlankLines(
    nonEmpty.map(([, v]) => v).join(LAYER_SEPARATOR),
  );

  const layerSizes = Object.fromEntries(
    layerEntries.map(([k, v]) => [k, byteSize(v)]),
  ) as Record<LayerName, number>;

  const now = deps.now ? deps.now() : new Date();

  return {
    system_prompt: systemPrompt,
    meta: {
      agent_id: config.agent_id,
      business_id: config.business_id,
      assembled_at: now.toISOString(),
      layers_included: nonEmpty.length,
      layer_sizes: layerSizes,
      evolved_config_version: evolvedConfigHash(config.evolved_config_path),
      exclude_dynamic_sections: context.exclude_dynamic_sections ?? false,
    },
  };
}
