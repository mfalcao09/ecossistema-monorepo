/**
 * Tool: check_inadimplentes
 * Consulta a view de inadimplência do FIC com filtros configuráveis.
 * Retorna lista de alunos com atraso + totalizadores.
 */

import { supabase, type ToolDef } from './shared.js';

export interface CheckInadimplentesInput {
  dias_min?: number;
  curso_id?: string | null;
  limit?: number;
}

export interface AlunoInadimplente {
  aluno_id: string;
  nome: string;
  cpf_hash: string;
  curso: string;
  dias_atraso: number;
  valor_devido: number;
  cobranca_ativa_id: string;
  whatsapp_hash: string | null;
}

export interface CheckInadimplentesOutput {
  count: number;
  total_valor: number;
  alunos: AlunoInadimplente[];
}

export const checkInadimplentes: ToolDef<
  CheckInadimplentesInput,
  CheckInadimplentesOutput
> = {
  name: 'check_inadimplentes',
  description:
    'Consulta alunos inadimplentes da FIC. Retorna lista com dias de atraso, ' +
    'valor devido e ID da cobrança ativa. Use antes de disparar a régua.',
  input_schema: {
    type: 'object',
    properties: {
      dias_min: {
        type: 'number',
        description: 'Mínimo de dias em atraso (default: 15)',
        default: 15,
      },
      curso_id: {
        type: 'string',
        description: 'Filtra por curso específico (opcional)',
        nullable: true,
      },
      limit: {
        type: 'number',
        description: 'Máximo de registros (default: 100)',
        default: 100,
      },
    },
  },
  handler: async ({ dias_min = 15, curso_id = null, limit = 100 }) => {
    let query = supabase
      .from('alunos_view_inadimplencia')
      .select(
        'aluno_id, nome, cpf_hash, curso, curso_id, dias_atraso, ' +
          'mensalidade_valor, cobranca_ativa_id, whatsapp_hash'
      )
      .gte('dias_atraso', dias_min)
      .limit(limit);

    if (curso_id) {
      query = query.eq('curso_id', curso_id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao consultar inadimplentes: ${error.message}`);
    }

    const alunos = (data ?? []).map((a) => ({
      aluno_id: a.aluno_id as string,
      nome: a.nome as string,
      cpf_hash: a.cpf_hash as string,
      curso: a.curso as string,
      dias_atraso: a.dias_atraso as number,
      valor_devido:
        (a.mensalidade_valor as number) *
        (Math.floor((a.dias_atraso as number) / 30) + 1),
      cobranca_ativa_id: a.cobranca_ativa_id as string,
      whatsapp_hash: (a.whatsapp_hash as string | null) ?? null,
    }));

    const total_valor = alunos.reduce((s, a) => s + a.valor_devido, 0);

    return { count: alunos.length, total_valor, alunos };
  },
};
