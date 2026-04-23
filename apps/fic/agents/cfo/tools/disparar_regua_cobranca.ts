/**
 * Tool: disparar_regua_cobranca (meta-tool)
 * Executa a régua de cobrança completa para inadimplentes.
 * Orquestra: check → Art. II guard → loop de WhatsApp por aluno.
 * Idempotente: não dispara 2x no mesmo dia.
 */

import { checkInadimplentes } from './check_inadimplentes.js';
import { sendWhatsappCobranca } from './send_whatsapp_cobranca.js';
import { computeEstagio, type ToolDef } from './shared.js';

const LIMITE_FINANCEIRO = 10_000;
const LIMITE_ALUNOS = 10;

export interface DispararReguaInput {
  dias_min: number;
  dry_run?: boolean;
}

export interface AlunoResult {
  aluno_id: string;
  estagio: string;
  status: 'sent' | 'skipped' | 'error';
  message_id?: string | null;
  skip_reason?: string;
  error?: string;
}

export interface DispararReguaOutput {
  status: 'completed' | 'pending_approval' | 'dry_run';
  total_alunos: number;
  total_valor: number;
  sent: number;
  skipped: number;
  errors: number;
  results: AlunoResult[];
  reason?: string;
}

export const dispararReguaCobranca: ToolDef<DispararReguaInput, DispararReguaOutput> = {
  name: 'disparar_regua_cobranca',
  description:
    'Executa a régua de cobrança para todos os inadimplentes com N+ dias de atraso. ' +
    'Envia WhatsApp no estágio correto. ' +
    'Se total > R$10k OU > 10 alunos: retorna pending_approval (Art. II). ' +
    'Use dry_run=true para ver o plano sem enviar nada.',
  input_schema: {
    type: 'object',
    required: ['dias_min'],
    properties: {
      dias_min: {
        type: 'number',
        minimum: 1,
        description: 'Filtro mínimo de dias em atraso para incluir na régua',
      },
      dry_run: {
        type: 'boolean',
        description: 'Se true, apenas simula sem enviar mensagens (default: false)',
        default: false,
      },
    },
  },
  handler: async ({ dias_min, dry_run = false }) => {
    const { alunos, total_valor } = await checkInadimplentes.handler({
      dias_min,
      limit: 200,
    });

    // Art. II — Human-in-the-loop: limites de volume
    if (total_valor > LIMITE_FINANCEIRO || alunos.length > LIMITE_ALUNOS) {
      return {
        status: 'pending_approval',
        total_alunos: alunos.length,
        total_valor,
        sent: 0,
        skipped: 0,
        errors: 0,
        results: [],
        reason:
          `Art. II: ${alunos.length > LIMITE_ALUNOS ? `${alunos.length} alunos > limite ${LIMITE_ALUNOS}` : ''} ` +
          `${total_valor > LIMITE_FINANCEIRO ? `R$${total_valor.toFixed(0)} > limite R$${LIMITE_FINANCEIRO}` : ''}`.trim() +
          '. Aguardando aprovação do Marcelo.',
      };
    }

    if (dry_run) {
      const results: AlunoResult[] = alunos.map((a) => ({
        aluno_id: a.aluno_id,
        estagio: computeEstagio(a.dias_atraso),
        status: 'skipped' as const,
        skip_reason: 'dry_run',
      }));

      return {
        status: 'dry_run',
        total_alunos: alunos.length,
        total_valor,
        sent: 0,
        skipped: alunos.length,
        errors: 0,
        results,
      };
    }

    // Execução real — serializada (evita race conditions no idempotency check)
    const results: AlunoResult[] = [];

    for (const aluno of alunos) {
      const estagio = computeEstagio(aluno.dias_atraso);

      try {
        const out = await sendWhatsappCobranca.handler({
          aluno_id: aluno.aluno_id,
          estagio,
          cobranca_id: aluno.cobranca_ativa_id,
        });

        results.push({
          aluno_id: aluno.aluno_id,
          estagio,
          status: out.sent ? 'sent' : 'skipped',
          message_id: out.message_id,
          skip_reason: out.skip_reason,
        });
      } catch (e) {
        results.push({
          aluno_id: aluno.aluno_id,
          estagio,
          status: 'error',
          error: String(e),
        });
      }
    }

    return {
      status: 'completed',
      total_alunos: alunos.length,
      total_valor,
      sent: results.filter((r) => r.status === 'sent').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      results,
    };
  },
};
