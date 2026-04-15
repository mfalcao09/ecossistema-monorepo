/**
 * Sprint 2 / Etapa 3a — POST /api/extracao/sessoes/[sessaoId]/converter
 *
 * Converte uma extracao_sessao em um processos_emissao definitivo.
 *
 * Fluxo:
 *  1. Autentica + CSRF-skip (chamada direta da UI da Tela 2).
 *  2. Valida body: { override_justificativa?: string }.
 *  3. Busca a sessão + seus processo_arquivos (ainda vinculados via sessao_id).
 *  4. Monta o input do gate (gate-criacao-processo.ts) a partir dos dados
 *     confirmados da sessão + arquivos anexados.
 *  5. Roda o gate. Se houver bloqueantes E o operador NÃO forneceu
 *     override_justificativa, retorna 422 com a lista de violações.
 *  6. Se o gate passar OU o operador tiver fornecido override, chama a
 *     RPC `converter_sessao_em_processo` (transacional, idempotente).
 *  7. Retorna 200 com { processo_id }.
 *
 * Princípio universal override humano (sessão 022):
 *  - Toda regra pode ser sobrescrita com justificativa.
 *  - O frontend dispara esta rota 2x em caso de bloqueio:
 *     (a) primeira chamada sem override → recebe 422 com violações
 *     (b) operador preenche modal de justificativa → reenvia com override
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { protegerRota } from '@/lib/security/api-guard';
import { createClient } from '@/lib/supabase/server';
import {
  validarGateCriacaoProcesso,
  type InputGateCriacao,
} from '@/lib/diploma/gate-criacao-processo';
import type { TipoXsdComprobatorio } from '@/lib/diploma/regras-fic';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// ─── Schema de entrada ──────────────────────────────────────────────────────

const bodySchema = z.object({
  override_justificativa: z
    .string()
    .trim()
    .min(10, 'Justificativa precisa ter pelo menos 10 caracteres')
    .max(2000, 'Justificativa não pode passar de 2000 caracteres')
    .nullable()
    .optional(),
});

// ─── Tipos auxiliares ───────────────────────────────────────────────────────

interface ArquivoRow {
  id: string;
  tipo_xsd: string | null;
  destino_xml: boolean;
  destino_acervo: boolean;
  tamanho_bytes: number | null;
}

interface SessaoRow {
  id: string;
  usuario_id: string | null;
  status: string;
  processo_id: string | null;
  dados_confirmados: Record<string, unknown> | null;
  dados_extraidos: Record<string, unknown> | null;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const POST = protegerRota(
  async (request, auth) => {
    // Next 15: params é Promise no route handler de segmentos dinâmicos.
    // protegerRota não repassa params; extraímos da URL manualmente.
    const url = new URL(request.url);
    // pathname: /api/extracao/sessoes/<sessaoId>/converter
    const match = url.pathname.match(/\/sessoes\/([^/]+)\/converter\/?$/);
    const sessaoId = match?.[1];

    if (!sessaoId || !/^[0-9a-f-]{36}$/i.test(sessaoId)) {
      return NextResponse.json(
        { erro: 'SESSAO_ID_INVALIDO', mensagem: 'sessaoId deve ser UUID válido' },
        { status: 400 },
      );
    }

    // Body
    let overrideJustificativa: string | null = null;
    try {
      const rawBody = await request.json().catch(() => ({}));
      const parsed = bodySchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          {
            erro: 'BODY_INVALIDO',
            mensagem: 'Body inválido',
            detalhes: parsed.error.flatten(),
          },
          { status: 400 },
        );
      }
      overrideJustificativa = parsed.data.override_justificativa ?? null;
    } catch {
      // body vazio ou não-JSON: ok, trata como sem override
      overrideJustificativa = null;
    }

    const supabase = await createClient();

    // 1. Busca a sessão (RLS já filtra por usuario_id = auth.uid())
    const { data: sessao, error: errSessao } = await supabase
      .from('extracao_sessoes')
      .select('id, usuario_id, status, processo_id, dados_confirmados, dados_extraidos')
      .eq('id', sessaoId)
      .maybeSingle<SessaoRow>();

    if (errSessao) {
      console.error('[converter] erro ao buscar sessão:', errSessao);
      return NextResponse.json(
        { erro: 'ERRO_BUSCA_SESSAO', mensagem: errSessao.message },
        { status: 500 },
      );
    }

    if (!sessao) {
      return NextResponse.json(
        { erro: 'SESSAO_NAO_ENCONTRADA', mensagem: 'Sessão não existe ou não pertence a você' },
        { status: 404 },
      );
    }

    // Defense-in-depth (RLS já valida, mas explicitamos)
    if (sessao.usuario_id !== auth.userId) {
      return NextResponse.json(
        { erro: 'FORBIDDEN', mensagem: 'Sessão pertence a outro usuário' },
        { status: 403 },
      );
    }

    // 2. Idempotência rápida: já convertida? Retorna o processo_id existente
    if (sessao.status === 'convertido_em_processo' && sessao.processo_id) {
      return NextResponse.json(
        {
          processo_id: sessao.processo_id,
          ja_convertido: true,
          mensagem: 'Sessão já havia sido convertida anteriormente',
        },
        { status: 200 },
      );
    }

    // 3. Busca os arquivos ainda vinculados à sessão
    const { data: arquivos, error: errArquivos } = await supabase
      .from('processo_arquivos')
      .select('id, tipo_xsd, destino_xml, destino_acervo, tamanho_bytes')
      .eq('sessao_id', sessaoId)
      .returns<ArquivoRow[]>();

    if (errArquivos) {
      console.error('[converter] erro ao buscar arquivos:', errArquivos);
      return NextResponse.json(
        { erro: 'ERRO_BUSCA_ARQUIVOS', mensagem: errArquivos.message },
        { status: 500 },
      );
    }

    // 4. Monta o input do gate
    //
    // ATENÇÃO: dados_confirmados vem do FormularioRevisao que usa chaves
    // diferentes do dados_extraidos original:
    //   - FormularioRevisao: { diplomado: { nome_completo, cpf, rg_numero, ... } }
    //   - dados_extraidos:   { aluno: { nome, cpf, rg, ... } }
    //
    // Precisamos normalizar para o InputGateCriacao.
    const dados =
      (sessao.dados_confirmados as Record<string, unknown> | null) ??
      (sessao.dados_extraidos as Record<string, unknown> | null) ??
      {};

    // FormularioRevisao salva em "diplomado", dados_extraidos usa "aluno"
    const alunoRaw = (dados.diplomado ?? dados.aluno ?? {}) as Record<string, unknown>;
    const disciplinasRaw = Array.isArray(dados.disciplinas)
      ? (dados.disciplinas as Array<Record<string, unknown>>)
      : [];

    const inputGate: InputGateCriacao = {
      aluno: {
        // FormularioRevisao usa "nome_completo", dados_extraidos usa "nome"
        nome: (alunoRaw.nome_completo as string | null | undefined)
          ?? (alunoRaw.nome as string | null | undefined) ?? null,
        cpf: (alunoRaw.cpf as string | null | undefined) ?? null,
        // FormularioRevisao usa "rg_numero" (ou "rg"), dados_extraidos usa "rg"
        rg: (alunoRaw.rg_numero as string | null | undefined)
          ?? (alunoRaw.rg as string | null | undefined) ?? null,
        data_nascimento:
          (alunoRaw.data_nascimento as string | null | undefined) ?? null,
        // FormularioRevisao: "naturalidade" pode ser string única ou cidade+uf separados
        naturalidade:
          (alunoRaw.naturalidade as string | null | undefined)
          ?? (alunoRaw.naturalidade_municipio as string | null | undefined) ?? null,
        nacionalidade:
          (alunoRaw.nacionalidade as string | null | undefined) ?? null,
      },
      disciplinas: disciplinasRaw.map((d) => ({
        codigo: (d.codigo as string | null | undefined) ?? null,
        nome: (d.nome as string | null | undefined) ?? null,
        carga_horaria: (d.carga_horaria as number | null | undefined) ?? null,
        nota: (d.nota as number | null | undefined) ?? null,
      })),
      arquivosAnexados: (arquivos ?? []).map((a) => ({
        tipo_xsd: (a.tipo_xsd as TipoXsdComprobatorio | null) ?? null,
        destino_xml: a.destino_xml,
        destino_acervo: a.destino_acervo,
        tamanho_bytes: a.tamanho_bytes ?? 0,
      })),
    };

    // 5. Roda o gate
    const resultado = validarGateCriacaoProcesso(inputGate);

    // 6. Se houver bloqueantes E não houve override, devolve 422
    if (!resultado.pode_prosseguir && !overrideJustificativa) {
      return NextResponse.json(
        {
          erro: 'GATE_BLOQUEADO',
          mensagem:
            'Gate de criação detectou violações bloqueantes. Preencha a justificativa de override para prosseguir.',
          pode_prosseguir: false,
          violacoes: resultado.violacoes,
          bloqueantes: resultado.bloqueantes,
          avisos: resultado.avisos,
          fic_comprobatorios: resultado.fic_comprobatorios,
        },
        { status: 422 },
      );
    }

    // 7. Chama a RPC transacional
    const { data: rpcResult, error: errRpc } = await supabase.rpc(
      'converter_sessao_em_processo',
      {
        p_sessao_id: sessaoId,
        p_override_justificativa: overrideJustificativa,
      },
    );

    if (errRpc) {
      console.error('[converter] erro na RPC:', errRpc);
      return NextResponse.json(
        {
          erro: 'ERRO_CONVERSAO',
          mensagem: errRpc.message,
          hint: errRpc.hint ?? null,
          code: errRpc.code ?? null,
        },
        { status: 500 },
      );
    }

    const result = (rpcResult ?? {}) as {
      processo_id?: string;
      ja_convertido?: boolean;
      arquivos_migrados?: number;
    };

    if (!result.processo_id) {
      console.error('[converter] RPC retornou sem processo_id:', rpcResult);
      return NextResponse.json(
        {
          erro: 'ERRO_CONVERSAO',
          mensagem: 'RPC não retornou processo_id',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        processo_id: result.processo_id,
        ja_convertido: result.ja_convertido ?? false,
        arquivos_migrados: result.arquivos_migrados ?? 0,
        avisos: resultado.avisos,
        override_aplicado: Boolean(overrideJustificativa),
      },
      { status: 200 },
    );
  },
  { skipCSRF: true },
);
