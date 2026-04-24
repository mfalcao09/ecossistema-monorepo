import { verificarAuth } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();

  try {
    const { data, error } = await supabase
      .from("diretores_ies")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        erro: sanitizarErro(
          err instanceof Error ? err.message : "Erro interno",
          500,
        ),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { id } = await params;

  try {
    // Soft delete
    const { error } = await supabase
      .from("diretores_ies")
      .update({ ativo: false })
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        erro: sanitizarErro(
          err instanceof Error ? err.message : "Erro interno",
          500,
        ),
      },
      { status: 500 },
    );
  }
}
