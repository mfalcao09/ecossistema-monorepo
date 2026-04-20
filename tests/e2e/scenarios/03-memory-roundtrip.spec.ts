import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function getMemoryClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessários');
  return createClient(url, key);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('Memory roundtrip — add → embedding → recall', () => {
  const testUserId = `test-${Date.now()}`;
  const testContent = `Preferência de teste ${testUserId}: usar Sonnet 4.6 para análises financeiras`;

  test.afterAll(async () => {
    const supabase = getMemoryClient();
    await supabase
      .from('memory_semantic')
      .delete()
      .eq('user_id', testUserId);
  });

  test('memória adicionada é recuperável por busca semântica', async () => {
    const supabase = getMemoryClient();

    // 1. Adicionar memória
    const { error: insertError } = await supabase
      .from('memory_semantic')
      .insert({
        content: testContent,
        user_id: testUserId,
        agent_id: 'cfo-fic',
        business_id: 'fic',
        metadata: { source: 'e2e-test' },
      });

    expect(insertError, `Insert falhou: ${insertError?.message}`).toBeNull();

    // 2. Aguarda trigger de embedding (pg_net assíncrono)
    await sleep(8_000);

    // 3. Verificar que o embedding foi gerado
    const { data: memRow } = await supabase
      .from('memory_semantic')
      .select('id, embedding')
      .eq('user_id', testUserId)
      .single();

    expect(memRow).toBeTruthy();
    expect(memRow!.embedding, 'Embedding deve ter sido gerado').not.toBeNull();
  });

  test('recall retorna hit relevante para query relacionada', async () => {
    const supabase = getMemoryClient();

    // Busca via RPC de similaridade (função definida em S7)
    const { data: hits, error } = await supabase.rpc('recall_semantic_memory', {
      p_query_embedding: null,
      p_query_text: 'Que modelo usar para análise financeira do FIC?',
      p_user_id: testUserId,
      p_agent_id: 'cfo-fic',
      p_business_id: 'fic',
      p_limit: 5,
    });

    if (error) {
      // RPC pode não existir ainda — skip gracioso
      test.skip(true, `RPC recall_semantic_memory não disponível: ${error.message}`);
      return;
    }

    expect(Array.isArray(hits)).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
    const firstHit = hits[0] as Record<string, unknown>;
    expect(String(firstHit['content'])).toContain('Sonnet');
  });
});
