import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// ── Rota PÚBLICA — não exige autenticação ──────────────────────────────────
// Retorna apenas dados visuais (logo, banner, cor, nome).
// Campos sensíveis (API keys, etc.) NUNCA são expostos aqui.

// Sessão 2026-04-23 — fix produção travando 300s:
// Next.js 15 + Fluid Compute precisa de `dynamic = 'force-dynamic'` explícito
// para rotas serverless. Sem isso, o runtime às vezes trava em cold-start
// além dos 300s default. `maxDuration=20` garante fail-fast se algo der ruim.
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Campos seguros para exposição pública (sem chaves, sem dados internos)
const CAMPOS_PUBLICOS = [
  "instituicao_nome",
  "cor_principal",
  "logo_url",
  "logo_dark_url",
  "banner_login_url",
  "tema",
] as const;

export async function GET() {
  const t0 = Date.now();
  console.log("[public/system-settings] enter handler");
  try {
    const admin = getAdminClient();
    console.log("[public/system-settings] admin client ready", {
      dt: Date.now() - t0,
    });

    const { data, error } = await admin
      .from("system_settings")
      .select(CAMPOS_PUBLICOS.join(","))
      .eq("id", 1)
      .single();

    console.log("[public/system-settings] supabase query done", {
      dt: Date.now() - t0,
      hasData: Boolean(data),
      errCode: error?.code,
    });

    if (error) {
      // Se não existe, retorna defaults
      if (error.code === "PGRST116") {
        return NextResponse.json({
          instituicao_nome: "FIC - Faculdades Integradas de Cassilândia",
          cor_principal: "#4F46E5",
          logo_url: null,
          logo_dark_url: null,
          banner_login_url: null,
          tema: "claro",
        });
      }
      return NextResponse.json(
        { erro: "Erro ao carregar configurações" },
        { status: 500 },
      );
    }

    return NextResponse.json(data, {
      headers: {
        // Cache por 5 minutos — evita consultas repetidas ao banco
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
