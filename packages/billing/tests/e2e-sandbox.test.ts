/**
 * P-013 — Teste e2e Banco Inter sandbox
 *
 * Roda APENAS quando as variáveis de ambiente estão presentes.
 * Não usa mTLS (sandbox = OAuth2 puro).
 *
 * Executar:
 *   INTER_CLIENT_ID=xxx INTER_CLIENT_SECRET=yyy pnpm --filter @ecossistema/billing test:e2e
 */
import { describe, it, expect } from 'vitest';
import { InterClient } from '../src/inter-client.js';

const CLIENT_ID     = process.env.INTER_CLIENT_ID;
const CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const CERT_PEM      = process.env.INTER_CERT_PEM;
const KEY_PEM       = process.env.INTER_KEY_PEM;

const hasCredentials = Boolean(CLIENT_ID && CLIENT_SECRET);
const hasMtls        = Boolean(CERT_PEM && KEY_PEM);

describe.runIf(hasCredentials)('Inter sandbox — e2e', () => {
  // mTLS quando cert+key disponíveis; fetchFn fallback para testes sem cert
  const clientOpts = hasMtls
    ? { clientId: CLIENT_ID!, clientSecret: CLIENT_SECRET!, certPem: CERT_PEM!, keyPem: KEY_PEM!, sandbox: true }
    : { clientId: CLIENT_ID!, clientSecret: CLIENT_SECRET!, fetchFn: globalThis.fetch, sandbox: true };

  const client = new InterClient(clientOpts);

  it('autentica via OAuth2 e lista cobranças', async () => {
    const hoje = new Date();
    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const resultado = await client.listarCobrancas({
      dataInicio: fmt(trintaDiasAtras),
      dataFim:    fmt(hoje),
    });

    console.log('✅ listarCobrancas:', JSON.stringify(resultado, null, 2));

    expect(resultado).toHaveProperty('totalElements');
    expect(resultado).toHaveProperty('content');
    expect(Array.isArray(resultado.content)).toBe(true);
  }, 15_000);

  it('emite boleto de teste no sandbox', async () => {
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 5);

    const boleto = await client.emitirBoleto({
      alunoId:   'E2E',
      mesRef:    '2026-04',
      valor:     100.00,
      vencimento,
      descricao: 'Boleto e2e P-013 Ecossistema',
      pagador: {
        cpfCnpj:    '00000000000',
        nome:       'Aluno Teste E2E',
        tipoPessoa: 'FISICA',
        endereco:   'Rua Teste',
        numero:     '1',
        bairro:     'Centro',
        cidade:     'Belo Horizonte',
        uf:         'MG',
        cep:        '30130010',
      },
    });

    console.log('✅ emitirBoleto:', JSON.stringify(boleto, null, 2));

    // Inter v3 é assíncrono: retorna codigoSolicitacao imediatamente
    expect(boleto.codigoSolicitacao || boleto.nossoNumero).toBeTruthy();
    expect(boleto.status).toBe('EMITIDO');
  }, 15_000);
});

describe.skipIf(hasCredentials)('Inter sandbox — e2e (credenciais ausentes)', () => {
  it('skip — defina INTER_CLIENT_ID e INTER_CLIENT_SECRET para rodar', () => {
    console.warn('⚠️  Variáveis INTER_CLIENT_ID / INTER_CLIENT_SECRET não definidas. Teste pulado.');
    expect(true).toBe(true);
  });
});
