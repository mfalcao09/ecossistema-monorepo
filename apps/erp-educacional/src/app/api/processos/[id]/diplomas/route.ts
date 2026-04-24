import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  verificarAuth,
  erroNaoEncontrado,
  erroInterno,
} from "@/lib/security/api-guard";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface DiplomaListItem {
  id: string;
  diplomado_id: string;
  nome_diplomado: string;
  status: string;
  data_conclusao: string;
  confianca_extracao?: number;
}

// GET - Listar diplomas do processo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();

  // Verifica se processo existe
  const { data: processo, error: processError } = await supabase
    .from("processos_emissao")
    .select("id")
    .eq("id", id)
    .single();

  if (processError || !processo) {
    return erroNaoEncontrado();
  }

  // Busca diplomas com dados relacionados
  const { data: diplomas, error: diplomasError } = await supabase
    .from("diplomas")
    .select(
      `
      id,
      diplomado_id,
      status,
      data_conclusao,
      diplomados(nome),
      extracao_sessoes(confianca_geral)
    `,
    )
    .eq("processo_id", id)
    .order("created_at", { ascending: false });

  if (diplomasError) {
    console.error(
      "[API] Erro ao buscar diplomas do processo:",
      diplomasError.message,
    );
    return erroInterno();
  }

  const formatted: DiplomaListItem[] = (diplomas || []).map((d: any) => ({
    id: d.id,
    diplomado_id: d.diplomado_id,
    nome_diplomado: d.diplomados?.nome || "",
    status: d.status,
    data_conclusao: d.data_conclusao,
    confianca_extracao: d.extracao_sessoes?.[0]?.confianca_geral || 0,
  }));

  return NextResponse.json(formatted);
}

// POST - Adicionar diplomados ao processo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const { diplomado_id, diplomados_ids } = body;

  // Verifica se processo existe
  const { data: processo, error: processError } = await supabase
    .from("processos_emissao")
    .select("id, total_diplomas")
    .eq("id", id)
    .single();

  if (processError || !processo) {
    return erroNaoEncontrado();
  }

  // Prepara lista de IDs para inserir
  const idsParaInserir: string[] = [];

  if (diplomado_id) {
    idsParaInserir.push(diplomado_id);
  } else if (diplomados_ids && Array.isArray(diplomados_ids)) {
    idsParaInserir.push(...diplomados_ids);
  }

  if (idsParaInserir.length === 0) {
    return NextResponse.json(
      { error: "diplomado_id ou diplomados_ids é obrigatório" },
      { status: 400 },
    );
  }

  // Cria registros de diploma
  const diplomasParaInserir = idsParaInserir.map((did) => ({
    processo_id: id,
    diplomado_id: did,
    status: "em_extracao",
  }));

  const { data: novosDiplomas, error: insertError } = await supabase
    .from("diplomas")
    .insert(diplomasParaInserir).select(`
      id,
      diplomado_id,
      status,
      data_conclusao,
      diplomados(nome),
      extracao_sessoes(confianca_geral)
    `);

  if (insertError) {
    console.error(
      "[API] Erro ao inserir diplomas no processo:",
      insertError.message,
    );
    return erroInterno();
  }

  // Atualiza total_diplomas no processo
  const novoTotal = (processo.total_diplomas || 0) + idsParaInserir.length;
  await supabase
    .from("processos_emissao")
    .update({ total_diplomas: novoTotal, updated_at: new Date().toISOString() })
    .eq("id", id);

  const formatted: DiplomaListItem[] = (novosDiplomas || []).map((d: any) => ({
    id: d.id,
    diplomado_id: d.diplomado_id,
    nome_diplomado: d.diplomados?.nome || "",
    status: d.status,
    data_conclusao: d.data_conclusao,
    confianca_extracao: d.extracao_sessoes?.[0]?.confianca_geral || 0,
  }));

  return NextResponse.json(formatted, { status: 201 });
}

// DELETE - Remover diplomado do processo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const { diploma_id } = body;

  if (!diploma_id) {
    return NextResponse.json(
      { error: "diploma_id é obrigatório" },
      { status: 400 },
    );
  }

  // Verifica se diploma pertence ao processo
  const { data: diploma, error: fetchError } = await supabase
    .from("diplomas")
    .select("id, processo_id")
    .eq("id", diploma_id)
    .single();

  if (fetchError || !diploma) {
    return erroNaoEncontrado();
  }

  if (diploma.processo_id !== id) {
    return NextResponse.json(
      { error: "Recurso não encontrado" },
      { status: 404 },
    );
  }

  // Remove diploma
  const { error: deleteError } = await supabase
    .from("diplomas")
    .delete()
    .eq("id", diploma_id);

  if (deleteError) {
    console.error(
      "[API] Erro ao deletar diploma do processo:",
      deleteError.message,
    );
    return erroInterno();
  }

  // Atualiza total_diplomas no processo
  const { data: processo } = await supabase
    .from("processos_emissao")
    .select("total_diplomas")
    .eq("id", id)
    .single();

  if (processo) {
    const novoTotal = Math.max(0, (processo.total_diplomas || 1) - 1);
    await supabase
      .from("processos_emissao")
      .update({
        total_diplomas: novoTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return NextResponse.json({ success: true });
}
