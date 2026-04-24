import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// POST /api/configuracoes/assinatura/testar
// Testa autenticação na API BRy KMS com as credenciais fornecidas
export const POST = protegerRota(async (req: NextRequest) => {
  const supabase = await createClient();

  const { api_url, client_id, client_secret } = (await req.json()) as {
    api_url?: string;
    client_id?: string;
    client_secret?: string;
  };

  if (!api_url || !client_id || !client_secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "URL, client_id e client_secret são obrigatórios para o teste.",
      },
      { status: 400 },
    );
  }

  try {
    // Tenta obter token JWT da API BRy
    const resp = await fetch(`${api_url.replace(/\/$/, "")}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id,
        client_secret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(8000), // 8 segundos timeout
    });

    if (resp.ok) {
      const data = (await resp.json()) as {
        access_token?: string;
        token_type?: string;
      };
      if (data.access_token) {
        return NextResponse.json({
          ok: true,
          mensagem: `Conexão estabelecida com sucesso. Token ${data.token_type ?? "Bearer"} obtido.`,
        });
      }
    }

    const errBody = await resp.text().catch(() => "");
    return NextResponse.json({
      ok: false,
      error: `API BRy retornou status ${resp.status}. ${errBody ? `Detalhe: ${errBody.slice(0, 200)}` : ""}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro de rede";
    // Timeout
    if (msg.includes("AbortError") || msg.includes("timeout")) {
      return NextResponse.json({
        ok: false,
        error:
          "Tempo esgotado (8s). Verifique se a URL da API BRy está correta e acessível.",
      });
    }
    return NextResponse.json({
      ok: false,
      error: `Não foi possível conectar à API BRy: ${msg}`,
    });
  }
});
