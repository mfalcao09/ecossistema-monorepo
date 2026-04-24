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

function mascararChave(chave: string | null): string | null {
  if (!chave) return null;
  if (chave.length <= 14) return "•••";
  return chave.substring(0, 10) + "•••" + chave.substring(chave.length - 4);
}

function extractId(pathname: string): string | null {
  // /api/ia-providers/[uuid]/... → segment index 3
  const parts = pathname.split("/");
  const idx = parts.indexOf("ia-providers");
  return idx >= 0 ? parts[idx + 1] || null : null;
}

export const PATCH = protegerRota(
  async (request: NextRequest) => {
    const admin = getAdminClient();
    const providerId = extractId(request.nextUrl.pathname);

    if (!providerId) {
      return NextResponse.json(
        { erro: "ID do provider é obrigatório" },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Campos permitidos para atualização
    const allowedFields = [
      "nome",
      "slug",
      "base_url",
      "api_key",
      "formato_api",
      "headers_extras",
      "ativo",
      "ordem",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        // Se api_key contém '•••', significa que é a máscara — NÃO atualizar
        if (
          key === "api_key" &&
          typeof body[key] === "string" &&
          body[key].includes("•••")
        ) {
          continue;
        }
        updateData[key] = body[key];
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("ia_providers")
      .update(updateData)
      .eq("id", providerId)
      .select()
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

    return NextResponse.json({ ...data, api_key: mascararChave(data.api_key) });
  },
  { skipCSRF: true },
);

export const DELETE = protegerRota(
  async (request: NextRequest) => {
    const admin = getAdminClient();
    const providerId = extractId(request.nextUrl.pathname);

    if (!providerId) {
      return NextResponse.json(
        { erro: "ID do provider é obrigatório" },
        { status: 400 },
      );
    }

    const { error } = await admin
      .from("ia_providers")
      .delete()
      .eq("id", providerId);
    if (error) {
      return NextResponse.json(
        { erro: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }
    return NextResponse.json({ mensagem: "Provider deletado com sucesso" });
  },
  { skipCSRF: true },
);
