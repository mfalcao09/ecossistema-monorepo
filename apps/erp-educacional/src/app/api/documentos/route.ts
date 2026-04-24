import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota, verificarAuth } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { documentoSchema } from "@/lib/security/zod-schemas";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/documentos — lista documentos com filtros opcionais
export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    try {
      const supabase = await createClient();
      const { searchParams } = new URL(request.url);

      const tipo = searchParams.get("tipo");
      const status = searchParams.get("status");
      const diplomadoId = searchParams.get("diplomado_id");
      const limit = parseInt(searchParams.get("limit") ?? "50");
      const offset = parseInt(searchParams.get("offset") ?? "0");

      let query = supabase
        .from("documentos_digitais")
        .select(
          `
        *,
        instituicoes ( nome_fantasia, razao_social )
      `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (tipo) query = query.eq("tipo", tipo);
      if (status) query = query.eq("status", status);
      if (diplomadoId) query = query.eq("diplomado_id", diplomadoId);

      const { data, error, count } = await query;

      if (error) throw error;

      return NextResponse.json({ documentos: data ?? [], total: count ?? 0 });
    } catch (err) {
      const msg = sanitizarErro(
        err instanceof Error ? err.message : "Erro interno",
        500,
      );
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  },
  { skipCSRF: true },
);

// POST /api/documentos — cria novo documento na engine
export async function POST(request: NextRequest) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();

    // Validação com Zod
    const parsed = documentoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          detalhes: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { registrarDocumento } = await import("@/lib/documentos/engine");

    const resultado = await registrarDocumento(parsed.data);

    if (!resultado.sucesso) {
      return NextResponse.json(
        { error: sanitizarErro(resultado.erro ?? "Erro desconhecido", 400) },
        { status: 400 },
      );
    }

    return NextResponse.json(resultado.documento, { status: 201 });
  } catch (err) {
    const msg = sanitizarErro(
      err instanceof Error ? err.message : "Erro interno",
      500,
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
