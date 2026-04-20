import {
  type Boleto,
  type BoletoInput,
  type InterClientOptions,
  InterApiError,
  type SaldoConta,
} from './types.js';

const PROD_BASE = 'https://cdpj.partners.bancointer.com.br';
const SANDBOX_BASE = 'https://cdpj.partners.uatinter.co';

interface TokenCacheEntry {
  accessToken: string;
  /** epoch ms em que o token expira (com margem de 30s aplicada ao expires_in). */
  expiresAt: number;
}

/**
 * Cliente do Banco Inter — API Cobrança v3 + Banking.
 *
 * mTLS: o Inter exige client certificate. Como `fetch` nativo do Node não aceita
 * cert/key diretamente, em produção o consumidor passa `fetchImpl` com um agent
 * configurado (undici Agent com tls options). Em sandbox/testes, `fetchImpl`
 * pode ser o fetch padrão ou um mock. Não prescrevemos o transporte — só o
 * contrato. Isso mantém o package agnóstico e fácil de testar.
 */
export class InterClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly scope: string;
  private readonly contaCorrente?: string;
  readonly certPem: string;
  readonly keyPem: string;

  private tokenCache: TokenCacheEntry | null = null;

  constructor(opts: InterClientOptions) {
    if (!opts.clientId) throw new Error('InterClient: clientId obrigatório');
    if (!opts.clientSecret) throw new Error('InterClient: clientSecret obrigatório');
    if (!opts.certPem) throw new Error('InterClient: certPem obrigatório (mTLS)');
    if (!opts.keyPem) throw new Error('InterClient: keyPem obrigatório (mTLS)');

    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.certPem = opts.certPem;
    this.keyPem = opts.keyPem;
    this.baseUrl = opts.baseUrl ?? (opts.sandbox ? SANDBOX_BASE : PROD_BASE);
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.scope = opts.scope ?? 'boleto-cobranca.read boleto-cobranca.write extrato.read';
    this.contaCorrente = opts.contaCorrente;
  }

  /** Expõe base URL para testes/observabilidade. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * OAuth2 client credentials. Cache local com margem de 30s contra drift.
   * O Inter retorna tokens com expires_in em segundos (tipicamente 3600).
   */
  async getAccessToken(force = false): Promise<string> {
    const now = Date.now();
    if (!force && this.tokenCache && this.tokenCache.expiresAt > now) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
      scope: this.scope,
    });

    const res = await this.fetchImpl(`${this.baseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errBody = await safeReadBody(res);
      throw new InterApiError(
        `OAuth2 falhou: ${res.status} ${res.statusText}`,
        res.status,
        errBody,
      );
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    if (!json.access_token || typeof json.expires_in !== 'number') {
      throw new InterApiError('OAuth2: resposta sem access_token/expires_in', 500, json);
    }

    const expiresAt = now + Math.max(0, (json.expires_in - 30) * 1000);
    this.tokenCache = { accessToken: json.access_token, expiresAt };
    return json.access_token;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    const h: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    if (this.contaCorrente) h['x-conta-corrente'] = this.contaCorrente;
    return h;
  }

  /**
   * Emite boleto na API Cobrança v3. O chamador cuida de idempotência em
   * camada superior (ver idempotency.ts). Aqui a chamada é direta — retry/cache
   * externo é responsabilidade do orquestrador.
   */
  async emitirBoleto(input: BoletoInput): Promise<Boleto> {
    validateBoletoInput(input);

    const seuNumero = input.seuNumero ?? makeSeuNumero(input.accountId, input.mesRef);
    const dataVencimento = toIsoDate(input.vencimento);

    const payload = {
      seuNumero,
      dataVencimento,
      valorNominal: round2(input.valor),
      numDiasAgenda: 0,
      pagador: {
        cpfCnpj: stripNonDigits(input.pagador.cpfCnpj),
        tipoPessoa: input.pagador.tipoPessoa,
        nome: input.pagador.nome,
        endereco: input.pagador.endereco,
        numero: input.pagador.numero ?? 'S/N',
        bairro: input.pagador.bairro,
        cidade: input.pagador.cidade,
        uf: input.pagador.uf,
        cep: stripNonDigits(input.pagador.cep),
        email: input.pagador.email,
        ddd: input.pagador.telefone ? stripNonDigits(input.pagador.telefone).slice(0, 2) : undefined,
        telefone: input.pagador.telefone
          ? stripNonDigits(input.pagador.telefone).slice(2)
          : undefined,
      },
      mensagem: { linha1: input.descricao.slice(0, 78) },
    };

    const headers = {
      ...(await this.authHeaders()),
      'Content-Type': 'application/json',
    };

    const res = await this.fetchImpl(`${this.baseUrl}/cobranca/v3/cobrancas`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await safeReadBody(res);
      throw new InterApiError(
        `emitirBoleto falhou: ${res.status} ${res.statusText}`,
        res.status,
        errBody,
      );
    }

    const body = (await res.json()) as {
      codigoSolicitacao?: string;
      nossoNumero?: string;
      situacao?: string;
      linkBoleto?: string;
    };

    return {
      seuNumero,
      nossoNumero: body.nossoNumero,
      codigoSolicitacao: body.codigoSolicitacao ?? '',
      situacao: body.situacao ?? 'EM_PROCESSAMENTO',
      dataVencimento,
      valorNominal: round2(input.valor),
      linkBoleto: body.linkBoleto,
      raw: body,
    };
  }

  /**
   * Consulta saldo da conta (Banking API v2).
   * Endpoint: GET /banking/v2/saldo?dataSaldo=YYYY-MM-DD
   */
  async consultarSaldo(dataSaldo?: Date | string): Promise<SaldoConta> {
    const headers = await this.authHeaders();
    const qs = dataSaldo ? `?dataSaldo=${toIsoDate(dataSaldo)}` : '';

    const res = await this.fetchImpl(`${this.baseUrl}/banking/v2/saldo${qs}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errBody = await safeReadBody(res);
      throw new InterApiError(
        `consultarSaldo falhou: ${res.status} ${res.statusText}`,
        res.status,
        errBody,
      );
    }

    const body = (await res.json()) as Record<string, number>;
    return {
      disponivel: body.disponivel ?? 0,
      bloqueado: body.bloqueadoCheque ?? body.bloqueado ?? 0,
      bloqueadoJudicialmente: body.bloqueadoJudicialmente,
      bloqueadoAdministrativo: body.bloqueadoAdministrativo,
      limite: body.limite,
    };
  }
}

export function createInterClient(opts: InterClientOptions): InterClient {
  return new InterClient(opts);
}

function validateBoletoInput(input: BoletoInput): void {
  if (!input.accountId) throw new Error('emitirBoleto: accountId obrigatório');
  if (!/^\d{4}-\d{2}$/.test(input.mesRef))
    throw new Error('emitirBoleto: mesRef deve estar no formato YYYY-MM');
  if (!(input.valor > 0)) throw new Error('emitirBoleto: valor deve ser > 0');
  if (!input.descricao) throw new Error('emitirBoleto: descricao obrigatória');
  if (!input.pagador?.cpfCnpj) throw new Error('emitirBoleto: pagador.cpfCnpj obrigatório');
  if (!input.pagador?.nome) throw new Error('emitirBoleto: pagador.nome obrigatório');
}

function makeSeuNumero(accountId: string, mesRef: string): string {
  return `${accountId}-${mesRef}`.slice(0, 15);
}

function toIsoDate(d: Date | string): string {
  if (typeof d === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}/.test(d))
      throw new Error(`Data inválida: "${d}" (esperado YYYY-MM-DD)`);
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function stripNonDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function safeReadBody(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}
