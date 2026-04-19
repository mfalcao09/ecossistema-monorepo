export type FetchFn = typeof globalThis.fetch;

export interface InterClientOptions {
  clientId: string;
  clientSecret: string;
  /** PEM-encoded client certificate (from vault INTER_CERT_PEM) */
  certPem: string;
  /** PEM-encoded private key (from vault INTER_KEY_PEM) */
  keyPem: string;
  /** default: true (sandbox) */
  sandbox?: boolean;
  /** Inject a custom fetch for testing */
  fetchFn?: FetchFn;
}

export interface BoletoInput {
  alunoId: string;
  mesRef: string; // 'YYYY-MM'
  valor: number;
  vencimento: Date;
  descricao: string;
  pagador?: PagadorInfo;
}

export interface PagadorInfo {
  cpfCnpj: string;
  nome: string;
  tipoPessoa?: 'FISICA' | 'JURIDICA';
  email?: string;
  telefone?: string;
  endereco?: EnderecoInfo;
}

export interface EnderecoInfo {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface Boleto {
  nossoNumero: string;
  codigoBarras: string;
  linhaDigitavel: string;
  pixCopiaECola?: string;
  status: BoletoStatusValue;
  valor: number;
  vencimento: string;
}

export type BoletoStatusValue =
  | 'EMITIDO'
  | 'PAGO'
  | 'CANCELADO'
  | 'VENCIDO'
  | 'EM_ABERTO'
  | 'EXPIRADO';

export interface Saldo {
  disponivel: number;
  bloqueado: number;
  agendado: number;
}

export interface ListarCobrancasParams {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  status?: BoletoStatusValue;
  paginaAtual?: number;
  itensPorPagina?: number;
}

export interface CobrancasResponse {
  totalPages: number;
  totalElements: number;
  content: Boleto[];
}

export interface WebhookEvent {
  event: string;
  nossoNumero: string;
  valor: number;
  dataPagamento: string;
  txid?: string;
}

export interface WebhookResult {
  processed: boolean;
  eventId: string;
  idempotent: boolean;
}

export interface IdempotencyRecord {
  idempotency_key: string;
  result: unknown;
  expires_at: string;
  created_at: string;
}

export interface McpToolInputSchema {
  type: 'object';
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required?: string[];
}

export interface BillingMcpTool {
  name: string;
  description: string;
  input_schema: McpToolInputSchema;
}
