import https from 'node:https';
import type {
  InterClientOptions,
  BoletoInput,
  Boleto,
  Saldo,
  ListarCobrancasParams,
  CobrancasResponse,
  FetchFn,
} from './types.js';

const SANDBOX_BASE = 'https://cdpj.partners.uatinter.co';
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
 * Usado em produção para autenticação mútua com o Banco Inter.
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
  private readonly fetch: FetchFn;
  private cachedToken: CachedToken | null = null;

  constructor(opts: InterClientOptions) {
    this.baseUrl = opts.sandbox !== false ? SANDBOX_BASE : PROD_BASE;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
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
      scope: 'extrato.read boleto-cobranca.read boleto-cobranca.write',
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
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Inter API ${res.status} em ${path}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async emitirBoleto(input: BoletoInput): Promise<Boleto> {
    const payload = {
      seuNumero: `${input.alunoId}-${input.mesRef}`,
      valorNominal: input.valor,
      vencimento: input.vencimento.toISOString().split('T')[0],
      mensagem: { linha1: input.descricao },
      pagador: input.pagador ?? {
        cpfCnpj: '00000000000',
        nome: 'Aluno',
        tipoPessoa: 'FISICA',
      },
    };

    const data = await this.request<{
      nossoNumero: string;
      codigoBarras: string;
      linhaDigitavel: string;
      pixCopiaECola?: string;
    }>('/cobranca/v3/cobrancas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      nossoNumero: data.nossoNumero,
      codigoBarras: data.codigoBarras,
      linhaDigitavel: data.linhaDigitavel,
      pixCopiaECola: data.pixCopiaECola,
      status: 'EMITIDO',
      valor: input.valor,
      vencimento: input.vencimento.toISOString().split('T')[0],
    };
  }

  async consultarSaldo(): Promise<Saldo> {
    return this.request<Saldo>('/banking/v2/saldo');
  }

  async consultarBoleto(nossoNumero: string): Promise<Boleto> {
    return this.request<Boleto>(`/cobranca/v3/cobrancas/${nossoNumero}`);
  }

  async listarCobrancas(params: ListarCobrancasParams): Promise<CobrancasResponse> {
    const qs = new URLSearchParams({
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      ...(params.status ? { situacao: params.status } : {}),
      paginaAtual: String(params.paginaAtual ?? 0),
      itensPorPagina: String(params.itensPorPagina ?? 100),
    });
    return this.request<CobrancasResponse>(`/cobranca/v3/cobrancas?${qs.toString()}`);
  }
}

/** Factory para manter compatibilidade com API funcional do stub */
export function createInterClient(opts: InterClientOptions): InterClient {
  return new InterClient(opts);
}
