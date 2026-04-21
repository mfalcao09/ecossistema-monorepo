/**
 * Testes E2E sandbox — Inter sandbox + Evolution API sandbox.
 * Requer credenciais reais de sandbox. Skip automático se não configuradas.
 *
 * Configurar em .env.test.local:
 *   SUPABASE_FIC_URL=https://ifdnjieklngcfodmtied.supabase.co
 *   SUPABASE_FIC_SERVICE_KEY=...
 *   SUPABASE_FIC_ANON_KEY=...
 *   CREDENTIALS_PROXY_URL=...
 *   INTER_AMBIENTE=sandbox
 *   EVOLUTION_API_URL=...
 *   EVOLUTION_INSTANCE=fic-sandbox
 *
 * Executar: pnpm test:e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Guard — skip se não há credenciais de sandbox
// ---------------------------------------------------------------------------

const E2E_ENABLED =
  !!process.env['SUPABASE_FIC_SERVICE_KEY'] &&
  !!process.env['CREDENTIALS_PROXY_URL'] &&
  process.env['INTER_AMBIENTE'] === 'sandbox';

const describeE2E = E2E_ENABLED ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Dados de teste fixos (sandbox only)
// ---------------------------------------------------------------------------

const ALUNO_TESTE_ID = process.env['E2E_ALUNO_ID'] ?? '';
const WHATSAPP_TESTE_JID = process.env['E2E_WHATSAPP_JID'] ?? '5567900000000@s.whatsapp.net';
const MES_REF_TESTE = '2026-05';
const VALOR_TESTE = 1.00; // R$1,00 para sandbox

// ---------------------------------------------------------------------------
// E2E: emissão de boleto sandbox
// ---------------------------------------------------------------------------

describeE2E('emit_boleto_aluno — Inter sandbox', () => {
  it('emite boleto sandbox e retorna codigoSolicitacao + PIX', async () => {
    if (!ALUNO_TESTE_ID) {
      console.warn('[e2e] E2E_ALUNO_ID não configurado — pulando');
      return;
    }

    const { emitBoletoAluno } = await import('../tools/emit_boleto_aluno.js');

    const result = await emitBoletoAluno.handler({
      aluno_id: ALUNO_TESTE_ID,
      mes_ref: MES_REF_TESTE,
      valor: VALOR_TESTE,
    });

    expect(result.inter_id).toBeTruthy();
    expect(result.cobranca_id).toBeTruthy();
    expect(result.data_vencimento).toBe('2026-05-10');

    console.info('[e2e] Boleto emitido — Inter ID:', result.inter_id);
    console.info('[e2e] PIX QR Code (50 chars):', result.pix_qrcode?.slice(0, 50));
    console.info('[e2e] ✅ Verifique no painel Inter sandbox: cobrança seuNumero FIC-*-2026-05');
  });

  it('idempotência: segunda emissão retorna boleto existente', async () => {
    if (!ALUNO_TESTE_ID) return;

    const { emitBoletoAluno } = await import('../tools/emit_boleto_aluno.js');

    const r1 = await emitBoletoAluno.handler({
      aluno_id: ALUNO_TESTE_ID,
      mes_ref: MES_REF_TESTE,
      valor: VALOR_TESTE,
    });

    const r2 = await emitBoletoAluno.handler({
      aluno_id: ALUNO_TESTE_ID,
      mes_ref: MES_REF_TESTE,
      valor: VALOR_TESTE,
    });

    // Deve retornar o mesmo cobranca_id (idempotente)
    expect(r1.cobranca_id).toBe(r2.cobranca_id);
    expect(r1.inter_id).toBe(r2.inter_id);
    console.info('[e2e] ✅ Idempotência confirmada — mesmo cobranca_id em 2 chamadas');
  });
});

// ---------------------------------------------------------------------------
// E2E: envio de WhatsApp sandbox
// ---------------------------------------------------------------------------

describeE2E('send_whatsapp_cobranca — Evolution API sandbox', () => {
  let cobrancaId: string | null = null;

  beforeAll(async () => {
    if (!ALUNO_TESTE_ID) return;
    const { emitBoletoAluno } = await import('../tools/emit_boleto_aluno.js');
    const result = await emitBoletoAluno.handler({
      aluno_id: ALUNO_TESTE_ID,
      mes_ref: MES_REF_TESTE,
      valor: VALOR_TESTE,
    });
    cobrancaId = result.cobranca_id;
  });

  it('envia WhatsApp de teste e retorna message_id', async () => {
    if (!ALUNO_TESTE_ID || !cobrancaId) {
      console.warn('[e2e] Pulando — aluno ou cobrança não configurados');
      return;
    }

    const { sendWhatsappCobranca } = await import('../tools/send_whatsapp_cobranca.js');

    const result = await sendWhatsappCobranca.handler({
      aluno_id: ALUNO_TESTE_ID,
      estagio: 'vencido-1d',
      cobranca_id: cobrancaId,
    });

    expect(result.sent).toBe(true);
    expect(result.message_id).toBeTruthy();
    console.info('[e2e] ✅ WhatsApp enviado — message_id:', result.message_id);
    console.info('[e2e] Verifique recebimento em:', WHATSAPP_TESTE_JID);
  });
});

// ---------------------------------------------------------------------------
// E2E: régua dry-run com Supabase real
// ---------------------------------------------------------------------------

describeE2E('disparar_regua_cobranca — dry-run sandbox', () => {
  it('dry-run retorna plano sem enviar mensagens', async () => {
    const { dispararReguaCobranca } = await import('../tools/disparar_regua_cobranca.js');

    const result = await dispararReguaCobranca.handler({ dias_min: 1, dry_run: true });

    expect(result.status).toBe('dry_run');
    expect(result.sent).toBe(0);
    expect(typeof result.total_alunos).toBe('number');

    console.info(`[e2e] ✅ Dry-run: ${result.total_alunos} alunos | R$${result.total_valor.toFixed(2)}`);
    console.info('[e2e] Estágios que seriam disparados:',
      result.results.reduce<Record<string, number>>((acc, r) => {
        acc[r.estagio] = (acc[r.estagio] ?? 0) + 1;
        return acc;
      }, {}));
  });
});

// ---------------------------------------------------------------------------
// Smoke test: POST /agents/cfo-fic/run no orchestrator
// ---------------------------------------------------------------------------

describeE2E('orchestrator smoke test', () => {
  const ORCHESTRATOR_URL = process.env['ORCHESTRATOR_URL'] ?? 'http://localhost:8000';

  it('POST /agents/cfo-fic/run com dry-run retorna plano', async () => {
    const resp = await fetch(`${ORCHESTRATOR_URL}/agents/cfo-fic/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Dispare a régua de cobrança para inadimplentes de 15+ dias em dry-run' }),
    });

    expect(resp.ok).toBe(true);
    const body = await resp.json() as { status?: string; result?: unknown };

    // O orchestrator deve retornar resposta do agente (pode ser SSE ou JSON)
    expect(body).toBeTruthy();
    console.info('[e2e] ✅ Orchestrator smoke test OK — status:', resp.status);
  });
});
