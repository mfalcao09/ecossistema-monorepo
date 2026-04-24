import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/configuracoes/assinatura — retorna config BRy KMS (sem campos sensíveis em texto)
export const GET = protegerRota(
  async (_request: NextRequest) => {
    const supabase = await createClient();

    const { data } = await supabase
      .from("configuracoes")
      .select("valor, atualizado_em")
      .eq("chave", "bry_kms")
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ config: null });
    }

    // Remove campos sensíveis — nunca retornar secrets em claro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = { ...(data.valor as any) };
    if (val.client_secret) val.client_secret = ""; // mascara
    if (val.credencial_valor) val.credencial_valor = ""; // mascara
    if (val.tsa_senha) val.tsa_senha = ""; // mascara

    return NextResponse.json({
      config: val,
      atualizado_em: data.atualizado_em,
    });
  },
  { skipCSRF: true },
);

// POST /api/configuracoes/assinatura — salva config BRy KMS
export const POST = protegerRota(async (req: NextRequest, { userId }) => {
  const supabase = await createClient();

  const body = await req.json();

  // Se algum campo sensível vier vazio, preservar o valor já salvo
  const { data: existente } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "bry_kms")
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valorAtual = (existente?.valor ?? {}) as Record<string, any>;

  const novoValor = {
    ...valorAtual,
    ...body,
    // Se campos sensíveis vieram vazios, mantém o valor anterior
    client_secret: body.client_secret || valorAtual.client_secret || "",
    credencial_valor:
      body.credencial_valor || valorAtual.credencial_valor || "",
    tsa_senha: body.tsa_senha || valorAtual.tsa_senha || "",
    atualizado_por: userId,
  };

  const { error: upsertErr } = await supabase.from("configuracoes").upsert(
    {
      chave: "bry_kms",
      valor: novoValor,
      descricao:
        "Configuração BRy KMS — assinatura digital ICP-Brasil XAdES AD-RA",
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "chave" },
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
