/**
 * Setup global para os testes E2E da Fase 0.
 * Verifica pré-condições e expõe helpers globais.
 */

export const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
export const LITELLM_URL = process.env.LITELLM_URL ?? '';
export const LANGFUSE_URL = process.env.LANGFUSE_URL ?? '';
export const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? '';
export const CONSOLIDATOR_URL = process.env.CONSOLIDATOR_URL ?? '';

export const LIVE_INFRA_AVAILABLE = !!(
  SUPABASE_URL && SUPABASE_ANON_KEY && ORCHESTRATOR_URL
);

/** Skipa o teste se infra live não disponível */
export function skipIfNoInfra(testFn: () => Promise<void>) {
  if (!LIVE_INFRA_AVAILABLE) {
    return () => {
      console.warn('⚠️  SKIPPED — live infra not available (set SUPABASE_URL, ORCHESTRATOR_URL)');
    };
  }
  return testFn;
}

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
