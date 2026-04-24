import { protegerRota } from "@/lib/security/api-guard";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export const GET = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    const admin = getAdminClient();

    // Extrair id: /api/ia-providers/{uuid}/modelos
    const pathParts = request.nextUrl.pathname.split("/");
    const idx = pathParts.indexOf("ia-providers");
    const providerId = idx >= 0 ? pathParts[idx + 1] : null;

    if (!providerId) {
      return NextResponse.json(
        { erro: "ID do provider é obrigatório" },
        { status: 400 },
      );
    }

    // Buscar modelos do provider
    const { data, error } = await admin
      .from("ia_providers")
      .select("id, nome, modelos_disponiveis, modelos_atualizados_em")
      .eq("id", providerId)
      .single();

    if (error) {
      return NextResponse.json(
        { erro: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { erro: "Provider não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      providerId: data.id,
      nome: data.nome,
      modelos: data.modelos_disponiveis ?? [],
      atualizadoEm: data.modelos_atualizados_em,
    });
  },
  { skipCSRF: true },
);
