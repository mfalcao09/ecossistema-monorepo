import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { erroInterno } from "@/lib/security/api-guard";

// GET /api/diplomas
// Lista todos os diplomas com join de diplomado, curso e processo
// Query params: search, status, processo_id, curso_id, limit, offset
export const GET = protegerRota(async (request: NextRequest) => {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const search      = searchParams.get("search")      || "";
  const status      = searchParams.get("status")      || "";
  const processoId  = searchParams.get("processo_id") || "";
  const cursoId     = searchParams.get("curso_id")    || "";
  const limit       = parseInt(searchParams.get("limit")  || "1000", 10);
  const offset      = parseInt(searchParams.get("offset") || "0",   10);

  let query = supabase
    .from("diplomas")
    .select(`
      id,
      diplomado_id,
      curso_id,
      processo_id,
      status,
      is_legado,
      data_conclusao,
      created_at,
      diplomados (
        nome,
        cpf
      ),
      cursos (
        nome,
        grau
      ),
      processos_emissao (
        nome
      ),
      xml_gerados (
        tipo,
        status
      ),
      extracao_sessoes (
        confianca_geral
      )
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)     query = query.eq("status", status);
  if (processoId) query = query.eq("processo_id", processoId);
  if (cursoId)    query = query.eq("curso_id", cursoId);

  const { data, error } = await query;

  if (error) {
    console.error('[API] Erro ao listar diplomas:', error.message);
    return erroInterno();
  }

  // Formata para o formato esperado pelo frontend
  const diplomas = (data || []).map((d: any) => {
    const diplomado = d.diplomados;
    const curso     = d.cursos;
    const processo  = d.processos_emissao;
    const xmls      = d.xml_gerados || [];
    const extracao  = d.extracao_sessoes?.[0];

    const item = {
      id:               d.id,
      diplomado_id:     d.diplomado_id,
      diplomado_nome:   diplomado?.nome || "—",
      diplomado_cpf:    diplomado?.cpf  || "",
      curso_id:         d.curso_id,
      curso_nome:       curso?.nome  || "—",
      curso_grau:       curso?.grau  || "",
      processo_id:      d.processo_id,
      processo_nome:    processo?.nome || null,
      is_legado:        d.is_legado ?? false,
      status:           d.status,
      data_conclusao:   d.data_conclusao,
      created_at:       d.created_at,
      xmls:             xmls.map((x: any) => ({ tipo: x.tipo, status: x.status })),
      confianca_ia:     extracao?.confianca_geral ?? null,
    };

    return item;
  });

  // Filtro por search (nome ou CPF) — feito em memória pois Supabase não suporta
  // full-text search em tabelas relacionadas facilmente
  const filtered = search
    ? diplomas.filter((d) =>
        d.diplomado_nome.toLowerCase().includes(search.toLowerCase()) ||
        d.diplomado_cpf.includes(search.replace(/\D/g, "")) ||
        d.curso_nome.toLowerCase().includes(search.toLowerCase())
      )
    : diplomas;

  return NextResponse.json(filtered);
}, { skipCSRF: true })
