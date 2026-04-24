import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  verificarAuth,
  erroNaoEncontrado,
  erroInterno,
} from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET - Buscar processo específico
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();

  // Busca processo
  const { data: processo, error: processError } = await supabase
    .from("processos_emissao")
    .select(
      `
      id,
      nome,
      turno,
      periodo_letivo,
      data_colacao,
      status,
      total_diplomas,
      obs,
      created_at,
      updated_at,
      cursos(id, nome, grau, titulo_conferido, modalidade)
    `,
    )
    .eq("id", id)
    .single();

  if (processError) {
    console.error("[API] Erro ao buscar processo:", processError.message);
    return erroInterno();
  }

  if (!processo) {
    return erroNaoEncontrado();
  }

  // Busca diplomas do processo com dados do diplomado
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

  // Formata dados de diplomas
  const diplomasFormatted = (diplomas || []).map((d: any) => ({
    id: d.id,
    diplomado_id: d.diplomado_id,
    nome_diplomado: d.diplomados?.nome || "",
    status: d.status,
    data_conclusao: d.data_conclusao,
    confianca_extracao: d.extracao_sessoes?.[0]?.confianca_geral || 0,
  }));

  // Conta por status
  const contagem_status: Record<string, number> = {};
  (diplomas || []).forEach((d: any) => {
    contagem_status[d.status] = (contagem_status[d.status] || 0) + 1;
  });

  // diploma_id do primeiro diploma vinculado (usado para redirecionar para a pipeline)
  const diplomaId =
    diplomasFormatted.length > 0 ? diplomasFormatted[0].id : null;

  const response = {
    id: processo.id,
    nome: processo.nome,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    curso: (processo.cursos as any) || {
      id: "",
      nome: "",
      grau: "",
      titulo_conferido: "",
      modalidade: "",
    },
    turno: processo.turno,
    periodo_letivo: processo.periodo_letivo,
    data_colacao: processo.data_colacao,
    status: processo.status,
    total_diplomas: processo.total_diplomas,
    obs: processo.obs,
    created_at: processo.created_at,
    updated_at: processo.updated_at,
    diploma_id: diplomaId,
    diplomas: diplomasFormatted,
    contagem_status,
  };

  return NextResponse.json(response);
}

// PATCH - Atualizar processo
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const cleaned: Record<string, unknown> = {};
  const allowedFields = [
    "nome",
    "status",
    "obs",
    "turno",
    "periodo_letivo",
    "data_colacao",
  ];

  for (const [key, value] of Object.entries(body)) {
    if (allowedFields.includes(key)) {
      cleaned[key] = value === "" ? null : value;
    }
  }

  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo válido para atualizar" },
      { status: 400 },
    );
  }

  cleaned.updated_at = new Date().toISOString();

  const { data: processo, error } = await supabase
    .from("processos_emissao")
    .update(cleaned)
    .eq("id", id)
    .select(
      `
      id,
      nome,
      turno,
      periodo_letivo,
      data_colacao,
      status,
      total_diplomas,
      obs,
      created_at,
      updated_at,
      cursos(id, nome, grau, titulo_conferido, modalidade)
    `,
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: sanitizarErro(error.message, 500) },
      { status: 500 },
    );
  }

  return NextResponse.json(processo);
}

// DELETE - Remover processo (apenas se rascunho)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();

  // Verifica se processo existe e está em rascunho
  const { data: processo, error: fetchError } = await supabase
    .from("processos_emissao")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error(
      "[API] Erro ao buscar processo para delete:",
      fetchError.message,
    );
    return erroInterno();
  }

  if (!processo) {
    return erroNaoEncontrado();
  }

  if (processo.status !== "rascunho") {
    return NextResponse.json(
      { error: "Apenas processos em rascunho podem ser deletados" },
      { status: 400 },
    );
  }

  const { error: deleteError } = await supabase
    .from("processos_emissao")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[API] Erro ao deletar processo:", deleteError.message);
    return erroInterno();
  }

  return NextResponse.json({ success: true });
}
