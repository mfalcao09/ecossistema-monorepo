import { protegerRota } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// GET /api/acervo/templates — lista templates ativos
export const GET = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const incluirInativos = searchParams.get("incluir_inativos") === "1";

    let query = supabase
      .from("acervo_templates")
      .select("*")
      .order("nome");

    if (!incluirInativos) query = query.eq("ativo", true);
    if (tipo) query = query.eq("tipo", tipo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro((err as Error).message, 500) }, { status: 500 });
  }
}, { skipCSRF: true })

// POST /api/acervo/templates — cria novo template
export const POST = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.nome || !body.tipo || !body.conteudo_html) {
      return NextResponse.json(
        { error: "nome, tipo e conteudo_html são obrigatórios." },
        { status: 400 }
      );
    }

    // Gera slug a partir do nome se não fornecido
    const slug = body.slug ?? body.nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data, error } = await supabase
      .from("acervo_templates")
      .insert({
        nome: body.nome,
        slug,
        tipo: body.tipo,
        descricao: body.descricao ?? null,
        conteudo_html: body.conteudo_html,
        variaveis: body.variaveis ?? {},
        orientacao_pdf: body.orientacao_pdf ?? "portrait",
        formato_papel: body.formato_papel ?? "A4",
        ativo: body.ativo ?? true,
        versao: 1,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro((err as Error).message, 500) }, { status: 500 });
  }
})
