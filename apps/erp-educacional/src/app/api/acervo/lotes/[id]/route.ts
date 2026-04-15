import { verificarAuth, erroNaoEncontrado } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// GET /api/acervo/lotes/[id] — detalhe do lote com documentos
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const supabase = await createClient();

    const { data: lote, error } = await supabase
      .from("acervo_lotes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !lote) {
      return erroNaoEncontrado();
    }

    // Busca documentos do lote via acervo_digitalizacao_meta
    const { data: metas } = await supabase
      .from("acervo_digitalizacao_meta")
      .select(`
        *,
        documentos_digitais (
          id, titulo, destinatario_nome, status,
          arquivo_url, arquivo_hash_sha256,
          codigo_verificacao, url_verificacao, origem
        )
      `)
      .eq("lote_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ lote, documentos: metas ?? [] });
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro((err as Error).message, 500) }, { status: 500 });
  }
}

// PATCH /api/acervo/lotes/[id] — atualiza status ou dados do lote
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const { id } = await params
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("acervo_lotes")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro((err as Error).message, 500) }, { status: 500 });
  }
}
