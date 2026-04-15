import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota, erroInterno } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// PUT /api/config/ordem-assinatura
// Atualiza a ordem_assinatura_padrao na diploma_config ativa
export const PUT = protegerRota(async (request: NextRequest) => {
  const supabase = await createClient();
  const body = await request.json();
  const { ordem_assinatura_padrao } = body;

  if (!Array.isArray(ordem_assinatura_padrao)) {
    return NextResponse.json({ error: "ordem_assinatura_padrao deve ser um array de IDs" }, { status: 400 });
  }

  // Busca a config ativa
  const { data: configs } = await supabase
    .from("diploma_config")
    .select("id")
    .eq("ativo", true)
    .limit(1);

  if (!configs || configs.length === 0) {
    return NextResponse.json({ error: "Nenhuma configuração ativa encontrada" }, { status: 404 });
  }

  const { error } = await supabase
    .from("diploma_config")
    .update({ ordem_assinatura_padrao, updated_at: new Date().toISOString() })
    .eq("id", configs[0].id);

  if (error) {
    console.error('[API] Erro ao atualizar ordem de assinatura:', error.message);
    return erroInterno();
  }

  return NextResponse.json({ ok: true });
})
