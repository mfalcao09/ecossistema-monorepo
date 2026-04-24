import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// POST - Criar novo rascunho vazio
// PUT  - Atualizar rascunho existente
export const POST = protegerRota(
  async (request, { userId }) => {
    const supabase = await createClient();
    const body = await request.json();

    const { nome, curso_id, dados_rascunho } = body;

    // Criar processo com status rascunho
    const { data, error } = await supabase
      .from("processos_emissao")
      .insert({
        nome: nome || "Novo Processo",
        curso_id: curso_id || null,
        status: "rascunho",
        total_diplomas: 0,
        dados_rascunho: dados_rascunho || {},
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[rascunho/POST] Erro ao criar rascunho:", error);
      return NextResponse.json(
        { error: "Erro ao criar rascunho" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  },
  { skipCSRF: true },
);

export const PUT = protegerRota(
  async (request, { userId }) => {
    const supabase = await createClient();
    const body = await request.json();

    const { id, nome, curso_id, dados_rascunho } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do rascunho é obrigatório para atualização" },
        { status: 400 },
      );
    }

    // Verificar se processo existe e é rascunho
    const { data: processo, error: fetchError } = await supabase
      .from("processos_emissao")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchError || !processo) {
      return NextResponse.json(
        { error: "Rascunho não encontrado" },
        { status: 404 },
      );
    }

    if (processo.status !== "rascunho") {
      return NextResponse.json(
        {
          error:
            "Apenas processos em rascunho podem ser atualizados por esta rota",
        },
        { status: 400 },
      );
    }

    // Atualizar
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nome !== undefined) updatePayload.nome = nome;
    if (curso_id !== undefined) updatePayload.curso_id = curso_id || null;
    if (dados_rascunho !== undefined)
      updatePayload.dados_rascunho = dados_rascunho;

    const { error: updateError } = await supabase
      .from("processos_emissao")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      console.error("[rascunho/PUT] Erro ao atualizar rascunho:", updateError);
      return NextResponse.json(
        { error: "Erro ao atualizar rascunho" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id, updated: true });
  },
  { skipCSRF: true },
);
