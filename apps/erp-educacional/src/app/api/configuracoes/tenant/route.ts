// =============================================================================
// API Route — Tenant (Instituição)
// GET: obter informações do tenant atual
// PUT: atualizar dados do tenant
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { obterTenant, atualizarTenant } from "@/lib/supabase/tenants";
import type { TenantConfig } from "@/types/configuracoes";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * GET /api/configuracoes/tenant
 * Obtém informações do tenant atual (instituição)
 */
export const GET = protegerRota(
  async (_request: NextRequest) => {
    try {
      const tenant = await obterTenant();

      if (!tenant) {
        return NextResponse.json(
          { success: false, error: "Tenant não encontrado" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);

/**
 * PUT /api/configuracoes/tenant
 * Atualiza dados do tenant
 * Body: Partial<TenantConfig> (atualização parcial)
 */
export const PUT = protegerRota(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as Partial<TenantConfig>;

    // Validação: não permitir atualizar plano ou status diretamente via API do tenant
    if (body.plano !== undefined || body.status_tenant !== undefined) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Plano e status devem ser alterados através de endpoints específicos",
        },
        { status: 403 },
      );
    }

    const tenantAtualizado = await atualizarTenant(body);

    return NextResponse.json({
      success: true,
      data: tenantAtualizado,
      message: "Tenant atualizado com sucesso",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
});
