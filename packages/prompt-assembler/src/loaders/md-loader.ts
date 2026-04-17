import { resolve } from 'node:path';
import { readFileSafe, sha256 } from '../utils.js';
import {
  ConstitutionTamperedError,
  EvolvedConfigMissingError,
} from '../types.js';

/**
 * Lê um arquivo MD arbitrário. Retorna "" se ausente (graceful).
 * Use `loadMdRequired` quando o arquivo for obrigatório.
 */
export function loadMd(path: string): string {
  const content = readFileSafe(path);
  return content ?? '';
}

export function loadMdRequired(path: string): string {
  const content = readFileSafe(path);
  if (content === null) throw new EvolvedConfigMissingError(path);
  return content;
}

/**
 * Carrega um arquivo imutável (constitution.md) validando seu
 * SHA-256 contra um hash canônico. Se o arquivo foi alterado fora
 * do processo de governança, lança ConstitutionTamperedError.
 *
 * Se `expectedHash` for undefined, retorna o conteúdo + computa o
 * hash (modo "first run" / calibração). Caller é responsável por
 * persistir e passar o hash nas próximas chamadas.
 */
export function loadImmutable(
  path: string,
  expectedHash?: string,
): { content: string; hash: string } {
  const content = readFileSafe(path);
  if (content === null) throw new EvolvedConfigMissingError(path);

  const actualHash = sha256(content);
  if (expectedHash && actualHash !== expectedHash) {
    throw new ConstitutionTamperedError(path, expectedHash, actualHash);
  }
  return { content, hash: actualHash };
}

/**
 * Estratégias são a sub-pasta strategies/ com 3 arquivos MD conhecidos.
 * Retorna blob concatenado e ordenado (para estabilidade de cache).
 */
const STRATEGY_FILES = [
  'task-patterns.md',
  'tool-preferences.md',
  'error-recovery.md',
] as const;

export function loadStrategies(dir: string): string {
  const parts: string[] = [];
  for (const file of STRATEGY_FILES) {
    const content = readFileSafe(resolve(dir, file));
    if (content) {
      parts.push(`### ${file.replace(/\.md$/, '')}\n\n${content.trim()}`);
    }
  }
  return parts.join('\n\n');
}

/**
 * Computa um hash agregado do evolved config completo da pasta.
 * Usado em meta.evolved_config_version para rollback/auditoria.
 */
export function evolvedConfigHash(evolvedPath: string): string {
  const files = [
    'constitution.md',
    'persona.md',
    'user-profile.md',
    'domain-knowledge.md',
    'strategies/task-patterns.md',
    'strategies/tool-preferences.md',
    'strategies/error-recovery.md',
  ];
  const agg = files
    .map((f) => `${f}:${sha256(readFileSafe(resolve(evolvedPath, f)) ?? '')}`)
    .join('|');
  return sha256(agg);
}
