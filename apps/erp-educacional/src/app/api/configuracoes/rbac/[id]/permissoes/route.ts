// =============================================================================
// GET /api/configuracoes/rbac/[id]/permissoes  — Mapa de permissões do papel
// PUT /api/configuracoes/rbac/[id]/permissoes  — Sincroniza permissões do papel
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  verificarAuthComPermissao,
  erroBadRequest,
  erroNaoEncontrado,
  erroInterno,
} from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import {
  obterMapaPermissoes,
  atualizarPermissoesPapel,
  buscarPapel,
} from "@/lib/supabase/rbac";
import { logAdminAction } from "@/lib/security/security-logger";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ─── GET /api/configuracoes/rbac/[id]/permissoes ─────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuthComPermissao(
    request,
    "configuracoes",
    "acessar",
  );
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const papel = await buscarPapel(id);
    if (!papel) return erroNaoEncontrado();

    const mapa = await obterMapaPermissoes(id);
    return NextResponse.json({ sucesso: true, dados: mapa });
  } catch (erro) {
    console.error("[GET /api/configuracoes/rbac/[id]/permissoes]", erro);
    return erroInterno();
  }
}

// ─── PUT /api/configuracoes/rbac/[id]/permissoes ─────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuthComPermissao(
    request,
    "configuracoes",
    "alterar",
  );
  if (auth instanceof NextResponse) return auth;

  // CSRF validation for PUT requests
  const csrfError = validarCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const body: { permissao_ids: string[] } = await request.json();

    if (!Array.isArray(body.permissao_ids)) {
      return erroBadRequest("permissao_ids deve ser um array de strings.");
    }

    const papel = await buscarPapel(id);
    if (!papel) return erroNaoEncontrado();

    await atualizarPermissoesPapel(id, body.permissao_ids);
    const mapaAtualizado = await obterMapaPermissoes(id);

    // Log admin action - permission change (non-blocking)
    void logAdminAction(request, auth.userId, "atualizar_permissoes_papel", {
      papel_id: papel.id,
      papel_nome: papel.nome,
      permissoes_count: body.permissao_ids.length,
    });

    return NextResponse.json({
      sucesso: true,
      dados: mapaAtualizado,
      mensagem: "Permissões atualizadas com sucesso.",
    });
  } catch (erro) {
    console.error("[PUT /api/configuracoes/rbac/[id]/permissoes]", erro);
    return erroInterno();
  }
}
