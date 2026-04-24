import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { credenciamentoSchema } from "@/lib/security/zod-schemas";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const instituicaoId = searchParams.get("instituicao_id");

    let query = supabase
      .from("credenciamentos")
      .select("*")
      .order("data", { ascending: false });
    if (instituicaoId) query = query.eq("instituicao_id", instituicaoId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }
    return NextResponse.json(data);
  },
  { skipCSRF: true },
);

export const POST = protegerRota(async (request, { userId, tenantId }) => {
  const supabase = await createClient();
  const raw = await request.json();

  // Validação com Zod
  const parsed = credenciamentoSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        detalhes: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // Se este credenciamento é vigente, remove vigente dos demais da mesma IES
  if (body.vigente && body.instituicao_id) {
    await supabase
      .from("credenciamentos")
      .update({ vigente: false })
      .eq("instituicao_id", body.instituicao_id);
  }

  const { data, error } = await supabase
    .from("credenciamentos")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: sanitizarErro(error.message, 500) },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: 201 });
});
