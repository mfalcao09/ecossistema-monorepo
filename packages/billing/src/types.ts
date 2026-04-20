/**
 * Tipos públicos do @ecossistema/billing.
 *
 * Separados em módulo próprio para facilitar reuso em consumidores (orchestrator,
 * MCP servers, apps/erp-educacional) sem puxar dependências pesadas.
 */

export interface InterClientOptions {
  clientId: string;
  clientSecret: string;
  /** PEM string do client cert (mTLS do Inter). Pode vir do vault. */
  certPem: string;
  /** PEM string da chave privada associada ao cert. */
  keyPem: string;
  /** Se true, usa endpoint sandbox `cdpj.partners.uatinter.co`. */
  sandbox?: boolean;
  /** Override completo do base URL (uso interno/testes). */
  baseUrl?: string;
  /** Injetável para testes — default `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Escopos OAuth2 a solicitar. Default cobre boletos e extrato. */
  scope?: string;
  /** Conta corrente (x-conta-corrente header) — multi-conta. Opcional. */
  contaCorrente?: string;
}

export interface BoletoInput {
  /** Identificador no domínio do chamador (ex.: aluno_id). */
  accountId: string;
  /** 'YYYY-MM' — idempotência: mesmo accountId+mesRef = mesmo boleto. */
  mesRef: string;
  /** Valor em reais (> 0). */
  valor: number;
  /** Data de vencimento (Date ou ISO-8601 YYYY-MM-DD). */
  vencimento: Date | string;
  /** Texto livre exibido no boleto. */
  descricao: string;
  /** Pagador — obrigatório pelo Inter. */
  pagador: Pagador;
  /** Seu número (identificador no Inter). Se omitido, gerado a partir de accountId+mesRef. */
  seuNumero?: string;
}

export interface Pagador {
  cpfCnpj: string;
  tipoPessoa: 'FISICA' | 'JURIDICA';
  nome: string;
  endereco: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep: string;
  email?: string;
  telefone?: string;
}

export interface Boleto {
  seuNumero: string;
  /** nossoNumero retornado pelo Inter após emissão. */
  nossoNumero?: string;
  codigoSolicitacao: string;
  situacao: string;
  dataVencimento: string;
  valorNominal: number;
  linkBoleto?: string;
  /** Payload cru do Inter — auditoria/debug. */
  raw?: unknown;
}

export interface SaldoConta {
  disponivel: number;
  bloqueado: number;
  bloqueadoJudicialmente?: number;
  bloqueadoAdministrativo?: number;
  limite?: number;
}

export interface WebhookVerifyInput {
  /** Body cru recebido (string ou Buffer). Nunca use JSON parse antes. */
  rawBody: string | Uint8Array;
  /** Valor do header assinatura (ex.: `x-inter-signature` ou `sha256=...`). */
  signature: string;
  /** HMAC secret configurado no Inter. */
  secret: string;
}

export interface IdempotencyEntry {
  key: string;
  result: unknown;
  createdAt: string;
  expiresAt: string;
}

/** Para inversão de dependência — qualquer impl que satisfaça isso serve. */
export interface IdempotencyStore {
  check(key: string): Promise<IdempotencyEntry | null>;
  set(key: string, result: unknown, ttlSeconds?: number): Promise<IdempotencyEntry>;
}

export class InterApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'InterApiError';
  }
}
