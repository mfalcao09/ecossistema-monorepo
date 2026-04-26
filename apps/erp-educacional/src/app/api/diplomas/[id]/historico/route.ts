import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/diplomas/[id]/historico
//
// Timeline unificada de eventos do diploma (Sessão 2026-04-26).
// Reúne em ordem cronológica:
//   • Criação do diploma e do diplomado
//   • Sessão de extração IA (criação, conclusão)
//   • Snapshot consolidado (gerado_em + travado_por)
//   • Destravamentos do snapshot (diploma_unlock_windows + override)
//   • Edições do snapshot (diploma_snapshot_edicoes)
//   • Mudanças de status (diploma_status_log)
//   • XMLs gerados (xml_gerados.created_at + assinado_em)
//   • Documentos digitais (documentos_digitais.publicado_em)
//
// Retorna `eventos: Array<{ tipo, em, titulo, descricao?, usuario_id?, meta? }>`
// já ordenado decrescentemente (mais recente primeiro).
// ═══════════════════════════════════════════════════════════════════════════

type EventoTipo =
  | "criado"
  | "atualizado"
  | "extracao_iniciada"
  | "extracao_concluida"
  | "auditoria_executada"
  | "snapshot_consolidado"
  | "snapshot_destravado"
  | "snapshot_editado"
  | "status_alterado"
  | "xml_gerado"
  | "xml_assinado"
  | "documento_publicado";

interface EventoTimeline {
  tipo: EventoTipo;
  em: string; // ISO-8601
  titulo: string;
  descricao?: string | null;
  usuario_id?: string | null;
  meta?: Record<string, unknown> | null;
}

export const GET = protegerRota(async (request) => {
  const supabase = await createClient();
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const idx = segments.indexOf("diplomas");
  const diplomaId = idx >= 0 ? segments[idx + 1] : null;

  if (!diplomaId || !/^[0-9a-f-]{36}$/i.test(diplomaId)) {
    return NextResponse.json(
      { error: "ID do diploma inválido" },
      { status: 400 },
    );
  }

  // Diploma + relacionamentos básicos
  const { data: diplomaRaw, error: errDiploma } = await supabase
    .from("diplomas")
    .select(
      "id, status, processo_id, created_at, updated_at, " +
        "dados_snapshot_gerado_em, dados_snapshot_versao, dados_snapshot_travado_em, dados_snapshot_travado_por, " +
        "data_publicacao, data_expedicao",
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
  const diploma = diplomaRaw as unknown as {
    id: string;
    status: string | null;
    processo_id: string | null;
    created_at: string;
    updated_at: string | null;
    dados_snapshot_gerado_em: string | null;
    dados_snapshot_versao: number | null;
    dados_snapshot_travado_em: string | null;
    dados_snapshot_travado_por: string | null;
    data_publicacao: string | null;
    data_expedicao: string | null;
  };

  const eventos: EventoTimeline[] = [];

  // 1. Criação do diploma
  eventos.push({
    tipo: "criado",
    em: diploma.created_at,
    titulo: "Diploma criado",
    descricao: "Registro inicial — dados das tabelas normalizadas",
  });

  // 2. Sessão de extração IA (se houver)
  if (diploma.processo_id) {
    const { data: sessao } = await supabase
      .from("extracao_sessoes")
      .select("id, status, iniciado_em, finalizado_em, processing_ms")
      .eq("processo_id", diploma.processo_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessao) {
      const s = sessao as {
        id: string;
        status: string | null;
        iniciado_em: string | null;
        finalizado_em: string | null;
        processing_ms: number | null;
      };
      if (s.iniciado_em) {
        eventos.push({
          tipo: "extracao_iniciada",
          em: s.iniciado_em,
          titulo: "Extração IA iniciada",
          meta: { sessao_id: s.id },
        });
      }
      if (s.finalizado_em) {
        eventos.push({
          tipo: "extracao_concluida",
          em: s.finalizado_em,
          titulo: "Extração IA concluída",
          descricao:
            s.processing_ms != null
              ? `Processou em ${(s.processing_ms / 1000).toFixed(1)}s`
              : null,
          meta: { sessao_id: s.id, status: s.status },
        });
      }
    }
  }

  // 3. Consolidações de snapshot (Sessão 2026-04-26: append-only,
  //    histórico completo de todas as versões — antes só a corrente).
  const { data: consolidacoes } = await supabase
    .from("diploma_snapshot_consolidacoes")
    .select("id, versao, consolidado_em, consolidado_por, snapshot_id")
    .eq("diploma_id", diplomaId)
    .order("consolidado_em", { ascending: false });

  for (const row of (consolidacoes ?? []) as Array<{
    id: string;
    versao: number;
    consolidado_em: string;
    consolidado_por: string | null;
    snapshot_id: string | null;
  }>) {
    eventos.push({
      tipo: "snapshot_consolidado",
      em: row.consolidado_em,
      titulo: `Snapshot consolidado (versão ${row.versao})`,
      descricao: "Dados travados como fonte oficial dos artefatos",
      usuario_id: row.consolidado_por,
      meta: { consolidacao_id: row.id, snapshot_id: row.snapshot_id },
    });
  }

  // 3.5. Auditorias executadas (Sessão 2026-04-26 — append-only)
  // Inclui diff vs anterior pra mostrar evolução na timeline.
  const { data: auditorias } = await supabase
    .from("diploma_auditorias")
    .select("id, auditado_em, auditado_por, pode_gerar_xml, totais, issues")
    .eq("diploma_id", diplomaId)
    .order("auditado_em", { ascending: false });

  type IssueLog = {
    grupo_id: string;
    campo: string;
    severidade: string;
  };
  type AuditRow = {
    id: string;
    auditado_em: string;
    auditado_por: string | null;
    pode_gerar_xml: boolean;
    totais: { criticos: number; avisos: number; infos: number; total: number };
    issues: IssueLog[];
  };
  const auditRows = (auditorias ?? []) as AuditRow[];

  const chave = (i: IssueLog) => `${i.grupo_id}|${i.campo}|${i.severidade}`;

  for (let i = 0; i < auditRows.length; i++) {
    const row = auditRows[i];
    const anterior = auditRows[i + 1] ?? null; // ordem desc → próximo é anterior cronológico
    const t = row.totais ?? { criticos: 0, avisos: 0, infos: 0, total: 0 };

    const partes: string[] = [];
    if (t.criticos > 0)
      partes.push(`${t.criticos} crítico${t.criticos === 1 ? "" : "s"}`);
    if (t.avisos > 0)
      partes.push(`${t.avisos} aviso${t.avisos === 1 ? "" : "s"}`);
    if (partes.length === 0) partes.push("0 críticos · 0 avisos");

    let diffMeta: Record<string, unknown> | null = null;
    if (anterior) {
      const setAnt = new Set((anterior.issues ?? []).map(chave));
      const setAtu = new Set((row.issues ?? []).map(chave));
      const resolvidas = (anterior.issues ?? []).filter(
        (it) => !setAtu.has(chave(it)),
      );
      const novas = (row.issues ?? []).filter((it) => !setAnt.has(chave(it)));
      const persistentes = (row.issues ?? []).filter((it) =>
        setAnt.has(chave(it)),
      );
      const partesDiff: string[] = [];
      if (resolvidas.length > 0)
        partesDiff.push(`-${resolvidas.length} resolvidas`);
      if (persistentes.length > 0)
        partesDiff.push(`${persistentes.length} persistem`);
      if (novas.length > 0) partesDiff.push(`+${novas.length} novas`);
      diffMeta = {
        anterior_id: anterior.id,
        resolvidas: resolvidas.length,
        persistentes: persistentes.length,
        novas: novas.length,
        sumario: partesDiff.join(" · ") || "sem mudanças",
      };
    }

    eventos.push({
      tipo: "auditoria_executada",
      em: row.auditado_em,
      titulo: row.pode_gerar_xml
        ? "Auditoria executada · pode gerar XML"
        : "Auditoria executada · bloqueada",
      descricao: diffMeta
        ? `${partes.join(" · ")} · ${(diffMeta as { sumario: string }).sumario}`
        : `${partes.join(" · ")} · 1ª auditoria`,
      usuario_id: row.auditado_por,
      meta: { auditoria_id: row.id, totais: t, diff: diffMeta },
    });
  }

  // 4. Destravamentos
  const { data: unlocks } = await supabase
    .from("diploma_unlock_windows")
    .select("id, override_id, usuario_id, justificativa, created_at, used_at")
    .eq("diploma_id", diplomaId)
    .order("created_at", { ascending: false });

  for (const row of (unlocks ?? []) as Array<{
    id: string;
    override_id: string;
    usuario_id: string;
    justificativa: string;
    created_at: string;
    used_at: string | null;
  }>) {
    eventos.push({
      tipo: "snapshot_destravado",
      em: row.created_at,
      titulo: "Snapshot destravado para edição",
      descricao: row.justificativa,
      usuario_id: row.usuario_id,
      meta: {
        unlock_id: row.id,
        override_id: row.override_id,
        used_at: row.used_at,
      },
    });
  }

  // 5. Edições do snapshot
  const { data: edicoes } = await supabase
    .from("diploma_snapshot_edicoes")
    .select(
      "id, usuario_id, justificativa, versao_antes, versao_depois, campos_alterados, created_at",
    )
    .eq("diploma_id", diplomaId)
    .order("created_at", { ascending: false });

  for (const row of (edicoes ?? []) as Array<{
    id: string;
    usuario_id: string;
    justificativa: string;
    versao_antes: number;
    versao_depois: number;
    campos_alterados: Record<string, unknown> | null;
    created_at: string;
  }>) {
    const camposCount = row.campos_alterados
      ? Object.keys(row.campos_alterados).length
      : 0;
    eventos.push({
      tipo: "snapshot_editado",
      em: row.created_at,
      titulo: `Snapshot editado (v${row.versao_antes} → v${row.versao_depois})`,
      descricao:
        row.justificativa +
        (camposCount > 0
          ? ` · ${camposCount} campo${camposCount === 1 ? "" : "s"} alterado${camposCount === 1 ? "" : "s"}`
          : ""),
      usuario_id: row.usuario_id,
      meta: { edicao_id: row.id, campos_alterados: row.campos_alterados },
    });
  }

  // 6. Status changes
  const { data: statusLog } = await supabase
    .from("diploma_status_log")
    .select("id, status_anterior, status_novo, motivo, usuario_id, created_at")
    .eq("diploma_id", diplomaId)
    .order("created_at", { ascending: false });

  for (const row of (statusLog ?? []) as Array<{
    id: string;
    status_anterior: string | null;
    status_novo: string;
    motivo: string | null;
    usuario_id: string | null;
    created_at: string;
  }>) {
    eventos.push({
      tipo: "status_alterado",
      em: row.created_at,
      titulo: `Status: ${row.status_anterior ?? "(início)"} → ${row.status_novo}`,
      descricao: row.motivo,
      usuario_id: row.usuario_id,
      meta: { log_id: row.id },
    });
  }

  // 7. XMLs gerados
  const { data: xmls } = await supabase
    .from("xml_gerados")
    .select("id, tipo, status, created_at, assinado_em")
    .eq("diploma_id", diplomaId)
    .order("created_at", { ascending: false });

  for (const row of (xmls ?? []) as Array<{
    id: string;
    tipo: string;
    status: string | null;
    created_at: string;
    assinado_em: string | null;
  }>) {
    eventos.push({
      tipo: "xml_gerado",
      em: row.created_at,
      titulo: `XML gerado: ${row.tipo}`,
      meta: { xml_id: row.id, status: row.status },
    });
    if (row.assinado_em) {
      eventos.push({
        tipo: "xml_assinado",
        em: row.assinado_em,
        titulo: `XML assinado: ${row.tipo}`,
        meta: { xml_id: row.id },
      });
    }
  }

  // 8. Publicação
  if (diploma.data_publicacao) {
    eventos.push({
      tipo: "documento_publicado",
      em: diploma.data_publicacao,
      titulo: "Diploma publicado",
      descricao: "Diploma disponível no portal público",
    });
  }

  // Ordenação descendente
  eventos.sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0));

  return NextResponse.json({
    diploma_id: diplomaId,
    eventos,
    total: eventos.length,
  });
});
