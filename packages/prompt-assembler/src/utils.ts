import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** SHA-256 hex de um buffer/string. */
export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Lê um arquivo utf-8 ou retorna null se não existir. */
export function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Byte-size de uma string tal qual será enviada ao LLM (utf-8).
 * Útil para o meta.layer_sizes do AssembledPrompt.
 */
export function byteSize(s: string): number {
  return Buffer.byteLength(s, 'utf-8');
}

/** Remove linhas vazias duplicadas e trims finais. */
export function collapseBlankLines(s: string): string {
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Separador canônico entre camadas.
 * Mantido em constante para estabilidade de cache.
 */
export const LAYER_SEPARATOR = '\n\n---\n\n';
