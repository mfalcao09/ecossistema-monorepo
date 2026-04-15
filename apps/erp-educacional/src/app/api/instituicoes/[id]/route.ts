import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { verificarAuth, erroNaoEncontrado, erroInterno } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";

// GET - Buscar instituição por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instituicoes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error('[API] Erro ao buscar instituição:', error.message);
    return erroNaoEncontrado();
  }

  return NextResponse.json(data);
}

// PUT - Atualizar instituição
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  const { id } = await params
  const supabase = await createClient();
  const body = await request.json();

  // Limpa campos vazios — transforma "" em null para não perder dados
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "id") continue; // Não atualiza o ID
    cleaned[key] = value === "" ? null : value;
  }

  const { data, error } = await supabase
    .from("instituicoes")
    .update(cleaned)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error('[API] Erro ao atualizar instituição:', error.message);
    return erroInterno();
  }

  return NextResponse.json(data);
}

// PATCH - alias para PUT (compatibilidade com o cliente)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

// DELETE - Excluir instituição (soft delete via campo ativo)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  const { id } = await params
  const supabase = await createClient();

  const { error } = await supabase
    .from("instituicoes")
    .update({ ativo: false })
    .eq("id", id);

  if (error) {
    console.error('[API] Erro ao deletar instituição:', error.message);
    return erroInterno();
  }

  return NextResponse.json({ success: true });
}
