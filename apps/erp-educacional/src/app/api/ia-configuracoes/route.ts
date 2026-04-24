import { protegerRota } from "@/lib/security/api-guard";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { iaConfiguracaoSchema } from "@/lib/security/zod-schemas";

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
    const { searchParams } = new URL(request.url);
    const modulo = searchParams.get("modulo");

    let query = admin
      .from("ia_configuracoes")
      .select("*")
      .order("modulo")
      .order("nome_agente");
    if (modulo) query = query.eq("modulo", modulo);

    const { data, error } = await query;
    if (error)
      return NextResponse.json(
        { erro: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    return NextResponse.json(data ?? []);
  },
  { skipCSRF: true },
);

export const POST = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    const admin = getAdminClient();
    const body = await request.json();

    // Validação com Zod
    const parsed = iaConfiguracaoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          erro: "Dados inválidos",
          detalhes: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const insertData: Record<string, unknown> = { ...parsed.data };
    if (userId) insertData.criado_por = userId;

    const { data, error } = await admin
      .from("ia_configuracoes")
      .insert(insertData)
      .select()
      .single();

    if (error)
      return NextResponse.json(
        { erro: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    return NextResponse.json(data, { status: 201 });
  },
);
