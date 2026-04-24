import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// POST /api/config/testar-bry
// Testa a conexão com o BRy KMS usando as credenciais salvas na diploma_config
export const POST = protegerRota(async (_request: NextRequest) => {
  const supabase = await createClient();

  // Busca config ativa com credenciais BRy
  const { data: configs } = await supabase
    .from("diploma_config")
    .select("assinatura_endpoint, assinatura_api_key_enc, assinatura_provedor")
    .eq("ativo", true)
    .limit(1);

  const config = configs?.[0];

  if (!config) {
    return NextResponse.json(
      { ok: false, erro: "Configuração não encontrada." },
      { status: 404 },
    );
  }

  if (config.assinatura_provedor !== "bry") {
    return NextResponse.json(
      { ok: false, erro: "Provedor configurado não é BRy." },
      { status: 400 },
    );
  }

  if (!config.assinatura_api_key_enc || !config.assinatura_endpoint) {
    return NextResponse.json(
      {
        ok: false,
        erro: "API Token ou endpoint não configurados. Salve as credenciais primeiro.",
      },
      { status: 400 },
    );
  }

  // Testa chamada ao endpoint de listagem de compartimentos (GET /compartimentos)
  // Endpoint leve que só valida autenticação sem efeitos colaterais
  const url = `${config.assinatura_endpoint}/compartimentos?quantidade=1`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.assinatura_api_key_enc}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok || res.status === 200) {
      return NextResponse.json({
        ok: true,
        mensagem: `Conexão bem-sucedida com BRy KMS (${config.assinatura_endpoint}).`,
      });
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        erro: `Autenticação falhou (HTTP ${res.status}). Verifique se o API Token está correto e não expirou.`,
      });
    }

    return NextResponse.json({
      ok: false,
      erro: `BRy retornou HTTP ${res.status}. Verifique o endpoint e as credenciais.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    if (msg.includes("timeout") || msg.includes("AbortError")) {
      return NextResponse.json({
        ok: false,
        erro: "Tempo de resposta esgotado. O endpoint está acessível?",
      });
    }
    return NextResponse.json({ ok: false, erro: `Erro de rede: ${msg}` });
  }
});
