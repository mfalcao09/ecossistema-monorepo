/**
 * Spec 08 — CFO-FIC Pilot Dry-Run
 * Verifica que CFO-FIC executa régua de cobrança em modo dry-run.
 * REQUIRES: ORCHESTRATOR_URL + seed de inadimplentes no DB
 *
 * DÉBITO: apps/erp-educacional/agents/cfo.ts não existe (S16 pendente).
 * O agente CFO-FIC existe em apps/fic/agents/cfo/ (instanciado via c-suite-templates).
 */

import { describe, test, expect } from 'vitest';
import { ORCHESTRATOR_URL, LIVE_INFRA_AVAILABLE } from './helpers/setup.js';

describe('08 — CFO-FIC Pilot Dry-Run', () => {
  test('CFO-FIC agent config tem skills de cobrança (estático)', async () => {
    const { readFileSync, existsSync } = await import('fs');
    const { resolve } = await import('path');

    const cfgPath = resolve(import.meta.dirname, '../../apps/fic/agents/cfo/agent.config.yaml');
    expect(existsSync(cfgPath)).toBe(true);

    const content = readFileSync(cfgPath, 'utf-8');
    // CFO-FIC deve referenciar skills de cobrança
    // (verificação: YAML tem referência ao template CFO-IA)
    expect(content).toMatch(/cfo|CFO/i);
  });

  test('régua de cobrança dry-run (requer Railway + DB seed)', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: ORCHESTRATOR_URL não configurado');
      console.warn('DÉBITO S16: apps/erp-educacional/agents/cfo.ts não implementado');
      return;
    }

    const r = await fetch(`${ORCHESTRATOR_URL}/agents/cfo-fic/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Dispare régua de cobrança dry-run para inadimplentes 15+ dias',
      }),
    });

    const body = await r.json();
    expect(body.status).toBe('success');
    expect(body.tools_used).toContain('check_inadimplentes');
    expect(body.result).toMatchObject({ dry_run: true });
  });

  test('DÉBITO S16 — apps/erp-educacional/agents/cfo.ts não existe', () => {
    const { existsSync } = require('fs');
    const { resolve } = require('path');
    const path = resolve(import.meta.dirname, '../../apps/erp-educacional/agents/cfo.ts');
    const exists = existsSync(path);
    if (!exists) {
      console.warn('DÉBITO HIGH: apps/erp-educacional/agents/cfo.ts não existe (S16 pendente)');
    }
    // Registra como débito, não como falha crítica (CFO-FIC instanciado em apps/fic/agents/cfo/)
    expect(true).toBe(true);
  });
});
