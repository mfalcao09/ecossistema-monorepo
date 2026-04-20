import { describe, expect, it, vi } from 'vitest';
import { InterClient, createInterClient } from '../src/inter-client.js';
import { InterApiError } from '../src/types.js';
import { jsonResponse, makeFakeFetch, makeInterOpts } from './helpers.js';

describe('InterClient — construção', () => {
  it('exige credenciais e cert/key', () => {
    expect(() => new InterClient(makeInterOpts({ clientId: '' }))).toThrow(/clientId/);
    expect(() => new InterClient(makeInterOpts({ clientSecret: '' }))).toThrow(/clientSecret/);
    expect(() => new InterClient(makeInterOpts({ certPem: '' }))).toThrow(/certPem/);
    expect(() => new InterClient(makeInterOpts({ keyPem: '' }))).toThrow(/keyPem/);
  });

  it('usa sandbox por default quando sandbox=true', () => {
    const c = createInterClient(makeInterOpts());
    expect(c.getBaseUrl()).toContain('uatinter.co');
  });

  it('usa produção quando sandbox=false', () => {
    const c = createInterClient(makeInterOpts({ sandbox: false }));
    expect(c.getBaseUrl()).toContain('bancointer.com.br');
  });

  it('respeita baseUrl override', () => {
    const c = createInterClient(makeInterOpts({ baseUrl: 'https://mock.test' }));
    expect(c.getBaseUrl()).toBe('https://mock.test');
  });
});

describe('InterClient — OAuth2', () => {
  it('obtém e cacheia access_token', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK-1', expires_in: 3600 }),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    const t1 = await c.getAccessToken();
    const t2 = await c.getAccessToken();
    expect(t1).toBe('TK-1');
    expect(t2).toBe('TK-1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('re-busca token quando force=true', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'A', expires_in: 3600 }),
      async () => jsonResponse({ access_token: 'B', expires_in: 3600 }),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    expect(await c.getAccessToken()).toBe('A');
    expect(await c.getAccessToken(true)).toBe('B');
  });

  it('lança InterApiError em 4xx do OAuth', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ error: 'invalid_client' }, 401),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    await expect(c.getAccessToken()).rejects.toBeInstanceOf(InterApiError);
  });

  it('rejeita resposta OAuth sem campos esperados', async () => {
    const fetchImpl = makeFakeFetch([async () => jsonResponse({ foo: 'bar' })]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    await expect(c.getAccessToken()).rejects.toBeInstanceOf(InterApiError);
  });

  it('usa token expirado como cache miss', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'X', expires_in: 0 }),
      async () => jsonResponse({ access_token: 'Y', expires_in: 3600 }),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    expect(await c.getAccessToken()).toBe('X');
    // expires_in=0 → já expirado (margem 30s) → próximo getAccessToken refaz
    expect(await c.getAccessToken()).toBe('Y');
  });
});

describe('InterClient — emitirBoleto', () => {
  const pagador = {
    cpfCnpj: '123.456.789-09',
    tipoPessoa: 'FISICA' as const,
    nome: 'João Teste',
    endereco: 'Rua A',
    cidade: 'Cassilândia',
    uf: 'MS',
    cep: '79540-000',
  };
  const validInput = {
    accountId: 'aluno-1',
    mesRef: '2026-04',
    valor: 450.5,
    vencimento: new Date('2026-04-30'),
    descricao: 'Mensalidade abril/2026',
    pagador,
  };

  it('emite boleto e retorna estrutura normalizada', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async (req) => {
        expect(req.url).toMatch(/cobranca\/v3\/cobrancas/);
        const body = await req.json();
        expect(body.seuNumero).toBe('aluno-1-2026-04');
        expect(body.valorNominal).toBe(450.5);
        expect(body.pagador.cpfCnpj).toBe('12345678909');
        expect(body.pagador.cep).toBe('79540000');
        expect(req.headers.get('authorization')).toBe('Bearer TK');
        return jsonResponse({
          codigoSolicitacao: 'cod-1',
          nossoNumero: '000123',
          situacao: 'A_RECEBER',
          linkBoleto: 'https://inter/x',
        });
      },
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    const b = await c.emitirBoleto(validInput);
    expect(b.nossoNumero).toBe('000123');
    expect(b.seuNumero).toBe('aluno-1-2026-04');
    expect(b.codigoSolicitacao).toBe('cod-1');
    expect(b.situacao).toBe('A_RECEBER');
    expect(b.valorNominal).toBe(450.5);
    expect(b.linkBoleto).toBe('https://inter/x');
  });

  it('aceita vencimento como string YYYY-MM-DD', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async (req) => {
        const body = await req.json();
        expect(body.dataVencimento).toBe('2026-05-10');
        return jsonResponse({ codigoSolicitacao: 'c', situacao: 'A_RECEBER' });
      },
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    await c.emitirBoleto({ ...validInput, vencimento: '2026-05-10' });
  });

  it('passa header x-conta-corrente quando configurado', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async (req) => {
        expect(req.headers.get('x-conta-corrente')).toBe('98765');
        return jsonResponse({ codigoSolicitacao: 'c', situacao: 'OK' });
      },
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl, contaCorrente: '98765' }));
    await c.emitirBoleto(validInput);
  });

  it('valida input — mesRef formato', async () => {
    const c = createInterClient(makeInterOpts({ fetchImpl: vi.fn() as any }));
    await expect(c.emitirBoleto({ ...validInput, mesRef: '04/2026' })).rejects.toThrow(/mesRef/);
  });

  it('valida input — valor > 0', async () => {
    const c = createInterClient(makeInterOpts({ fetchImpl: vi.fn() as any }));
    await expect(c.emitirBoleto({ ...validInput, valor: 0 })).rejects.toThrow(/valor/);
  });

  it('valida input — accountId presente', async () => {
    const c = createInterClient(makeInterOpts({ fetchImpl: vi.fn() as any }));
    await expect(c.emitirBoleto({ ...validInput, accountId: '' })).rejects.toThrow(/accountId/);
  });

  it('valida input — descricao presente', async () => {
    const c = createInterClient(makeInterOpts({ fetchImpl: vi.fn() as any }));
    await expect(c.emitirBoleto({ ...validInput, descricao: '' })).rejects.toThrow(/descricao/);
  });

  it('valida pagador.cpfCnpj e pagador.nome', async () => {
    const c = createInterClient(makeInterOpts({ fetchImpl: vi.fn() as any }));
    await expect(
      c.emitirBoleto({ ...validInput, pagador: { ...pagador, cpfCnpj: '' } }),
    ).rejects.toThrow(/cpfCnpj/);
    await expect(
      c.emitirBoleto({ ...validInput, pagador: { ...pagador, nome: '' } }),
    ).rejects.toThrow(/nome/);
  });

  it('rejeita data com formato inválido', async () => {
    const c = createInterClient(makeInterOpts({ fetchImpl: vi.fn() as any }));
    await expect(
      c.emitirBoleto({ ...validInput, vencimento: '30/04/2026' }),
    ).rejects.toThrow(/Data inválida/);
  });

  it('lança InterApiError com corpo preservado em erro HTTP', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async () => jsonResponse({ codigo: 'ERR_VAL', mensagem: 'valor inválido' }, 422),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    const p = c.emitirBoleto(validInput);
    await expect(p).rejects.toBeInstanceOf(InterApiError);
    await expect(p).rejects.toMatchObject({ status: 422, body: { codigo: 'ERR_VAL' } });
  });

  it('corpo de erro cai em texto quando não é JSON', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async () => new Response('internal', { status: 500 }),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    await expect(c.emitirBoleto(validInput)).rejects.toMatchObject({
      status: 500,
      body: 'internal',
    });
  });

  it('usa seuNumero explícito quando fornecido', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async (req) => {
        const body = await req.json();
        expect(body.seuNumero).toBe('CUSTOM-1');
        return jsonResponse({ codigoSolicitacao: 'x', situacao: 'OK' });
      },
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    const b = await c.emitirBoleto({ ...validInput, seuNumero: 'CUSTOM-1' });
    expect(b.seuNumero).toBe('CUSTOM-1');
  });

  it('extrai DDD/telefone separados do pagador', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async (req) => {
        const body = await req.json();
        expect(body.pagador.ddd).toBe('67');
        expect(body.pagador.telefone).toBe('999887766');
        return jsonResponse({ codigoSolicitacao: 'x', situacao: 'OK' });
      },
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    await c.emitirBoleto({
      ...validInput,
      pagador: { ...pagador, telefone: '(67) 99988-7766' },
    });
  });
});

describe('InterClient — consultarSaldo', () => {
  it('retorna saldo normalizado sem dataSaldo', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async (req) => {
        expect(req.url).toContain('/banking/v2/saldo');
        expect(req.url).not.toContain('?');
        return jsonResponse({
          disponivel: 1000,
          bloqueadoCheque: 50,
          bloqueadoJudicialmente: 10,
          bloqueadoAdministrativo: 5,
          limite: 200,
        });
      },
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    const saldo = await c.consultarSaldo();
    expect(saldo).toEqual({
      disponivel: 1000,
      bloqueado: 50,
      bloqueadoJudicialmente: 10,
      bloqueadoAdministrativo: 5,
      limite: 200,
    });
  });

  it('passa dataSaldo na query string', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async (req) => {
        expect(req.url).toContain('dataSaldo=2026-04-20');
        return jsonResponse({ disponivel: 0, bloqueado: 0 });
      },
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    await c.consultarSaldo('2026-04-20');
  });

  it('lança InterApiError em falha', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async () => jsonResponse({ erro: 'auth' }, 401),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    await expect(c.consultarSaldo()).rejects.toBeInstanceOf(InterApiError);
  });

  it('aplica defaults quando campos ausentes', async () => {
    const fetchImpl = makeFakeFetch([
      async () => jsonResponse({ access_token: 'TK', expires_in: 3600 }),
      async () => jsonResponse({}),
    ]);
    const c = createInterClient(makeInterOpts({ fetchImpl }));
    const s = await c.consultarSaldo();
    expect(s.disponivel).toBe(0);
    expect(s.bloqueado).toBe(0);
  });
});
