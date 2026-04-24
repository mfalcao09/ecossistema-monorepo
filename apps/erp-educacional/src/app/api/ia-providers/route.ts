import { protegerRota } from "@/lib/security/api-guard";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { z } from "zod";

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

/**
 * Mascara chave API: primeiros 10 caracteres + '•••' + últimos 4
 */
function mascararChave(chave: string | null): string | null {
  if (!chave) return null;
  if (chave.length <= 14) return "•••";
  return chave.substring(0, 10) + "•••" + chave.substring(chave.length - 4);
}

const iaProviderSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(255),
  slug: z.string().min(1, "Slug é obrigatório").max(100),
  base_url: z.string().url("URL deve ser válida"),
  api_key: z.string().min(1, "Chave API é obrigatória"),
  formato_api: z.enum([
    "openai_compatible",
    "google_genai",
    "anthropic_messages",
  ]),
  headers_extras: z.record(z.string()).optional().nullable(),
  modelos_disponiveis: z.array(z.string()).optional().nullable(),
  ativo: z.boolean().optional().default(true),
  ordem: z.number().int().optional().default(0),
});

type IaProvider = z.infer<typeof iaProviderSchema>;

export const GET = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    const admin = getAdminClient();

    const { data, error } = await admin
      .from("ia_providers")
      .select("*")
      .order("ordem")
      .order("nome");

    if (error) {
      return NextResponse.json(
        { erro: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    // Mascarar api_key em todos os registros
    const mascarados = (data ?? []).map((provider) => ({
      ...provider,
      api_key: mascararChave(provider.api_key),
    }));

    return NextResponse.json(mascarados);
  },
  { skipCSRF: true },
);

export const POST = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    const admin = getAdminClient();
    const body = await request.json();

    // Validação com Zod
    const parsed = iaProviderSchema.safeParse(body);
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
      .from("ia_providers")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { erro: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    // Mascarar api_key antes de retornar
    const resultado = {
      ...data,
      api_key: mascararChave(data.api_key),
    };

    return NextResponse.json(resultado, { status: 201 });
  },
  { skipCSRF: true },
);
