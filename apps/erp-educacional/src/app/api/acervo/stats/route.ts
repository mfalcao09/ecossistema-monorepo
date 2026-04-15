import { protegerRota } from '@/lib/security/api-guard'
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// GET /api/acervo/stats
// Estatísticas consolidadas do acervo acadêmico digital para o Dashboard
export const GET = protegerRota(async (request, { userId, tenantId }) => {
  try {
    const supabase = await createClient();

    // Totais por status
    const { data: porStatus } = await supabase
      .from("documentos_digitais")
      .select("status, origem")
      .order("status");

    // Totais por tipo
    const { data: porTipo } = await supabase
      .from("documentos_digitais")
      .select("tipo");

    // Lotes em aberto
    const { count: lotesAbertos } = await supabase
      .from("acervo_lotes")
      .select("*", { count: "exact", head: true })
      .in("status", ["rascunho", "em_andamento", "aguardando_assinatura", "assinando"]);

    const docs = porStatus ?? [];

    const stats = {
      total: docs.length,
      publicados: docs.filter((d) => d.status === "publicado").length,
      aguardando_assinatura: docs.filter((d) =>
        ["aguardando_assinatura", "assinando"].includes(d.status)
      ).length,
      com_erro: docs.filter((d) => d.status === "erro").length,
      nato_digital: docs.filter((d) => d.origem === "nato_digital").length,
      digitalizado: docs.filter((d) => d.origem === "digitalizado").length,
      por_tipo: (porTipo ?? []).reduce<Record<string, number>>((acc, d) => {
        acc[d.tipo] = (acc[d.tipo] ?? 0) + 1;
        return acc;
      }, {}),
      lotes_abertos: lotesAbertos ?? 0,
    };

    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ erro: sanitizarErro(msg, 500) }, { status: 500 });
  }
}, { skipCSRF: true })
