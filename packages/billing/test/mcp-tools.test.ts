import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInterClient } from '../src/inter-client.js';
import { billingMcpTools } from '../src/mcp-tools.js';
import { jsonResponse, makeFakeFetch, makeFakeSupabase, makeInterOpts } from './helpers.js';

const SECRET = 'wh-secret';

function buildDeps(opts: {
  fetchHandlers?: Array<(req: Request) => Response | Promise<Response>>;
  existing?: any;
  onUpsert?: (row: any) => void;
}) {
  const inter = createInterClient(makeInterOpts({ fetchImpl: makeFakeFetch(opts.fetchHandlers ?? []) }));
  const supabase = makeFakeSupabase({ existing: opts.existing, captureUpsert: opts.onUpsert });
  return { inter, supabase, webhookSecret: SECRET };
}

describe('billingMcpTools', () => {
  it('expõe as 5 tools esperadas com schemas', () => {
    const tools = billingMcpTools(buildDeps({}));
    const names = tools.map((t) => t.name);
    expect(names).toEqual([
      'billing.emitir_boleto',
      'billing.consultar_saldo',
      'billing.check_idempotency',
      'billing.set_idempotency',
      'billing.verify_webhook',
    ]);
    for (const t of tools) {
      expect(t.description).toBeTruthy();
      expect((t.inputSchema as any).type).toBe('object');
      expect(typeof t.handler).toBe('function');
    }
  });

  it('emitir_boleto: delega ao Inter e cacheia resultado', async () => {
    let upserted: any;
    const deps = buildDeps({
      fetchHandlers: [
        async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
        async () => jsonResponse({ codigoSolicitacao: 'c1', situacao: 'A_RECEBER' }),
      ],
      onUpsert: (r) => (upserted = r),
    });
    const tool = billingMcpTools(deps).find((t) => t.name === 'billing.emitir_boleto')!;
    const result = (await tool.handler({
      accountId: 'aluno-7',
      mesRef: '2026-04',
      valor: 300,
      vencimento: '2026-04-30',
      descricao: 'Mensalidade',
      pagador: {
        cpfCnpj: '12345678909',
        tipoPessoa: 'FISICA',
        nome: 'X',
        endereco: 'R',
        cidade: 'C',
        uf: 'MS',
        cep: '79540000',
      },
    })) as any;
    expect(result.idempotent).toBe(false);
    expect(result.codigoSolicitacao).toBe('c1');
    expect(upserted.key).toBe('boleto:aluno-7:2026-04');
  });

  it('emitir_boleto: retorna cached quando idempotency já tem entry', async () => {
    const cached = { codigoSolicitacao: 'prev', situacao: 'A_RECEBER' };
    const deps = buildDeps({
      existing: {
        key: 'boleto:aluno-7:2026-04',
        result: cached,
        created_at: '2026-04-20T10:00:00Z',
        expires_at: '2099-01-01T00:00:00Z',
      },
      // sem fetch handlers — não deve chamar Inter
    });
    const tool = billingMcpTools(deps).find((t) => t.name === 'billing.emitir_boleto')!;
    const result = (await tool.handler({
      accountId: 'aluno-7',
      mesRef: '2026-04',
      valor: 300,
      vencimento: '2026-04-30',
      descricao: 'M',
      pagador: {
        cpfCnpj: '1', tipoPessoa: 'FISICA', nome: 'X', endereco: 'R', cidade: 'C', uf: 'MS', cep: '0',
      },
    })) as any;
    expect(result.idempotent).toBe(true);
    expect(result.codigoSolicitacao).toBe('prev');
  });

  it('consultar_saldo: chama Inter e retorna saldo', async () => {
    const deps = buildDeps({
      fetchHandlers: [
        async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
        async () => jsonResponse({ disponivel: 500, bloqueado: 0 }),
      ],
    });
    const tool = billingMcpTools(deps).find((t) => t.name === 'billing.consultar_saldo')!;
    const s = (await tool.handler({})) as any;
    expect(s.disponivel).toBe(500);
  });

  it('check_idempotency: passa pelo store', async () => {
    const deps = buildDeps({ existing: null });
    const tool = billingMcpTools(deps).find((t) => t.name === 'billing.check_idempotency')!;
    expect(await tool.handler({ key: 'x' })).toBeNull();
  });

  it('set_idempotency: persiste com ttl customizado', async () => {
    let up: any;
    const deps = buildDeps({ onUpsert: (r) => (up = r) });
    const tool = billingMcpTools(deps).find((t) => t.name === 'billing.set_idempotency')!;
    await tool.handler({ key: 'y', result: { v: 1 }, ttlSeconds: 60 });
    expect(up.key).toBe('y');
    const ttl =
      new Date(up.expires_at).getTime() - new Date(up.created_at).getTime();
    expect(ttl).toBeGreaterThanOrEqual(60_000 - 50);
    expect(ttl).toBeLessThanOrEqual(60_000 + 50);
  });

  it('verify_webhook: valid=true para assinatura correta', async () => {
    const deps = buildDeps({});
    const body = '{"evento":"pix"}';
    const signature = createHmac('sha256', SECRET).update(body).digest('hex');
    const tool = billingMcpTools(deps).find((t) => t.name === 'billing.verify_webhook')!;
    expect(await tool.handler({ rawBody: body, signature })).toEqual({ valid: true });
  });

  it('verify_webhook: valid=false para assinatura incorreta', async () => {
    const deps = buildDeps({});
    const tool = billingMcpTools(deps).find((t) => t.name === 'billing.verify_webhook')!;
    expect(await tool.handler({ rawBody: '{}', signature: 'deadbeef' })).toEqual({ valid: false });
  });
});
