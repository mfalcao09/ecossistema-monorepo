// =============================================================================
// GET /api/configuracoes/permissoes  — Lista todas as permissões do sistema
// Usado pelo formulário de override para popular o select de permissões
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  verificarAuthComPermissao,
  erroInterno,
} from "@/lib/security/api-guard";
import { listarPermissoes } from "@/lib/supabase/rbac";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const auth = await verificarAuthComPermissao(
    request,
    "configuracoes",
    "acessar",
  );
  if (auth instanceof NextResponse) return auth;

  try {
    const permissoes = await listarPermissoes();
    return NextResponse.json({
      sucesso: true,
      dados: permissoes,
      total: permissoes.length,
    });
  } catch (erro) {
    console.error("[GET /api/configuracoes/permissoes]", erro);
    return erroInterno();
  }
}
