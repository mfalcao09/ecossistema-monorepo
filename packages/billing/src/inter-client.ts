import https from 'node:https';
import type {
  InterClientOptions,
  BoletoInput,
  Boleto,
  CobrancaDetalhe,
  Saldo,
  ListarCobrancasParams,
  CobrancasResponse,
  FetchFn,
} from './types.js';

const SANDBOX_BASE = 'https://cdpj-sandbox.partners.uatinter.co';
const PROD_BASE = 'https://cdpj.partners.bancointer.com.br';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Cria um fetch mTLS usando node:https com certificados PEM.
 * Obrigatório em produção; sandbox também requer mTLS.
 */
function createMtlsFetch(certPem: string, keyPem: string): FetchFn {
  const agent = new https.Agent({ cert: certPem, key: keyPem });

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

    return new Promise<Response>((resolve, reject) => {
      const parsedUrl = new URL(url);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body as string | undefined;

      const incomingHeaders = init?.headers
        ? Object.fromEntries(new Headers(init.headers as HeadersInit).entries())
        : {};

      const reqOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: Number(parsedUrl.port || 443),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: incomingHeaders,
        agent,
      };

      const req = https.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const bodyStr = Buffer.concat(chunks).toString('utf8');
          const responseHeaders = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) {
              responseHeaders.set(k, Array.isArray(v) ? v.join(', ') : v);
            }
          }
          resolve(new Response(bodyStr, {
            status: res.statusCode ?? 200,
            headers: responseHeaders,
          }));
        });
        res.on('error', reject);
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };
}

export class InterClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly contaCorrente?: string;
  private readonly fetch: FetchFn;
  private cachedToken: CachedToken | null = null;

  constructor(opts: InterClientOptions) {
    this.baseUrl = opts.sandbox !== false ? SANDBOX_BASE : PROD_BASE;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.contaCorrente = opts.contaCorrente;
    this.fetch = opts.fetchFn ?? createMtlsFetch(opts.certPem, opts.keyPem);
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'extrato.read boleto-cobranca.read boleto-cobranca.write webhook.read webhook.write',
    });

    const res = await this.fetch(`${this.baseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Inter OAuth2 error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as TokenResponse;
    this.cachedToken = {
      token: data.access_token,
      // 30s de margem para evitar usar token prestes a expirar
      expiresAt: Date.now() + (data.expires_in - 30) * 1000,
    };

    return data.access_token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken();

    // X-Conta-Corrente: obrigatório em endpoints de cobrança e banking
    const contaCorrenteHeader = this.contaCorrente
      ? { 'X-Conta-Corrente': this.contaCorrente }
      : {};

    const res = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...contaCorrenteHeader,
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Inter API ${res.status} em ${path}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Cobrança ────────────────────────────────────────────────────────────

  /**
   * Emite um boleto+Pix (v3 assíncrono).
   * Retorna codigoSolicitacao; usar consultarBoleto() para obter código de barras.
   */
  async emitirBoleto(input: BoletoInput): Promise<Boleto> {
    // seuNumero: máx 15 chars (limitação hard da API Inter)
    const seuNumero = `${input.alunoId}-${input.mesRef}`.slice(0, 15);

    const payload = {
      seuNumero,
      valorNominal: input.valor,
      dataVencimento: input.vencimento.toISOString().split('T')[0],
      mensagem: { linha1: input.descricao },
      pagador: input.pagador ?? {
        cpfCnpj: '00000000000',
        nome: 'Aluno Teste',
        tipoPessoa: 'FISICA',
        endereco: 'Rua Teste',
        numero: '1',
        bairro: 'Centro',
        cidade: 'Belo Horizonte',
        uf: 'MG',
        cep: '30130010',
      },
    };

    const data = await this.request<{
      codigoSolicitacao?: string;
      nossoNumero?: string;
      codigoBarras?: string;
      linhaDigitavel?: string;
      pixCopiaECola?: string;
    }>('/cobranca/v3/cobrancas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      nossoNumero: data.nossoNumero ?? data.codigoSolicitacao ?? '',
      codigoBarras: data.codigoBarras ?? '',
      linhaDigitavel: data.linhaDigitavel ?? '',
      pixCopiaECola: data.pixCopiaECola,
      codigoSolicitacao: data.codigoSolicitacao,
      status: 'EMITIDO',
      valor: input.valor,
      vencimento: input.vencimento.toISOString().split('T')[0],
    };
  }

  /**
   * Consulta cobrança pelo codigoSolicitacao (UUID retornado por emitirBoleto).
   * Retorna a cobrança completa com boleto.codigoBarras e pix.pixCopiaECola.
   */
  async consultarBoleto(codigoSolicitacao: string): Promise<CobrancaDetalhe> {
    return this.request<CobrancaDetalhe>(`/cobranca/v3/cobrancas/${codigoSolicitacao}`);
  }

  async listarCobrancas(params: ListarCobrancasParams): Promise<CobrancasResponse> {
    const qs = new URLSearchParams({
      dataInicial: params.dataInicio,
      dataFinal: params.dataFim,
      ...(params.status ? { situacao: params.status } : {}),
      paginaAtual: String(params.paginaAtual ?? 0),
      itensPorPagina: String(params.itensPorPagina ?? 100),
    });

    // API retorna 'cobrancas' + 'totalElementos'; normalizar para CobrancasResponse
    const raw = await this.request<{
      cobrancas?: Boleto[];
      content?: Boleto[];
      totalElementos?: number;
      totalElements?: number;
      totalPaginas?: number;
      totalPages?: number;
    }>(`/cobranca/v3/cobrancas?${qs.toString()}`);

    return {
      totalElements: raw.totalElements ?? raw.totalElementos ?? 0,
      totalPages:    raw.totalPages    ?? raw.totalPaginas   ?? 0,
      content:       raw.content       ?? raw.cobrancas      ?? [],
    };
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────

  /**
   * Registra (ou atualiza) a URL do webhook de boleto.
   * Escopo necessário: webhook.write
   */
  async registrarWebhookBoleto(webhookUrl: string): Promise<void> {
    await this.request<void>('/cobranca/v3/cobrancas/webhook', {
      method: 'PUT',
      body: JSON.stringify({ webhookUrl }),
    });
  }

  /** Consulta o webhook de boleto cadastrado. */
  async consultarWebhookBoleto(): Promise<{ webhookUrl: string; criacao: string; atualizacao?: string }> {
    return this.request('/cobranca/v3/cobrancas/webhook');
  }

  // ─── Banking ─────────────────────────────────────────────────────────────

  async consultarSaldo(): Promise<Saldo> {
    return this.request<Saldo>('/banking/v2/saldo');
  }
}

/** Factory para manter compatibilidade com API funcional do stub */
export function createInterClient(opts: InterClientOptions): InterClient {
  return new InterClient(opts);
}
