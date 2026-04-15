import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { verificarAuth, erroBadRequest, erroInterno } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { validar, schemas } from "@/lib/security/validation";

// GET - Listar todas as instituições (requer autenticação)
export async function GET(request: NextRequest) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instituicoes")
    .select("*")
    .eq("ativo", true)
    .order("tipo")
    .order("nome");

  if (error) {
    console.error("[API] Erro ao listar instituições:", error.message);
    return erroInterno();
  }

  return NextResponse.json(data);
}

// POST - Criar nova instituição (requer autenticação + validação)
export async function POST(request: NextRequest) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  // Parsear e validar body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return erroBadRequest("JSON inválido no corpo da requisição");
  }

  const resultado = validar(body, schemas.criarInstituicao);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: resultado.erros },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instituicoes")
    .insert(resultado.data!)
    .select()
    .single();

  if (error) {
    console.error("[API] Erro ao criar instituição:", error.message);
    return erroInterno();
  }

  return NextResponse.json(data, { status: 201 });
}
