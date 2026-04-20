/**
 * Spec 05 — Memory Roundtrip
 * Testa add → recall → hit e contradição → supersede.
 * REQUIRES: SUPABASE_URL + SUPABASE_ANON_KEY (para e2e.test.ts do package memory)
 */

import { describe, test, expect } from 'vitest';
import { LIVE_INFRA_AVAILABLE, sleep } from './helpers/setup.js';
import { resolve } from 'path';

const MONOREPO_ROOT = resolve(import.meta.dirname, '../../');

describe('05 — Memory Roundtrip', () => {
  test('MemoryClient instancia sem erro (unit)', async () => {
    const mod = await import(resolve(MONOREPO_ROOT, 'packages/memory/src/index.ts'));
    const MemoryClientClass = mod.MemoryClient ?? mod.createMemoryClient;
    expect(MemoryClientClass).toBeDefined();
  });

  test('filtros estritos tipados (unit)', async () => {
    const { validateFilters } = await import(
      resolve(MONOREPO_ROOT, 'packages/memory/src/filters/strict-filters.ts')
    );
    // validateFilters não lança erro para filtros válidos
    expect(() => validateFilters({
      user_id: 'marcelo',
      agent_id: 'cfo-fic',
      business_id: 'fic',
    })).not.toThrow();

    // Lança para filtros incompletos
    expect(() => validateFilters({ user_id: 'marcelo' } as never)).toThrow();
  });

  test('3 tiers definidos (unit)', async () => {
    const episodic  = await import(resolve(MONOREPO_ROOT, 'packages/memory/src/tiers/episodic.ts'));
    const semantic  = await import(resolve(MONOREPO_ROOT, 'packages/memory/src/tiers/semantic.ts'));
    const procedural = await import(resolve(MONOREPO_ROOT, 'packages/memory/src/tiers/procedural.ts'));
    expect(episodic).toBeDefined();
    expect(semantic).toBeDefined();
    expect(procedural).toBeDefined();
  });

  test('memory add → recall → hit (requer Supabase live)', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: Supabase não configurado. Use: SUPABASE_URL=... pnpm test:infra');
      return;
    }

    const mod = await import(resolve(MONOREPO_ROOT, 'packages/memory/src/index.ts'));
    const memory = new mod.MemoryClient({
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    });

    await memory.add({
      content: 'FIC tem taxa de inadimplência histórica de 8%',
      filters: { user_id: 'test-s17', agent_id: 'cfo-fic', business_id: 'fic' },
      type: 'semantic',
    });

    await sleep(6000); // aguarda auto-embedding

    const hits = await memory.recall({
      query: 'Qual a inadimplência da FIC?',
      filters: { user_id: 'test-s17', agent_id: 'cfo-fic', business_id: 'fic' },
      limit: 5,
    });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].content).toMatch(/8%/);
  });

  test('contradição semântica → supersede (requer Supabase live)', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: Supabase não configurado');
      return;
    }

    const mod = await import(resolve(MONOREPO_ROOT, 'packages/memory/src/index.ts'));
    const memory = new mod.MemoryClient({
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    });

    const filters = { user_id: 'test-s17', agent_id: 'test', business_id: 'test' };
    await memory.add({ content: 'Marcelo prefere modelo Sonnet', filters, type: 'semantic' });
    await memory.add({ content: 'Marcelo prefere modelo Opus', filters, type: 'semantic' });

    await sleep(3000);

    const latest = await memory.semantic.getLatest({ subject: 'Marcelo', predicate: 'prefere' });
    expect(latest.supersedes_id).toBeTruthy();
    expect(latest.content).toMatch(/Opus/);
  });
});
