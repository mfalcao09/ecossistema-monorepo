/**
 * @ecossistema/task-registry
 *
 * Task Registry canônico — toda delegação entre agentes (Claudinho → CFO-IA, humano → Buchecha, etc.)
 * registra aqui. Permite lock otimista e auditoria cross-sessão.
 *
 * Responsável: Sessão B (docs/sessions/BRIEFING-SESSAO-B-task-registry.md)
 */

export type TaskStatus = 'pending' | 'locked' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';

export interface Task {
  taskId: string;
  title: string;
  status: TaskStatus;
  assignedTo?: string;
  project?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// STUB — Sessão B implementa
export async function createTask(_input: Omit<Task, 'taskId' | 'status' | 'createdAt' | 'updatedAt'> & { taskId?: string }) {
  throw new Error('Not implemented — Sessão B deve completar (ver BRIEFING-SESSAO-B-task-registry.md)');
}

export async function acquireLock(_taskId: string, _agent: string): Promise<boolean> {
  throw new Error('Not implemented — Sessão B');
}

export async function updateStatus(
  _taskId: string,
  _status: TaskStatus,
  _opts?: { output?: Record<string, unknown>; error?: string }
) {
  throw new Error('Not implemented — Sessão B');
}
