import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import {
  aplicarPatches,
  diffSnapshots,
  podeEditarSnapshot,
  type DadosSnapshot,
} from "@/lib/diploma/snapshot";
import {
  resolverNomesUsuarios,
  nomeOuSistema,
} from "@/lib/diploma/resolver-usuarios";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Tipo local do row retornado pelo Supabase (colunas explícitas do select).
// Usado via cast pois o inferidor do Supabase JS não infere corretamente quando
// o .select() recebe string concatenada.
interface DiplomaSnapshotRow {
  id: string;
  status: string | null;
  dados_snapshot_extracao: unknown | null;
  dados_snapshot_versao: number | null;
  dados_snapshot_gerado_em: string | null;
  dados_snapshot_travado: boolean | null;
  dados_snapshot_travado_em: string | null;
  dados_snapshot_travado_por: string | null;
}

interface DiplomaSnapshotEditCheckRow {
  id: string;
  dados_snapshot_extracao: unknown | null;
  dados_snapshot_versao: number | null;
  dados_snapshot_travado: boolean | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/diplomas/[id]/snapshot
// Retorna o snapshot atual + metadados (versão, travado, última edição)
// ═══════════════════════════════════════════════════════════════════════════
export const GET = protegerRota(async (request) => {
  const supabase = await createClient();
  const diplomaId = extractId(request.url);
  if (!diplomaId) {
    return NextResponse.json(
      { error: "ID do diploma não fornecido" },
      { status: 400 },
    );
  }

  const { data: diplomaRaw, error } = await supabase
    .from("diplomas")
    .select(
      "id, status, dados_snapshot_extracao, dados_snapshot_versao, " +
        "dados_snapshot_gerado_em, dados_snapshot_travado, " +
        "dados_snapshot_travado_em, dados_snapshot_travado_por",
    )
    .eq("id", diplomaId)
    .single();

  if (error || !diplomaRaw) {
    return NextResponse.json(
      { error: sanitizarErro(error?.message ?? "Diploma não encontrado", 404) },
      { status: 404 },
    );
  }
  const diploma = diplomaRaw as unknown as DiplomaSnapshotRow;

  // Busca últimas 10 edições (mais recentes primeiro)
  const { data: edicoes } = await supabase
    .from("diploma_snapshot_edicoes")
    .select(
      "id, usuario_id, justificativa, campos_alterados, versao_antes, versao_depois, created_at",
    )
    .eq("diploma_id", diplomaId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Histórico de destravamentos (Sessão 2026-04-26) — registros em
  // diploma_unlock_windows são gerados pelo POST /snapshot/destravar.
  // Cada destravamento aponta pra um validacao_overrides com a justificativa.
  const { data: unlockRows } = await supabase
    .from("diploma_unlock_windows")
    .select(
      "id, override_id, usuario_id, justificativa, expires_at, used_at, created_at",
    )
    .eq("diploma_id", diplomaId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Histórico de consolidações (Sessão 2026-04-26) — tabela append-only
  // que preserva todas as versões do snapshot ao longo do tempo. Antes,
  // apenas a versão CORRENTE existia em `diplomas.dados_snapshot_*`.
  const { data: consolidacoesRows } = await supabase
    .from("diploma_snapshot_consolidacoes")
    .select(
      "id, versao, snapshot_id, consolidado_em, consolidado_por, created_at:consolidado_em",
    )
    .eq("diploma_id", diplomaId)
    .order("versao", { ascending: false });

  const consolidacoes = (consolidacoesRows ?? []) as Array<{
    id: string;
    versao: number;
    snapshot_id: string | null;
    consolidado_em: string;
    consolidado_por: string | null;
  }>;

  const totalConsolidacoes = consolidacoes.length;
  const ultimaVersao = consolidacoes[0]?.versao ?? 0;
  const proximaVersao = ultimaVersao + 1;
  const totalDestravamentos = (unlockRows ?? []).length;

  // Sessão 2026-04-26: resolução de nomes pra cada usuário envolvido
  // (consolidações, destravamentos, edições, travamento atual).
  type UnlockRow = { usuario_id: string | null };
  type EdicaoRow = { usuario_id: string | null };
  const idsUsuarios: Array<string | null> = [
    diploma.dados_snapshot_travado_por,
    ...consolidacoes.map((c) => c.consolidado_por),
    ...((unlockRows ?? []) as UnlockRow[]).map((u) => u.usuario_id),
    ...((edicoes ?? []) as EdicaoRow[]).map((e) => e.usuario_id),
  ];
  const nomesMap = await resolverNomesUsuarios(idsUsuarios);

  const consolidacoesComNome = consolidacoes.map((c) => ({
    ...c,
    consolidado_por_nome: nomeOuSistema(nomesMap, c.consolidado_por),
  }));
  const destravamentosComNome = (
    (unlockRows ?? []) as Array<
      UnlockRow & {
        [k: string]: unknown;
      }
    >
  ).map((u) => ({
    ...u,
    usuario_nome: nomeOuSistema(nomesMap, u.usuario_id),
  }));
  const edicoesComNome = (
    (edicoes ?? []) as Array<
      EdicaoRow & {
        [k: string]: unknown;
      }
    >
  ).map((e) => ({
    ...e,
    usuario_nome: nomeOuSistema(nomesMap, e.usuario_id),
  }));

  return NextResponse.json({
    diploma_id: diploma.id,
    status_diploma: diploma.status,
    snapshot: diploma.dados_snapshot_extracao as DadosSnapshot | null,
    versao: diploma.dados_snapshot_versao,
    gerado_em: diploma.dados_snapshot_gerado_em,
    travado: diploma.dados_snapshot_travado,
    travado_em: diploma.dados_snapshot_travado_em,
    travado_por: diploma.dados_snapshot_travado_por,
    travado_por_nome: diploma.dados_snapshot_travado_por
      ? nomeOuSistema(nomesMap, diploma.dados_snapshot_travado_por)
      : null,
    edicoes: edicoesComNome,
    destravamentos: destravamentosComNome,
    consolidacoes: consolidacoesComNome,
    stats: {
      total_consolidacoes: totalConsolidacoes,
      total_destravamentos: totalDestravamentos,
      ultima_versao: ultimaVersao,
      proxima_versao: proximaVersao,
    },
    pode_editar: podeEditarSnapshot(diploma),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/diplomas/[id]/snapshot
// Edita o snapshot com justificativa (≥20 chars) e registra auditoria.
// Só permitido enquanto em rascunho (não travado).
//
// Body: {
//   patches: { "diplomado.nome": "Novo Nome", "disciplinas[2].nota": "9.0" },
//   justificativa: "Correção de digitação confirmada com RG original"
// }
// ═══════════════════════════════════════════════════════════════════════════
export const PATCH = protegerRota(async (request, { userId }) => {
  const supabase = await createClient();
  const diplomaId = extractId(request.url);
  if (!diplomaId) {
    return NextResponse.json(
      { error: "ID do diploma não fornecido" },
      { status: 400 },
    );
  }

  let body: { patches?: Record<string, unknown>; justificativa?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const patches = body.patches ?? {};
  const justificativa = (body.justificativa ?? "").trim();

  if (justificativa.length < 20) {
    return NextResponse.json(
      { error: "Justificativa obrigatória (mínimo 20 caracteres)" },
      { status: 422 },
    );
  }
  if (Object.keys(patches).length === 0) {
    return NextResponse.json(
      { error: "Nenhum patch informado" },
      { status: 422 },
    );
  }

  // Busca diploma atual
  const { data: diplomaRaw, error: errDiploma } = await supabase
    .from("diplomas")
    .select(
      "id, dados_snapshot_extracao, dados_snapshot_versao, dados_snapshot_travado",
    )
    .eq("id", diplomaId)
    .single();

  if (errDiploma || !diplomaRaw) {
    return NextResponse.json(
      {
        error: sanitizarErro(
          errDiploma?.message ?? "Diploma não encontrado",
          404,
        ),
      },
      { status: 404 },
    );
  }
  const diploma = diplomaRaw as unknown as DiplomaSnapshotEditCheckRow;

  if (!diploma.dados_snapshot_extracao) {
    return NextResponse.json(
      {
        error:
          "Diploma sem snapshot — não pode ser editado (possivelmente legado)",
      },
      { status: 422 },
    );
  }

  if (diploma.dados_snapshot_travado) {
    return NextResponse.json(
      {
        error:
          "Snapshot travado — edição não permitida. Para corrigir, cancele o diploma e abra um novo processo.",
      },
      { status: 422 },
    );
  }

  const snapshotAntes = diploma.dados_snapshot_extracao as DadosSnapshot;
  const versaoAntes = diploma.dados_snapshot_versao ?? 1;

  // Aplica patches (funcional — não muta base)
  const snapshotDepois = aplicarPatches(snapshotAntes, patches);
  const versaoDepois = versaoAntes + 1;

  // Calcula diff real (só campos que efetivamente mudaram)
  const diff = diffSnapshots(snapshotAntes, snapshotDepois);
  if (Object.keys(diff).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo foi alterado pelos patches" },
      { status: 422 },
    );
  }

  // Persiste o novo snapshot
  const { error: errUpdate } = await supabase
    .from("diplomas")
    .update({
      dados_snapshot_extracao: snapshotDepois,
      dados_snapshot_versao: versaoDepois,
      dados_snapshot_gerado_em: new Date().toISOString(),
    })
    .eq("id", diplomaId)
    .eq("dados_snapshot_versao", versaoAntes); // optimistic lock

  if (errUpdate) {
    return NextResponse.json(
      { error: sanitizarErro(errUpdate.message, 500) },
      { status: 500 },
    );
  }

  // Registra auditoria (append-only)
  const { error: errAudit } = await supabase
    .from("diploma_snapshot_edicoes")
    .insert({
      diploma_id: diplomaId,
      usuario_id: userId,
      justificativa,
      campos_alterados: diff,
      versao_antes: versaoAntes,
      versao_depois: versaoDepois,
    });

  if (errAudit) {
    console.error(
      "[API/snapshot PATCH] ALERTA: snapshot atualizado mas auditoria falhou:",
      errAudit.message,
    );
    // Não reverte — snapshot já foi atualizado. Avisa no response.
    return NextResponse.json({
      snapshot: snapshotDepois,
      versao: versaoDepois,
      diff,
      alerta:
        "Snapshot atualizado mas auditoria falhou — contate administrador",
    });
  }

  return NextResponse.json({
    snapshot: snapshotDepois,
    versao: versaoDepois,
    diff,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function extractId(url: string): string | null {
  const pathname = new URL(url).pathname;
  const segments = pathname.split("/");
  const idx = segments.indexOf("diplomas");
  return idx >= 0 ? (segments[idx + 1] ?? null) : null;
}
