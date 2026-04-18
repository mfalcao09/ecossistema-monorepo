/**
 * Tool: emit_boleto_aluno
 * Emite boleto para um aluno via Banco Inter (SC-29 Modo B).
 * Credenciais nunca expostas — SC-29 proxy faz o call externo.
 * Idempotente: seuNumero = FIC-{aluno_id}-{mes_ref} garante unicidade na Inter.
 */

import {
  supabase,
  fetchAluno,
  calcDataVencimento,
  credentialsProxy,
  INTER_BASE_URL,
  type ToolDef,
} from './shared.js';

export interface EmitBoletoAlunoInput {
  aluno_id: string;
  mes_ref: string;
  valor: number;
}

export interface EmitBoletoAlunoOutput {
  cobranca_id: string;
  inter_id: string;
  pix_qrcode: string | null;
  data_vencimento: string;
}

export const emitBoletoAluno: ToolDef<EmitBoletoAlunoInput, EmitBoletoAlunoOutput> = {
  name: 'emit_boleto_aluno',
  description:
    'Emite boleto de mensalidade para um aluno via Banco Inter. ' +
    'Usa SC-29 Modo B — credenciais nunca expostas. ' +
    'Idempotente: chamar 2x com mesmo aluno_id + mes_ref retorna o boleto existente.',
  input_schema: {
    type: 'object',
    required: ['aluno_id', 'mes_ref', 'valor'],
    properties: {
      aluno_id: { type: 'string', description: 'UUID do aluno no Supabase FIC' },
      mes_ref: {
        type: 'string',
        description: 'Mês de referência no formato YYYY-MM (ex: 2026-05)',
        pattern: '^\\d{4}-\\d{2}$',
      },
      valor: {
        type: 'number',
        description: 'Valor do boleto em reais (mínimo R$1,00)',
        minimum: 1,
      },
    },
  },
  handler: async ({ aluno_id, mes_ref, valor }) => {
    // Verifica boleto já emitido para este mês (idempotência local antes da Inter)
    const { data: existente } = await supabase
      .from('cobrancas')
      .select('id, inter_cobranca_id, pix_qrcode, data_vencimento')
      .eq('aluno_id', aluno_id)
      .eq('mes_ref', mes_ref)
      .in('status', ['emitido', 'enviado', 'pendente'])
      .maybeSingle();

    if (existente) {
      return {
        cobranca_id: existente.id as string,
        inter_id: existente.inter_cobranca_id as string,
        pix_qrcode: (existente.pix_qrcode as string | null) ?? null,
        data_vencimento: existente.data_vencimento as string,
      };
    }

    const aluno = await fetchAluno(aluno_id);
    const data_vencimento = calcDataVencimento(mes_ref);

    // SC-29 Modo B: proxy chama Banco Inter com credenciais do vault
    const result = await credentialsProxy({
      credential_name: 'INTER_CLIENT_ID',
      project: 'fic',
      target: {
        method: 'POST',
        url: `${INTER_BASE_URL}/cobranca/v3/cobrancas`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          seuNumero: `FIC-${aluno_id}-${mes_ref}`,
          valorNominal: valor,
          dataVencimento: data_vencimento,
          numDiasAgenda: 60,
          pagador: {
            cpfCnpj: aluno.cpf,
            tipoPessoa: 'FISICA',
            nome: aluno.nome,
            logradouro: aluno.endereco?.logradouro ?? '',
            numero: aluno.endereco?.numero ?? 'S/N',
            bairro: aluno.endereco?.bairro ?? '',
            cidade: aluno.endereco?.cidade ?? 'Cassilândia',
            uf: aluno.endereco?.uf ?? 'MS',
            cep: aluno.endereco?.cep ?? '',
          },
        },
      },
    });

    const interBody = result.body as Record<string, unknown>;
    const inter_id = interBody['codigoSolicitacao'] as string;
    const pix = interBody['pix'] as Record<string, string> | undefined;
    const pix_qrcode = pix?.['qrcode'] ?? null;

    // Persiste cobrança no Supabase
    const { data: cobranca, error } = await supabase
      .from('cobrancas')
      .insert({
        aluno_id,
        mes_ref,
        valor,
        data_vencimento,
        tipo: 'mensalidade',
        status: 'emitido',
        inter_cobranca_id: inter_id,
        pix_qrcode,
      })
      .select('id')
      .single();

    if (error || !cobranca) {
      throw new Error(`Boleto emitido na Inter mas falhou ao salvar: ${error?.message}`);
    }

    return {
      cobranca_id: cobranca.id as string,
      inter_id,
      pix_qrcode,
      data_vencimento,
    };
  },
};
