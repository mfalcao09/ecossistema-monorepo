// =============================================================================
// API Route — Configuração de Módulos
// GET: listar configurações de módulos
// PUT: atualizar configuração de um módulo
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security";
import {
  listarConfigModulos,
  atualizarConfigModulo,
} from "@/lib/supabase/parametros";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface UpdateConfigModuloRequest {
  id: string;
  configuracoes: Record<string, unknown>;
}

/**
 * GET /api/configuracoes/config-modulos
 * Lista todas as configurações de módulos do tenant
 */
export const GET = protegerRota(async (request, auth) => {
  try {
    const configModulos = await listarConfigModulos();

    return NextResponse.json({
      success: true,
      data: configModulos,
      count: configModulos.length,
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

/**
 * PUT /api/configuracoes/config-modulos
 * Atualiza a configuração de um módulo
 * Body: { id: string, configuracoes: Record<string, unknown> }
 */
export const PUT = protegerRota(async (request, auth) => {
  try {
    const body = (await request.json()) as UpdateConfigModuloRequest;

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "ID da configuração é obrigatório" },
        { status: 400 },
      );
    }

    if (!body.configuracoes || typeof body.configuracoes !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: 'Campo "configuracoes" é obrigatório e deve ser um objeto',
        },
        { status: 400 },
      );
    }

    const configAtualizada = await atualizarConfigModulo(
      body.id,
      body.configuracoes,
    );

    return NextResponse.json({
      success: true,
      data: configAtualizada,
      message: "Configuração do módulo atualizada com sucesso",
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
