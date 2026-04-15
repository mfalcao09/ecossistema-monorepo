/**
 * @ecossistema/memory
 *
 * Cliente canônico do ecosystem_memory no Supabase ECOSYSTEM.
 * Responsável pela implementação completa: Sessão A (docs/sessions/BRIEFING-SESSAO-A-memory.md)
 *
 * API mínima esperada (a completar na Sessão A):
 *   - saveMemory()
 *   - searchMemory()
 *   - listMemory()
 *   - bootstrapSession()
 */

export type MemoryType = 'context' | 'decision' | 'feedback' | 'project' | 'reference' | 'user';

export interface SaveMemoryInput {
  type: MemoryType;
  title: string;
  content: string;
  project?: string;
  tags?: string[];
  actor?: string;
  sessionId?: string;
  parentEventId?: string;
  successScore?: number;
}

// STUB — Sessão A implementa
export async function saveMemory(_input: SaveMemoryInput): Promise<{ id: string }> {
  throw new Error('Not implemented — Sessão A deve completar (ver BRIEFING-SESSAO-A-memory.md)');
}

export async function searchMemory(_query: string, _opts?: { project?: string; limit?: number }) {
  throw new Error('Not implemented — Sessão A');
}

export async function bootstrapSession(_taskDescription: string, _project?: string, _k = 10) {
  throw new Error('Not implemented — Sessão A');
}
