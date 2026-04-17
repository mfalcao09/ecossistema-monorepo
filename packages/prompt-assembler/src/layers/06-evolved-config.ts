import { resolve } from 'node:path';
import { AgentConfig } from '../types.js';
import {
  loadImmutable,
  loadMd,
  loadMdRequired,
  loadStrategies,
} from '../loaders/md-loader.js';

export interface EvolvedConfigOptions {
  /**
   * Hash SHA-256 esperado para constitution.md. Se fornecido, valida
   * imutabilidade e lança ConstitutionTamperedError em divergência.
   */
  constitutionExpectedHash?: string;
}

/**
 * L6 — Evolved config: constituição + persona + user-profile +
 * domain-knowledge + strategies. Arquivos MD versionados no git.
 */
export function evolvedConfigLayer(
  config: AgentConfig,
  opts: EvolvedConfigOptions = {},
): string {
  const base = config.evolved_config_path;

  const { content: constitution } = loadImmutable(
    resolve(base, 'constitution.md'),
    opts.constitutionExpectedHash,
  );
  const persona = loadMdRequired(resolve(base, 'persona.md'));
  const userProfile = loadMdRequired(resolve(base, 'user-profile.md'));
  const domainKnowledge = loadMd(resolve(base, 'domain-knowledge.md'));
  const strategies = loadStrategies(resolve(base, 'strategies'));

  const parts = [
    '## Configuração Evoluída',
    '',
    '### Constituição (22 Artigos)',
    '',
    constitution.trim(),
    '',
    '### Persona',
    '',
    persona.trim(),
    '',
    '### Profile do Usuário',
    '',
    userProfile.trim(),
  ];

  if (domainKnowledge.trim()) {
    parts.push('', '### Domain Knowledge', '', domainKnowledge.trim());
  }
  if (strategies.trim()) {
    parts.push('', '### Estratégias', '', strategies.trim());
  }

  return parts.join('\n');
}
