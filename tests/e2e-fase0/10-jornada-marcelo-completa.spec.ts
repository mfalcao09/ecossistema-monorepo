/**
 * Spec 10 — Jornada Marcelo Completa
 * Simula: Marcelo → Claudinho → CFO-FIC → resposta com dados reais.
 * REQUIRES: ORCHESTRATOR_URL completo com todos os serviços integrados.
 */

import { describe, test, expect } from 'vitest';
import { ORCHESTRATOR_URL, LIVE_INFRA_AVAILABLE } from './helpers/setup.js';

describe('10 — Jornada Marcelo Completa', () => {
  test('arquitetura completa documentada no repo (estático)', async () => {
    const { existsSync } = await import('fs');
    const { resolve } = await import('path');

    // Verifica que todos os componentes existem
    const components = [
      'apps/orchestrator/src/orchestrator/main.py',
      'apps/orchestrator/src/orchestrator/routes/agents.py',
      'apps/fic/agents/cfo/agent.config.yaml',
      'packages/constitutional-hooks/src/index.ts',
      'packages/memory/src/index.ts',
      'infra/supabase/functions/credential-gateway-v2/index.ts',
      'infra/railway/litellm/litellm_config.yaml',
      'infra/railway/langfuse/docker-compose.yml',
    ];

    for (const comp of components) {
      const fullPath = resolve(import.meta.dirname, '../..', comp);
      expect(existsSync(fullPath), `Componente não encontrado: ${comp}`).toBe(true);
    }
  });

  test('fluxo completo: Marcelo → Claudinho → CFO-FIC (requer Railway completo)', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: Stack Railway não disponível neste contexto');
      console.warn('Para executar: configure SUPABASE_URL + ORCHESTRATOR_URL + LANGFUSE_URL');
      return;
    }

    const start = Date.now();

    const r = await fetch(`${ORCHESTRATOR_URL}/agents/claudinho/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Claudinho, como está a inadimplência da FIC?',
        user_id: 'marcelo',
      }),
    });

    const body = await r.json();
    const duration = Date.now() - start;

    // Claudinho delegou para CFO-FIC
    expect(body.events).toContainEqual(
      expect.objectContaining({ type: 'handoff', target: 'cfo-fic' })
    );

    // CFO-FIC consultou dados
    expect(body.events.some(
      (e: { tool?: string }) => e.tool === 'check_inadimplentes'
    )).toBe(true);

    // Resposta contém dados financeiros
    expect(body.final_message).toMatch(/inadim|aluno|R\$/i);

    // Performance aceitável (< 30s)
    expect(duration).toBeLessThan(30000);

    // Custo registrado e razoável
    if (body.trace_id) {
      expect(body.cost_usd).toBeGreaterThan(0);
      expect(body.cost_usd).toBeLessThan(1.0);
    }
  });
});
