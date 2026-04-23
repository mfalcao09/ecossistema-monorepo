// =============================================================================
// GET /api/auth/minhas-permissoes
// Retorna todas as permissões do usuário logado como array de "modulo:acao"
// Consumido pelo PermissoesProvider para popular o contexto na UI
// =============================================================================

import { protegerRota } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { carregarTodasPermissoes } from "@/lib/supabase/rbac";

// Sessão 2026-04-23 — fix produção travando 300s (ver commit).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const t0 = Date.now();
    console.log("[api/auth/minhas-permissoes] enter handler", { userId });

    try {
      const permissoesSet = await carregarTodasPermissoes(userId);
      console.log("[api/auth/minhas-permissoes] carregarTodasPermissoes done", {
        dt: Date.now() - t0,
        count: permissoesSet.size,
      });
      return NextResponse.json({
        permissoes: Array.from(permissoesSet),
      });
    } catch (err) {
      console.error("[minhas-permissoes]", err);
      return NextResponse.json({ permissoes: [] });
    }
  },
  { skipCSRF: true },
);
