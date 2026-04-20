import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InterClient, createInterClient } from '../src/inter-client.js';
import type { InterClientOptions } from '../src/types.js';

const MOCK_OPTS: InterClientOptions = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  certPem: '---CERT---',
  keyPem: '---KEY---',
  sandbox: true,
};

const TOKEN_RESPONSE = {
  access_token: 'eyJhbGciOiJSUzI1NiJ9.mock',
  expires_in: 3600,
  token_type: 'Bearer',
};

function mockFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

function mockFetchSequence(...responses: Array<{ ok: boolean; status: number; body: unknown }>) {
  const fetchMock = vi.fn();
  responses.forEach((resp) => {
    fetchMock.mockResolvedValueOnce({
      ok: resp.ok,
      status: resp.status,
      json: vi.fn().mockResolvedValue(resp.body),
      text: vi.fn().mockResolvedValue(JSON.stringify(resp.body)),
    });
  });
  return fetchMock;
}

describe('InterClient — OAuth2', () => {
  it('obtém token antes da primeira chamada API', async () => {
    const boletoResp = {
      nossoNumero: 'N001',
      codigoBarras: '123456',
      linhaDigitavel: '789',
      pixCopiaECola: 'pix123',
    };

    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: boletoResp },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });

    await client.emitirBoleto({
      alunoId: 'aluno-001',
      mesRef: '2026-05',
      valor: 1250,
      vencimento: new Date('2026-05-10'),
      descricao: 'Mensalidade Maio',
    });

    // Primeiro call = token
    const tokenCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenCall[0]).toContain('/oauth/v2/token');
    expect(tokenCall[1].method).toBe('POST');
  });

  it('reutiliza token cacheado na segunda chamada', async () => {
    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: { disponivel: 1000, bloqueado: 0, agendado: 0 } },
      { ok: true, status: 200, body: { disponivel: 1000, bloqueado: 0, agendado: 0 } },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    await client.consultarSaldo();
    await client.consultarSaldo();

    // Só 1 call para token, 2 calls para saldo
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('lança erro quando OAuth2 falha (401)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    await expect(client.consultarSaldo()).rejects.toThrow('Inter OAuth2 error 401');
  });
});

describe('InterClient — emitirBoleto', () => {
  it('emite boleto e retorna dados estruturados', async () => {
    const boletoResp = {
      nossoNumero: 'N0042',
      codigoBarras: '03399.01234 56789.012345 67890.123456 9 99990001250',
      linhaDigitavel: '033991234 5 67890123456 7890123456 9 99990001250',
      pixCopiaECola: '00020126580014BR.GOV.BCB.PIX',
    };

    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: boletoResp },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    const boleto = await client.emitirBoleto({
      alunoId: 'aluno-42',
      mesRef: '2026-05',
      valor: 1250.0,
      vencimento: new Date('2026-05-10'),
      descricao: 'Mensalidade Maio/2026',
    });

    expect(boleto.nossoNumero).toBe('N0042');
    expect(boleto.status).toBe('EMITIDO');
    expect(boleto.valor).toBe(1250);
    expect(boleto.vencimento).toBe('2026-05-10');
    expect(boleto.pixCopiaECola).toBe(boletoResp.pixCopiaECola);
  });

  it('envia seuNumero como <alunoId>-<mesRef>', async () => {
    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: { nossoNumero: 'N1', codigoBarras: 'C', linhaDigitavel: 'L' } },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    await client.emitirBoleto({
      alunoId: 'aluno-7',
      mesRef: '2026-06',
      valor: 800,
      vencimento: new Date('2026-06-05'),
      descricao: 'Junho',
    });

    const apiCall = fetchMock.mock.calls[1] as [string, RequestInit];
    const sentBody = JSON.parse(apiCall[1].body as string) as Record<string, unknown>;
    expect(sentBody.seuNumero).toBe('aluno-7-2026-06');
  });

  it('lança erro quando API retorna 422', async () => {
    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: false, status: 422, body: { detail: 'Dados inválidos' } },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    await expect(
      client.emitirBoleto({
        alunoId: 'a',
        mesRef: '2026-01',
        valor: 0,
        vencimento: new Date(),
        descricao: 'x',
      }),
    ).rejects.toThrow('Inter API 422');
  });
});

describe('InterClient — consultarSaldo', () => {
  it('retorna saldo com campos corretos', async () => {
    const saldo = { disponivel: 5000.5, bloqueado: 200, agendado: 0 };
    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: saldo },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    const result = await client.consultarSaldo();

    expect(result.disponivel).toBe(5000.5);
    expect(result.bloqueado).toBe(200);
    expect(result.agendado).toBe(0);

    const apiCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(apiCall[0]).toContain('/banking/v2/saldo');
  });
});

describe('InterClient — listarCobrancas', () => {
  it('inclui dataInicio e dataFim na query string', async () => {
    const response = { totalPages: 1, totalElements: 1, content: [] };
    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: response },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    await client.listarCobrancas({ dataInicio: '2026-05-01', dataFim: '2026-05-31' });

    const apiCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(apiCall[0]).toContain('dataInicial=2026-05-01');
    expect(apiCall[0]).toContain('dataFinal=2026-05-31');
  });

  it('adiciona filtro de status quando fornecido', async () => {
    const response = { totalPages: 1, totalElements: 0, content: [] };
    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: response },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    await client.listarCobrancas({ dataInicio: '2026-05-01', dataFim: '2026-05-31', status: 'PAGO' });

    const apiCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(apiCall[0]).toContain('situacao=PAGO');
  });
});

describe('InterClient — consultarBoleto', () => {
  it('retorna boleto pelo nossoNumero', async () => {
    const boleto = {
      nossoNumero: 'N0099',
      codigoBarras: 'C99',
      linhaDigitavel: 'L99',
      status: 'EM_ABERTO',
      valor: 700,
      vencimento: '2026-06-01',
    };
    const fetchMock = mockFetchSequence(
      { ok: true, status: 200, body: TOKEN_RESPONSE },
      { ok: true, status: 200, body: boleto },
    );

    const client = new InterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    const result = await client.consultarBoleto('N0099');

    expect(result.nossoNumero).toBe('N0099');
    expect(result.status).toBe('EM_ABERTO');

    const apiCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(apiCall[0]).toContain('/cobranca/v3/cobrancas/N0099');
  });
});

describe('createInterClient', () => {
  it('cria instância de InterClient', () => {
    const fetchMock = vi.fn();
    const client = createInterClient({ ...MOCK_OPTS, fetchFn: fetchMock as typeof fetch });
    expect(client).toBeInstanceOf(InterClient);
  });
});
