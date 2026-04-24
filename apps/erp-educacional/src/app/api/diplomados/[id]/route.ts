import { verificarAuth } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// PUT - Atualizar diplomado
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { filiacoes: filiacoesData, ...diplomadoData } = body;

  try {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(diplomadoData)) {
      if (key === "id" || key === "created_at") continue;
      cleaned[key] = value === "" ? null : value;
    }

    if (cleaned.cpf) {
      cleaned.cpf = (cleaned.cpf as string).replace(/\D/g, "");
    }

    cleaned.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("diplomados")
      .update(cleaned)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    // Atualizar filiações: deletar as antigas e recriar
    if (filiacoesData !== undefined) {
      await supabase.from("filiacoes").delete().eq("diplomado_id", id);

      const filiacoesParaInserir = (filiacoesData || [])
        .filter((f: Record<string, string>) => f.nome && f.nome.trim() !== "")
        .map((f: Record<string, string>, idx: number) => ({
          diplomado_id: id,
          nome: f.nome,
          nome_social: f.nome_social || null,
          sexo: f.sexo || null,
          ordem: idx + 1,
        }));

      if (filiacoesParaInserir.length > 0) {
        await supabase.from("filiacoes").insert(filiacoesParaInserir);
      }
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

// DELETE - Remover diplomado
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const supabase = await createClient();

  try {
    const { error } = await supabase.from("diplomados").delete().eq("id", id);

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
