import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for E2E seeds');
  return createClient(url, key);
}

export interface Inadimplente {
  aluno_id: string;
  nome: string;
  dias_atraso: number;
  valor_devido: number;
  telefone: string;
}

export async function seedInadimplentes(count: number): Promise<Inadimplente[]> {
  const supabase = getSupabaseClient();

  const records: Inadimplente[] = Array.from({ length: count }, (_, i) => ({
    aluno_id: `test-aluno-${i + 1}-${Date.now()}`,
    nome: `Aluno Teste ${i + 1}`,
    dias_atraso: 15 + i * 5,
    valor_devido: 500 + i * 100,
    telefone: `+5567999${String(i).padStart(6, '0')}`,
  }));

  const { error } = await supabase
    .from('fic_inadimplentes_test')
    .insert(records);

  if (error) throw new Error(`Failed to seed inadimplentes: ${error.message}`);
  return records;
}

export async function cleanupInadimplentes(ids: string[]): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('fic_inadimplentes_test')
    .delete()
    .in('aluno_id', ids);
}
