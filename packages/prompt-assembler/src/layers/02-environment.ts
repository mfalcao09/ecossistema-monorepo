import { AgentConfig, QueryContext, AssemblerDeps } from '../types.js';

/**
 * L2 — Ambiente de execução.
 *
 * Quando `exclude_dynamic_sections` é true, o timestamp é omitido
 * para permitir prompt-cache-hit entre sessões. O restante (modelo,
 * Supabase, MCPs, tools) é considerado estável o bastante para o
 * horizonte de uma sessão cacheável.
 */
export function environmentLayer(
  config: AgentConfig,
  ctx: QueryContext,
  deps: AssemblerDeps = {},
): string {
  const mcps =
    ctx.available_mcps.length > 0 ? ctx.available_mcps.join(', ') : 'nenhum';
  const tools =
    ctx.available_tools.length > 0
      ? ctx.available_tools.join(', ')
      : 'nenhuma';
  const env = ctx.environment ?? process.env.ENV ?? 'dev';

  const lines = [
    '## Ambiente',
    '',
    `- Modelo: ${config.model} (via LiteLLM proxy)`,
    `- Supabase: ${config.supabase_project ?? 'não configurado'}`,
    `- MCPs disponíveis: ${mcps}`,
    `- Tools habilitadas: ${tools}`,
    `- Ambiente: ${env}`,
  ];

  if (!ctx.exclude_dynamic_sections) {
    const now = deps.now ? deps.now() : new Date();
    lines.push(`- Data/hora: ${now.toISOString()}`);
  }

  return lines.join('\n');
}
