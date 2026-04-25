import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Sessão 2026-04-23 — fix produção travando 300s (ver commit).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Sessão 2026-04-25 — handler POST removido junto com a página de criação manual
// `/diploma/processos/[id]`. O produto tem 1 fluxo único: extração IA + Consolidar
// (POST /api/diplomas/[id]/snapshot/gerar). Esta rota mantém apenas o GET de
// listagem dos processos existentes.

interface ProcessoResponse {
  id: string;
  diploma_id?: string;
  sessao_id?: string; // sessão 074: para navegar direto à revisão em status em_extracao
  nome: string | null;
  curso: {
    nome: string;
    grau: string;
  };
  turno: string;
  periodo_letivo: string;
  data_colacao: string;
  status: string;
  total_diplomas: number;
  created_at: string;
}

// GET - Listar processos com dados agregados
export const GET = protegerRota(
  async (request) => {
    const t0 = Date.now();
    console.log("[api/processos] enter handler");
    const supabase = await createClient();
    console.log("[api/processos] supabase client ready", {
      dt: Date.now() - t0,
    });
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    let query = supabase
      .from("processos_emissao")
      .select(
        `
      id,
      nome,
      sessao_id,
      turno,
      periodo_letivo,
      data_colacao,
      status,
      total_diplomas,
      created_at,
      cursos(nome, grau),
      diplomas!diplomas_processo_id_fkey(id)
    `,
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`nome.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    // Formato da resposta
    const formatted: ProcessoResponse[] = (data || []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      sessao_id: p.sessao_id ?? undefined, // sessão 074: navegar direto à revisão em status em_extracao
      curso: p.cursos || { nome: "", grau: "" },
      turno: p.turno,
      periodo_letivo: p.periodo_letivo,
      data_colacao: p.data_colacao,
      status: p.status,
      total_diplomas: p.total_diplomas,
      created_at: p.created_at,
      // diploma_id do primeiro diploma vinculado (para redirecionar direto à pipeline)
      diploma_id: (p.diplomas as any[])?.[0]?.id ?? undefined,
    }));

    return NextResponse.json(formatted);
  },
  { skipCSRF: true },
);
