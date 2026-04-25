import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { buscarDiplomaCompleto } from "@/lib/diplomas/buscar-completo";
import {
  montarSnapshotExtracao,
  type SnapshotBuilderInput,
} from "@/lib/diploma/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface DiplomaSnapshotCheckRow {
  id: string;
  is_legado: boolean | null;
  dados_snapshot_extracao: unknown | null;
  emissora_nome: string | null;
  emissora_cnpj: string | null;
  emissora_codigo_mec: string | null;
  registradora_nome: string | null;
  registradora_cnpj: string | null;
  registradora_codigo_mec: string | null;
  municipio_colacao: string | null;
  uf_colacao: string | null;
  numero_registro: string | null;
  pagina_registro: number | null;
  processo_registro: string | null;
  data_registro: string | null;
  livro_registro_id: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/snapshot/gerar
//
// Consolida (gera + trava) o snapshot imutável a partir das tabelas
// normalizadas. Ação MANUAL e EXPLÍCITA do usuário (botão "Consolidar
// Dados"). Após consolidar:
//   • Snapshot imutável permanentemente.
//   • Habilita geração de XMLs (HistoricoEscolarDigital + DocAcademica).
//   • Para reverter, requer destravamento via POST /snapshot/destravar
//     com justificativa registrada em `diploma_unlock_windows`.
//
// Validações:
//   • Diploma existe
//   • Não é legado (legados nunca passam por consolidação)
//   • Ainda não tem snapshot (idempotência: se já tem, retorna 422)
// ═══════════════════════════════════════════════════════════════════════════
export const POST = protegerRota(async (request, { userId }) => {
  const supabase = await createClient();

  const pathname = new URL(request.url).pathname;
  const segments = pathname.split("/");
  const idx = segments.indexOf("diplomas");
  const diplomaId = idx >= 0 ? segments[idx + 1] : null;

  if (!diplomaId || !/^[0-9a-f-]{36}$/i.test(diplomaId)) {
    return NextResponse.json(
      { error: "ID do diploma inválido" },
      { status: 400 },
    );
  }

  // 1. Busca diploma com colunas necessárias pra validação prévia
  const { data: diplomaCheckRaw, error: errCheck } = await supabase
    .from("diplomas")
    .select(
      "id, is_legado, dados_snapshot_extracao, " +
        "emissora_nome, emissora_cnpj, emissora_codigo_mec, " +
        "registradora_nome, registradora_cnpj, registradora_codigo_mec, " +
        "municipio_colacao, uf_colacao, " +
        "numero_registro, pagina_registro, processo_registro, " +
        "data_registro, livro_registro_id",
    )
    .eq("id", diplomaId)
    .single();

  if (errCheck || !diplomaCheckRaw) {
    return NextResponse.json(
      {
        error: sanitizarErro(
          errCheck?.message ?? "Diploma não encontrado",
          404,
        ),
      },
      { status: 404 },
    );
  }
  const diplomaCheck = diplomaCheckRaw as unknown as DiplomaSnapshotCheckRow;

  if (diplomaCheck.is_legado) {
    return NextResponse.json(
      {
        error:
          "Diplomas legados não passam por consolidação — seus dados já estão preservados nos arquivos originais.",
      },
      { status: 422 },
    );
  }

  if (diplomaCheck.dados_snapshot_extracao) {
    return NextResponse.json(
      {
        error:
          "Snapshot já consolidado. Para gerar de novo, use 'Destravar para edição' primeiro.",
      },
      { status: 422 },
    );
  }

  // 2. Busca dados completos (JOIN das 9 tabelas relacionadas)
  const completo = await buscarDiplomaCompleto(diplomaId);
  if (!completo) {
    return NextResponse.json(
      { error: "Falha ao carregar dados completos do diploma" },
      { status: 500 },
    );
  }

  // 3. Mapeia DiplomaCompleto → SnapshotBuilderInput
  const d = completo.diplomado;
  const c = completo.curso;
  const dip = completo.diploma;

  // Filiações via diplomado_id (não estão no DiplomaCompleto, busca à parte)
  const { data: filiacoes } = await supabase
    .from("filiacoes")
    .select("nome, sexo, ordem")
    .eq("diplomado_id", dip.diplomado_id)
    .order("ordem", { ascending: true });

  // Assinantes (do fluxo de assinaturas) já vêm em completo.assinantes
  const assinantesParaSnapshot = (completo.assinantes ?? []).map((a) => ({
    nome: a.nome,
    cargo: a.cargo ?? a.outro_cargo ?? "",
    cpf: a.cpf,
    ordem: a.ordem_assinatura ?? null,
  }));

  // ENADE
  const enadeParaSnapshot = completo.enade
    ? { situacao: completo.enade.situacao }
    : null;

  // IES Emissora/Registradora — vêm do próprio diploma (campos extraídos do XML)
  const iesEmissora =
    diplomaCheck.emissora_nome || diplomaCheck.emissora_cnpj
      ? {
          nome: diplomaCheck.emissora_nome,
          cnpj: diplomaCheck.emissora_cnpj,
          codigo_mec: diplomaCheck.emissora_codigo_mec,
          municipio: diplomaCheck.municipio_colacao,
          uf: diplomaCheck.uf_colacao,
        }
      : null;

  const iesRegistradora =
    diplomaCheck.registradora_nome || diplomaCheck.registradora_cnpj
      ? {
          nome: diplomaCheck.registradora_nome,
          cnpj: diplomaCheck.registradora_cnpj,
          codigo_mec: diplomaCheck.registradora_codigo_mec,
        }
      : null;

  const builderInput: SnapshotBuilderInput = {
    processo_id: dip.processo_id ?? null,
    extracao_sessao_id: null, // pode ser preenchido se tivermos a sessão
    diplomado: {
      ...d,
      // Inclui filiações pra possível uso futuro do builder
      filiacoes: filiacoes ?? [],
    },
    curso: c,
    dados_academicos: {
      turno: dip.turno,
      periodo_letivo: dip.periodo_letivo,
      data_ingresso: dip.data_ingresso,
      data_conclusao: dip.data_conclusao,
      data_colacao_grau: dip.data_colacao_grau,
      data_expedicao: dip.data_expedicao,
      forma_acesso: dip.forma_acesso,
      situacao_aluno: dip.situacao_aluno,
      carga_horaria_integralizada: dip.carga_horaria_integralizada,
      data_vestibular: dip.data_vestibular,
    },
    disciplinas: completo.disciplinas,
    atividades_complementares: completo.atividades_complementares,
    estagios: completo.estagios,
    enade: enadeParaSnapshot,
    assinantes: assinantesParaSnapshot,
    ies_emissora: iesEmissora,
    ies_registradora: iesRegistradora,
  };

  // 4. Monta snapshot canônico
  const snapshot = montarSnapshotExtracao(builderInput);

  // 5. Persiste como travado (consolidado = imutável direto)
  const agora = new Date().toISOString();

  const { error: errUpdate } = await supabase
    .from("diplomas")
    .update({
      dados_snapshot_extracao: snapshot,
      dados_snapshot_versao: 1,
      dados_snapshot_gerado_em: agora,
      dados_snapshot_travado: true,
      dados_snapshot_travado_em: agora,
      dados_snapshot_travado_por: userId,
    })
    .eq("id", diplomaId)
    .is("dados_snapshot_extracao", null); // optimistic — evita race se outra request consolidou simultaneamente

  if (errUpdate) {
    console.error(
      "[API/snapshot/gerar] Erro ao persistir snapshot:",
      errUpdate.message,
    );
    return NextResponse.json(
      { error: sanitizarErro(errUpdate.message, 500) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    consolidado: true,
    versao: 1,
    gerado_em: agora,
    travado_em: agora,
    snapshot_id: snapshot.snapshot_id,
  });
});
