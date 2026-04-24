import { protegerRota } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/acervo/mec/tokens — lista tokens de acesso MEC (uso interno)
export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    try {
      const supabase = await createClient();

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
      }

      const { data: tokens, error } = await supabase
        .from("acervo_mec_tokens")
        .select(
          `
        id, token, descricao, ativo,
        ultimo_uso_em, expira_em, created_at,
        criado_por_user_id
      `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Mascara o token na listagem (mostra apenas primeiros e últimos 4 chars)
      const tokensMascarados = (tokens ?? []).map((t) => ({
        ...t,
        token_preview: `${t.token.slice(0, 6)}...${t.token.slice(-4)}`,
        token: undefined, // nunca expõe o token completo na listagem
      }));

      return NextResponse.json(tokensMascarados);
    } catch (err) {
      return NextResponse.json(
        { erro: sanitizarErro((err as Error).message, 500) },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);
