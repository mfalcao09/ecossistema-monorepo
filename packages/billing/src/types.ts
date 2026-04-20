export type FetchFn = typeof globalThis.fetch;

/**
 * Opções do InterClient.
 *
 * Produção + Sandbox (mTLS): certPem + keyPem obrigatórios — Inter exige mTLS em ambos os ambientes.
 * Testes unitários: passe fetchFn para injetar mock sem certificados.
 *
 * contaCorrente: número da conta PJ (obrigatório em endpoints de cobrança e banking).
 */
export type InterClientOptions =
  | {
      clientId: string;
      clientSecret: string;
      /** PEM-encoded client certificate (from vault INTER_CERT_PEM) */
      certPem: string;
      /** PEM-encoded private key (from vault INTER_KEY_PEM) */
      keyPem: string;
      /** Número da conta corrente PJ — passado como X-Conta-Corrente nos requests */
      contaCorrente?: string;
      /** default: true (sandbox) */
      sandbox?: boolean;
      fetchFn?: FetchFn;
    }
  | {
      clientId: string;
      clientSecret: string;
      certPem?: undefined;
      keyPem?: undefined;
      contaCorrente?: string;
      /** default: true (sandbox) */
      sandbox?: boolean;
      /** Obrigatório quando certPem/keyPem não fornecidos (apenas testes unitários) */
      fetchFn: FetchFn;
    };

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
  /** Inter v3 async: UUID retornado no POST, usar para consultar o boleto após processamento */
  codigoSolicitacao?: string;
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

/**
 * Resposta do GET /cobranca/v3/cobrancas/{codigoSolicitacao}.
 * Estrutura aninhada retornada pela API Inter v3.
 */
export interface CobrancaDetalhe {
  codigoSolicitacao: string;
  seuNumero: string;
  dataEmissao: string;
  dataVencimento: string;
  valorNominal: number;
  tipoCobranca: string;
  situacao: BoletoStatusValue;
  dataSituacao: string;
  valorTotalRecebido?: number;
  origemRecebimento?: string;
  arquivada: boolean;
  boleto?: {
    nossoNumero: string;
    codigoBarras: string;
    linhaDigitavel: string;
  };
  pix?: {
    txid: string;
    pixCopiaECola: string;
  };
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
