import { describe, it, expect, vi, afterEach } from 'vitest';
import { assemble } from '../src/index.js';
import {
  makeAgentConfig,
  makeContext,
  makeEvolvedConfigDir,
  cleanupDir,
  ROLE_DIR,
} from './fixtures.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) cleanupDir(dirs.pop()!);
});
function newAgent() {
  const evolved = makeEvolvedConfigDir();
  dirs.push(evolved);
  return makeAgentConfig({ evolved_config_path: evolved });
}

describe('assemble() — integration', () => {
  it('produces well-formed prompt (onboarding + memory_context absent)', async () => {
    const out = await assemble(
      newAgent(),
      makeContext(),
      {},
      { roleTemplatesDir: ROLE_DIR },
    );

    expect(out.system_prompt).toContain('# Você é CFO-IA FIC');
    expect(out.system_prompt).toContain('## Ambiente');
    expect(out.system_prompt).toContain('## Segurança');
    expect(out.system_prompt).toContain('## Role');
    expect(out.system_prompt).toContain('## Configuração Evoluída');
    expect(out.system_prompt).toContain('## Como usar Memória');
    expect(out.system_prompt).toContain('## Como Trabalhar');
    // Sem onboarding e sem recall dep → memory_context também vazio
    expect(out.system_prompt).not.toContain('Primeiro Contato');
    expect(out.system_prompt).not.toContain('Memórias Relevantes');

    expect(out.meta.layers_included).toBe(7);
    expect(out.meta.agent_id).toBe('cfo-fic');
    expect(out.meta.business_id).toBe('fic');
    expect(out.meta.layer_sizes.identity).toBeGreaterThan(0);
    expect(out.meta.layer_sizes.onboarding).toBe(0);
    expect(out.meta.layer_sizes.memory_context).toBe(0);
    expect(out.meta.evolved_config_version).toMatch(/^[a-f0-9]{64}$/);
  });

  it('includes onboarding layer on first run', async () => {
    const out = await assemble(
      newAgent(),
      makeContext({ is_first_run: true }),
      {},
      { roleTemplatesDir: ROLE_DIR },
    );
    expect(out.system_prompt).toContain('Primeiro Contato');
    // 7 layers base + onboarding; memory_context ainda vazio (sem recall)
    expect(out.meta.layers_included).toBe(8);
  });

  it('all 9 layers present when first_run + recall returns results', async () => {
    const recall = vi
      .fn()
      .mockResolvedValue([
        { type: 'episodic', importance: 7, summary: 'hit' },
      ]);
    const out = await assemble(
      newAgent(),
      makeContext({ is_first_run: true }),
      { recall },
      { roleTemplatesDir: ROLE_DIR },
    );
    expect(out.meta.layers_included).toBe(9);
  });

  it('injects memory context when recall provided', async () => {
    const recall = vi.fn().mockResolvedValue([
      { type: 'episodic', importance: 8, summary: 'FIC inadimplência 7.8% em Março' },
    ]);
    const out = await assemble(
      newAgent(),
      makeContext(),
      { recall },
      { roleTemplatesDir: ROLE_DIR },
    );
    expect(out.system_prompt).toContain('Memórias Relevantes');
    expect(out.system_prompt).toContain('inadimplência 7.8%');
    expect(recall).toHaveBeenCalled();
  });

  it('generates prompt in expected byte range (sanity size check)', async () => {
    const out = await assemble(
      newAgent(),
      makeContext(),
      {},
      { roleTemplatesDir: ROLE_DIR },
    );
    const bytes = Buffer.byteLength(out.system_prompt, 'utf-8');
    // Baseline: 22 Artigos + persona + user-profile + role já ficam > 4 KB.
    // Teto generoso para absorver crescimento de templates sem re-ajustar teste.
    expect(bytes).toBeGreaterThan(3_000);
    expect(bytes).toBeLessThan(20_000);
  });

  it('prompt-cache invariant: same evolved config + exclude_dynamic produces identical non-dynamic prefix', async () => {
    const cfg = newAgent();
    const fixedNow = new Date('2026-04-17T00:00:00Z');
    const base = {
      exclude_dynamic_sections: true,
    };

    const a = await assemble(
      cfg,
      makeContext({ ...base, query: 'Pergunta A', user_id: 'alice' }),
      { now: () => fixedNow },
      { roleTemplatesDir: ROLE_DIR },
    );
    const b = await assemble(
      cfg,
      makeContext({ ...base, query: 'Pergunta B totalmente diferente', user_id: 'bob' }),
      { now: () => fixedNow },
      { roleTemplatesDir: ROLE_DIR },
    );

    // Memory context vazio em ambos → os prompts inteiros devem bater
    expect(a.system_prompt).toBe(b.system_prompt);
    expect(a.meta.exclude_dynamic_sections).toBe(true);
  });

  it('evolved_config_version changes when any file changes', async () => {
    const cfg = newAgent();
    const a = await assemble(cfg, makeContext(), {}, { roleTemplatesDir: ROLE_DIR });

    const { writeFileSync, readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const p = resolve(cfg.evolved_config_path, 'persona.md');
    writeFileSync(p, readFileSync(p, 'utf-8') + '\n<!-- evolved -->', 'utf-8');

    const b = await assemble(cfg, makeContext(), {}, { roleTemplatesDir: ROLE_DIR });

    expect(a.meta.evolved_config_version).not.toBe(b.meta.evolved_config_version);
  });
});
