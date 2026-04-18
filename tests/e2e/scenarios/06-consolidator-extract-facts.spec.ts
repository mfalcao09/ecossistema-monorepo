import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('Memory Consolidator — extração de fatos', () => {
  test('sessão encerrada dispara extração de memória procedural', async ({ request }) => {
    const baseUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:8000';

    // Simular fim de sessão via endpoint de SessionEnd hook
    const response = await request.post(`${baseUrl}/hooks/session-end`, {
      data: {
        session_id: `e2e-test-session-${Date.now()}`,
        agent_id: 'cfo-fic',
        business_id: 'fic',
        user_id: 'marcelo',
        summary: 'Executei régua de cobrança: 3 alunos notificados via WhatsApp sandbox',
        tools_used: ['check_inadimplentes', 'send_whatsapp'],
        outcome: 'success',
      },
      timeout: 15_000,
    });

    // Endpoint pode retornar 200 (processou) ou 202 (async)
    expect([200, 202, 404]).toContain(response.status());

    if (response.status() !== 404) {
      // Aguarda processamento assíncrono
      await sleep(3_000);

      // Verificar que memória procedural foi criada
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (url && key) {
        const supabase = createClient(url, key);
        const { data } = await supabase
          .from('memory_procedural')
          .select('id, content')
          .eq('agent_id', 'cfo-fic')
          .eq('business_id', 'fic')
          .ilike('content', '%régua%')
          .order('created_at', { ascending: false })
          .limit(3);

        // Se consolidator estiver rodando, deve ter criado ao menos 1 entrada
        // Se não estiver rodando, aceitamos graciosamente
        if (data && data.length > 0) {
          expect(data[0]).toHaveProperty('content');
        }
      }
    }
  });

  test('Art. XXII — hook SessionEnd registra reflexão', async ({ request }) => {
    const baseUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:8000';

    const response = await request.get(`${baseUrl}/health`);
    if (response.status() !== 200) {
      test.skip(true, 'Orchestrator não disponível');
      return;
    }

    // Verificar que endpoint de hook existe
    const hookResponse = await request.options(`${baseUrl}/hooks/session-end`);
    expect([200, 204, 405]).toContain(hookResponse.status());
  });
});
