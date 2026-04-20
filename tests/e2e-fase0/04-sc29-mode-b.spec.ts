/**
 * Spec 04 — SC-29 Mode B — Secret Nunca Exposto
 * Verifica que o Credential Gateway (Edge Function) não vaza secrets.
 * REQUIRES: ORCHESTRATOR_URL + credencial Inter configurada
 */

import { describe, test, expect } from 'vitest';
import { ORCHESTRATOR_URL, LIVE_INFRA_AVAILABLE } from './helpers/setup.js';

describe('04 — SC-29 Modo B — Credential Gateway', () => {
  test('Edge Function credential-gateway-v2 existe no repo (estático)', async () => {
    const { existsSync } = await import('fs');
    const { resolve } = await import('path');
    const path = resolve(import.meta.dirname, '../../infra/supabase/functions/credential-gateway-v2/index.ts');
    expect(existsSync(path)).toBe(true);
  });

  test('credential-gateway-v2 implementa Modo B (proxy, não exposição)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const code = readFileSync(
      resolve(import.meta.dirname, '../../infra/supabase/functions/credential-gateway-v2/proxy.ts'),
      'utf-8',
    );
    // Deve ter lógica de proxy (não retorna a credential em texto)
    expect(code).toMatch(/proxy|forward|Authorization/i);
    // NÃO deve retornar a secret diretamente no body
    expect(code).not.toMatch(/res\.json\(.*secret/i);
  });

  test('SC-29 Modo B: agent nunca vê credential no response (requer orchestrator live)', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: ORCHESTRATOR_URL não configurado');
      return;
    }

    const r = await fetch(`${ORCHESTRATOR_URL}/agents/cfo-fic/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Consulte saldo da conta Inter' }),
    });

    const text = await r.text();

    // Nenhum padrão de credencial no response
    expect(text).not.toMatch(/sk-ant-[a-zA-Z0-9_-]{30,}/);
    expect(text).not.toMatch(/INTER_CLIENT_SECRET=/);
    expect(text).not.toMatch(/Bearer\s+eyJ[A-Za-z0-9_-]{20,}/);
    expect(text).not.toMatch(/"client_secret"\s*:/);
  });
});
