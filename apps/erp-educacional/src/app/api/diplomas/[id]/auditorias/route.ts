import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { verificarAuth, erroNaoEncontrado } from "@/lib/security/api-guard";
import {
  resolverNomesUsuarios,
  nomeOuSistema,
} from "@/lib/diploma/resolver-usuarios";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/diplomas/[id]/auditorias
//
// Lista o histórico append-only de auditorias do diploma (Sessão 2026-04-26).
// Cada item inclui um diff comparado à auditoria imediatamente anterior:
//   • resolvidas    — issues que existiam na anterior e sumiram
//   • persistentes  — issues que existiam na anterior e ainda existem
//   • novas         — issues que não existiam na anterior
//
// Retorna: { auditorias: Array<AuditoriaItem>, total: number }
// ═══════════════════════════════════════════════════════════════════════════

interface IssueLog {
  grupo_id: string;
  grupo_nome: string;
  campo: string;
  mensagem: string;
  severidade: "critico" | "aviso" | "info";
  acao: string;
}

interface AuditoriaRow {
  id: string;
  diploma_id: string;
  auditado_em: string;
  auditado_por: string | null;
  diploma_updated_at: string;
  pode_gerar_xml: boolean;
  totais: { criticos: number; avisos: number; infos: number; total: number };
  grupos: unknown[];
  issues: IssueLog[];
}

function chaveIssue(i: IssueLog): string {
  return `${i.grupo_id}|${i.campo}|${i.severidade}`;
}

function calcularDiff(
  atual: IssueLog[],
  anterior: IssueLog[] | null,
): {
  resolvidas: IssueLog[];
  persistentes: IssueLog[];
  novas: IssueLog[];
} {
  if (!anterior) {
    return { resolvidas: [], persistentes: [], novas: atual };
  }
  const setAtual = new Set(atual.map(chaveIssue));
  const setAnterior = new Set(anterior.map(chaveIssue));

  return {
    resolvidas: anterior.filter((i) => !setAtual.has(chaveIssue(i))),
    persistentes: atual.filter((i) => setAnterior.has(chaveIssue(i))),
    novas: atual.filter((i) => !setAnterior.has(chaveIssue(i))),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = getAdmin();

  // Sessão 2026-04-26 (Onda 2): query param `?ultima=1` retorna só a
  // auditoria mais recente — otimização pra hidratação inicial do hook.
  const url = new URL(req.url);
  const ultimaApenas = url.searchParams.get("ultima") === "1";

  let query = admin
    .from("diploma_auditorias")
    .select(
      "id, diploma_id, auditado_em, auditado_por, diploma_updated_at, " +
        "pode_gerar_xml, totais, grupos, issues",
    )
    .eq("diploma_id", id)
    .order("auditado_em", { ascending: false });

  if (ultimaApenas) query = query.limit(1);

  const { data, error } = await query;

  if (error) {
    console.error("[auditorias] erro ao listar:", error);
    return erroNaoEncontrado();
  }

  const rows = (data ?? []) as unknown as AuditoriaRow[];

  // Sessão 2026-04-26: resolve nomes em batch
  const nomesMap = await resolverNomesUsuarios(rows.map((r) => r.auditado_por));

  // Diff: como `rows` está ordenado decrescente, o anterior de rows[i] é rows[i+1]
  const auditorias = rows.map((r, i) => {
    const anterior = rows[i + 1] ?? null;
    const diff = calcularDiff(r.issues ?? [], anterior?.issues ?? null);
    return {
      id: r.id,
      auditado_em: r.auditado_em,
      auditado_por: r.auditado_por,
      auditado_por_nome: nomeOuSistema(nomesMap, r.auditado_por),
      diploma_updated_at: r.diploma_updated_at,
      pode_gerar_xml: r.pode_gerar_xml,
      totais: r.totais,
      grupos: r.grupos,
      // Lista compactada das issues (sem snapshot inteiro pra payload menor)
      issues_count: (r.issues ?? []).length,
      diff_vs_anterior: anterior
        ? {
            anterior_id: anterior.id,
            anterior_em: anterior.auditado_em,
            resolvidas: diff.resolvidas.length,
            persistentes: diff.persistentes.length,
            novas: diff.novas.length,
            // Detalhes pra UI mostrar tooltip/expansão
            resolvidas_itens: diff.resolvidas,
            novas_itens: diff.novas,
          }
        : null,
    };
  });

  return NextResponse.json({ auditorias, total: auditorias.length });
}
