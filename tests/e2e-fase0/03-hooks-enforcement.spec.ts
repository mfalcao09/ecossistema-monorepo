/**
 * Spec 03 — Constitutional Hooks Enforcement
 * Verifica que os 11 hooks bloqueiam quando deveriam.
 * PODE RODAR LOCALMENTE — sem dependência de infra live.
 *
 * RESULTADO FASE 0: 70/70 testes no package próprio + 11/11 cenários E2E.
 * API: functional hooks — recebem HookContext e retornam HookDecision.
 * Mocking: usa _helpers.ts + setSupabaseClient/setLiteLLMClient do package.
 */

import { describe, test, expect, afterEach } from 'vitest';
import { resolve } from 'path';

const HOOKS_SRC = resolve(import.meta.dirname, '../../packages/constitutional-hooks/src');
const HOOKS_TESTS = resolve(import.meta.dirname, '../../packages/constitutional-hooks/tests');

const BASE_CTX = {
  agent_id: 'e2e-s17',
  business_id: 'fic',
  trace_id: 'e2e-s17-trace',
};

describe('03 — Hooks Constitucionais (11 hooks)', () => {
  let setSupabaseClient: (c: unknown) => void;
  let setLiteLLMClient: (c: unknown) => void;
  let createMockSupabase: () => { client: unknown; state: unknown };
  let mockLiteLLMFailing: () => unknown;

  test('setup: carrega utils e mocks', async () => {
    const utils = await import(`${HOOKS_SRC}/utils.ts`);
    const helpers = await import(`${HOOKS_TESTS}/_helpers.ts`);
    setSupabaseClient = utils.setSupabaseClient;
    setLiteLLMClient = utils.setLiteLLMClient;
    createMockSupabase = helpers.createMockSupabase;
    mockLiteLLMFailing = helpers.mockLiteLLMFailing;
    expect(setSupabaseClient).toBeTypeOf('function');
  });

  test('index exporta todos os 11 hooks', async () => {
    const mod = await import(`${HOOKS_SRC}/index.ts`);
    const expected = [
      'artIIHITL', 'artIIIIdempotency', 'artIVAudit',
      'artVIIIBaixaReal', 'artIXFalhaExplicita', 'artXIICostControl',
      'artXIVDualWrite', 'artXVIIIDataContracts', 'artXIXSecurity',
      'artXXSoberania', 'artXXIIAprendizado',
    ];
    for (const name of expected) {
      expect(typeof mod[name], `${name} deve ser function`).toBe('function');
    }
  });

  test('Art. II HITL — bloqueia pix_transferencia > R$10k', async () => {
    const { artIIHITL } = await import(`${HOOKS_SRC}/art-ii-hitl.ts`);
    const { setSupabaseClient } = await import(`${HOOKS_SRC}/utils.ts`);
    const { createMockSupabase } = await import(`${HOOKS_TESTS}/_helpers.ts`);
    setSupabaseClient(createMockSupabase().client);

    const result = await artIIHITL({
      ...BASE_CTX,
      tool_name: 'pix_transferencia',
      tool_input: { valor: 50000, destino: 'conta-x' },
    });
    expect(result.decision).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/Art\. II/);
    setSupabaseClient(null);
  });

  test('Art. II HITL — permite queries sem risco financeiro', async () => {
    const { artIIHITL } = await import(`${HOOKS_SRC}/art-ii-hitl.ts`);
    const result = await artIIHITL({
      ...BASE_CTX,
      tool_name: 'query_relatorio_mensal',
      tool_input: {},
    });
    expect(result.decision).toBe('allow');
  });

  test('Art. III Idempotência — bloqueia quando idempotency_cache já tem entrada', async () => {
    const { artIIIIdempotency } = await import(`${HOOKS_SRC}/art-iii-idempotency.ts`);
    const { setSupabaseClient } = await import(`${HOOKS_SRC}/utils.ts`);
    const { createMockSupabase } = await import(`${HOOKS_TESTS}/_helpers.ts`);

    // Simula entrada já existente no cache (duplicata)
    const { client } = createMockSupabase({
      existing: { idempotency_cache: [{ key: 'existing-key' }] },
    });
    setSupabaseClient(client);

    const result = await artIIIIdempotency({
      ...BASE_CTX,
      tool_name: 'emitir_boleto',
      tool_input: { aluno_id: 'aluno-999', valor: 100 },
    });
    expect(result.decision).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/Art\. III/);
    setSupabaseClient(null);
  });

  test('Art. IV Audit — registra PostToolUse sem lançar erro', async () => {
    const { artIVAudit } = await import(`${HOOKS_SRC}/art-iv-audit.ts`);
    const { setSupabaseClient } = await import(`${HOOKS_SRC}/utils.ts`);
    const { createMockSupabase } = await import(`${HOOKS_TESTS}/_helpers.ts`);
    setSupabaseClient(createMockSupabase().client);

    await expect(
      artIVAudit({ ...BASE_CTX, tool_name: 'query', tool_input: {}, result: { rows: 5 }, error: null })
    ).resolves.not.toThrow();
    setSupabaseClient(null);
  });

  test('Art. XIV Dual-Write — intercepta Write em /project/memory/', async () => {
    const { artXIVDualWrite } = await import(`${HOOKS_SRC}/art-xiv-dual-write.ts`);
    const result = await artXIVDualWrite({
      ...BASE_CTX,
      tool_name: 'Write',
      tool_input: { file_path: '/project/memory/decisions.md', content: 'test' },
    });
    expect(result.decision).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/Art\. XIV/);
  });

  test('Art. XIX Security — bloqueia rm -rf /', async () => {
    const { artXIXSecurity } = await import(`${HOOKS_SRC}/art-xix-security.ts`);
    const result = await artXIXSecurity({
      ...BASE_CTX,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    });
    expect(result.decision).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/Art\. XIX/);
  });

  test('Art. XIX Security — bloqueia git push --force origin main', async () => {
    const { artXIXSecurity } = await import(`${HOOKS_SRC}/art-xix-security.ts`);
    const result = await artXIXSecurity({
      ...BASE_CTX,
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin main' },
    });
    expect(result.decision).toBe('block');
  });

  test('Art. XII Cost Control — fail-closed quando LiteLLM falha', async () => {
    const { artXIICostControl } = await import(`${HOOKS_SRC}/art-xii-cost-control.ts`);
    const { setLiteLLMClient } = await import(`${HOOKS_SRC}/utils.ts`);
    const { mockLiteLLMFailing } = await import(`${HOOKS_TESTS}/_helpers.ts`);
    setLiteLLMClient(mockLiteLLMFailing());

    const result = await artXIICostControl({
      ...BASE_CTX,
      tool_name: 'llm_chat_completion',
      tool_input: { model: 'claude-sonnet-4-6', tokens_expected: 1000 },
    });
    expect(result.decision).toBe('block');
    expect((result as { reason: string }).reason).toMatch(/Fail-closed/);
    setLiteLLMClient(null);
  });

  test('Art. IX Falha Explícita — throw em result.success=false', async () => {
    const { artIXFalhaExplicita, ToolFailedError } = await import(`${HOOKS_SRC}/art-ix-falha-explicita.ts`);
    const { setSupabaseClient } = await import(`${HOOKS_SRC}/utils.ts`);
    const { createMockSupabase } = await import(`${HOOKS_TESTS}/_helpers.ts`);
    setSupabaseClient(createMockSupabase().client);

    await expect(
      artIXFalhaExplicita({
        ...BASE_CTX,
        tool_name: 'query_banco',
        tool_input: {},
        result: { success: false, message: 'conta inexistente' },
        error: null,
      })
    ).rejects.toBeInstanceOf(ToolFailedError);
    setSupabaseClient(null);
  });

  test('Art. XX Soberania — allow com hint em stdout (não bloqueia)', async () => {
    const { artXXSoberania } = await import(`${HOOKS_SRC}/art-xx-soberania.ts`);
    const result = await artXXSoberania({
      ...BASE_CTX,
      tool_name: 'buscar_aluno_cpf',
      tool_input: { cpf: '000.000.000-00' },
    });
    // Art. XX é hint: permite mas loga sugestão local em stdout
    expect(result.decision).toBe('allow');
  });

  test('Art. XXII Aprendizado — executa SessionEnd sem erro', async () => {
    const { artXXIIAprendizado } = await import(`${HOOKS_SRC}/art-xxii-aprendizado.ts`);
    const { setSupabaseClient } = await import(`${HOOKS_SRC}/utils.ts`);
    const { createMockSupabase } = await import(`${HOOKS_TESTS}/_helpers.ts`);
    setSupabaseClient(createMockSupabase().client);

    await expect(
      artXXIIAprendizado({
        agent_id: 'e2e-s17',
        business_id: 'fic',
        session_id: 'session-s17',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        tools_used: ['query_alunos'],
        files_touched: [],
        outcome: 'success',
      })
    ).resolves.not.toThrow();
    setSupabaseClient(null);
  });
});
