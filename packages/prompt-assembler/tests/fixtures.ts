import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  AgentConfig,
  QueryContext,
} from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PACKAGE_ROOT = resolve(__dirname, '..');
export const TEMPLATES_ROOT = resolve(PACKAGE_ROOT, 'templates');
export const ROLE_DIR = resolve(TEMPLATES_ROOT, 'roles');
export const EVOLVED_BASE_DIR = resolve(
  TEMPLATES_ROOT,
  'evolved-config-base',
);

/**
 * Copia templates/evolved-config-base para um tmpdir isolado.
 * Retorna o path do dir (usable como `evolved_config_path`).
 */
export function makeEvolvedConfigDir(suffix = ''): string {
  const id = `prompt-assembler-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${suffix}`;
  const dir = resolve(tmpdir(), id);
  mkdirSync(dir, { recursive: true });
  cpSync(EVOLVED_BASE_DIR, dir, { recursive: true });
  return dir;
}

export function cleanupDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

export function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

export function makeAgentConfig(
  overrides: Partial<AgentConfig> = {},
): AgentConfig {
  return {
    agent_id: 'cfo-fic',
    name: 'CFO-IA FIC',
    title: 'Chief Financial Officer (IA)',
    description:
      'Gestor financeiro da FIC. Executa régua de cobrança, emite boletos e monitora inadimplência.',
    role: 'cfo-ia',
    business_id: 'fic',
    supabase_project: 'ifdnjieklngcfodmtied',
    model: 'claude-sonnet-4-6',
    evolved_config_path: makeEvolvedConfigDir('-cfo-fic'),
    ...overrides,
  };
}

export function makeContext(
  overrides: Partial<QueryContext> = {},
): QueryContext {
  return {
    query: 'Quanto está a inadimplência este mês?',
    user_id: 'marcelo',
    session_id: 'sess-abc-123',
    is_first_run: false,
    available_tools: ['memory.recall', 'memory.add', 'supabase.query'],
    available_mcps: ['supabase-mcp', 'memory-mcp', 'audit-mcp'],
    environment: 'test',
    ...overrides,
  };
}
