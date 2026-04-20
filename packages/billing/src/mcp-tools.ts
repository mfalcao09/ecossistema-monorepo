import type { BillingMcpTool } from './types.js';

/**
 * Ferramentas MCP para o módulo billing.
 * Expostas ao Orchestrator para uso pelos agentes CFO-IA e outros.
 * Formato compatível com Anthropic Managed Agents SDK (tool_use).
 */
export const billingMcpTools: BillingMcpTool[] = [
  {
    name: 'billing_emitir_boleto',
    description:
      'Emite um boleto bancário via Banco Inter para um aluno/contrato. ' +
      'Idempotente: se já existe boleto para (alunoId, mesRef), retorna o existente.',
    input_schema: {
      type: 'object',
      properties: {
        alunoId: {
          type: 'string',
          description: 'Identificador único do aluno no sistema',
        },
        mesRef: {
          type: 'string',
          description: "Mês de referência da mensalidade no formato 'YYYY-MM'",
        },
        valor: {
          type: 'number',
          description: 'Valor do boleto em reais (ex: 1250.00)',
        },
        vencimento: {
          type: 'string',
          description: 'Data de vencimento ISO 8601 (ex: 2026-05-10)',
        },
        descricao: {
          type: 'string',
          description: 'Descrição que aparece no boleto (ex: Mensalidade Maio/2026)',
        },
      },
      required: ['alunoId', 'mesRef', 'valor', 'vencimento', 'descricao'],
    },
  },
  {
    name: 'billing_consultar_saldo',
    description: 'Consulta o saldo disponível, bloqueado e agendado da conta Banco Inter.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'billing_consultar_boleto',
    description: 'Consulta status e dados de um boleto pelo nossoNumero (identificador Inter).',
    input_schema: {
      type: 'object',
      properties: {
        nossoNumero: {
          type: 'string',
          description: 'Identificador único do boleto no Banco Inter',
        },
      },
      required: ['nossoNumero'],
    },
  },
  {
    name: 'billing_listar_cobrancas',
    description: 'Lista cobranças emitidas em um intervalo de datas, com filtro opcional por status.',
    input_schema: {
      type: 'object',
      properties: {
        dataInicio: {
          type: 'string',
          description: 'Data inicial no formato YYYY-MM-DD',
        },
        dataFim: {
          type: 'string',
          description: 'Data final no formato YYYY-MM-DD',
        },
        status: {
          type: 'string',
          description: 'Filtro de status (opcional)',
          enum: ['EMITIDO', 'PAGO', 'CANCELADO', 'VENCIDO', 'EM_ABERTO', 'EXPIRADO'],
        },
      },
      required: ['dataInicio', 'dataFim'],
    },
  },
  {
    name: 'billing_verificar_webhook',
    description:
      'Verifica a assinatura HMAC-SHA-256 de um evento webhook do Banco Inter. ' +
      'DEVE ser chamado antes de processar qualquer payload de webhook.',
    input_schema: {
      type: 'object',
      properties: {
        payload: {
          type: 'string',
          description: 'Corpo bruto do webhook (JSON string)',
        },
        signature: {
          type: 'string',
          description: "Header x-inter-signature recebido (ex: 'sha256=abc...')",
        },
      },
      required: ['payload', 'signature'],
    },
  },
];
