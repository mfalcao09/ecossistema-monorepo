import { parse as parseYaml } from 'yaml';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { readFileSafe } from '../utils.js';
import {
  RoleTemplate,
  RoleTemplateNotFoundError,
} from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Pasta dos templates de role (YAML) embarcados no pacote. */
export const ROLE_TEMPLATES_DIR = resolve(__dirname, '../../templates/roles');

/**
 * Resolve caminho do template para um role slug.
 * "cfo-ia" → templates/roles/cfo-ia.yaml
 * "directors/d-governanca" → templates/roles/directors/d-governanca.yaml
 */
export function resolveRolePath(role: string, baseDir = ROLE_TEMPLATES_DIR): string {
  return resolve(baseDir, `${role}.yaml`);
}

export function loadRoleTemplate(
  role: string,
  opts: { baseDir?: string; variant?: string } = {},
): RoleTemplate {
  const path = resolveRolePath(role, opts.baseDir);
  const raw = readFileSafe(path);
  if (raw === null) throw new RoleTemplateNotFoundError(role, path);

  const parsed = parseYaml(raw) as RoleTemplate;

  if (opts.variant && parsed.variants?.[opts.variant]) {
    return mergeVariant(parsed, parsed.variants[opts.variant]);
  }
  return parsed;
}

function mergeVariant(
  base: RoleTemplate,
  variant: Partial<RoleTemplate>,
): RoleTemplate {
  return {
    ...base,
    ...variant,
    responsibilities: [
      ...(base.responsibilities ?? []),
      ...(variant.responsibilities ?? []),
    ],
    kpis: [...(base.kpis ?? []), ...(variant.kpis ?? [])],
    decision_boundaries: {
      autonomous_actions: [
        ...(base.decision_boundaries?.autonomous_actions ?? []),
        ...(variant.decision_boundaries?.autonomous_actions ?? []),
      ],
      requires_approval: [
        ...(base.decision_boundaries?.requires_approval ?? []),
        ...(variant.decision_boundaries?.requires_approval ?? []),
      ],
    },
  };
}

/** Converte RoleTemplate em prose markdown para layer 4. */
export function roleTemplateToMarkdown(rt: RoleTemplate): string {
  const lines: string[] = [];
  lines.push(`**Role:** ${rt.role}`);
  lines.push('');
  lines.push(`**Missão:** ${rt.mission.trim()}`);

  if (rt.responsibilities?.length) {
    lines.push('');
    lines.push('**Responsabilidades:**');
    for (const r of rt.responsibilities) lines.push(`- ${r}`);
  }

  if (rt.decision_boundaries) {
    const { autonomous_actions, requires_approval } = rt.decision_boundaries;
    if (autonomous_actions?.length) {
      lines.push('');
      lines.push('**Ações autônomas (pode executar sem aprovação):**');
      for (const a of autonomous_actions) lines.push(`- ${a}`);
    }
    if (requires_approval?.length) {
      lines.push('');
      lines.push('**Requer aprovação humana:**');
      for (const a of requires_approval) lines.push(`- ${a}`);
    }
  }

  if (rt.kpis?.length) {
    lines.push('');
    lines.push('**KPIs monitorados:**');
    for (const k of rt.kpis) lines.push(`- ${k}`);
  }

  return lines.join('\n');
}
