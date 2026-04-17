import { AgentConfig } from '../types.js';
import { loadRoleTemplate, roleTemplateToMarkdown } from '../loaders/yaml-loader.js';

/** L4 — Role template carregado de YAML e convertido em markdown. */
export function roleLayer(
  config: AgentConfig,
  opts: { baseDir?: string } = {},
): string {
  const tmpl = loadRoleTemplate(config.role, {
    baseDir: opts.baseDir,
    variant: config.role_variant,
  });
  return `## Role\n\n${roleTemplateToMarkdown(tmpl)}`;
}
