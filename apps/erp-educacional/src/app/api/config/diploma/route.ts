import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota, erroInterno } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/config/diploma?ambiente=homologacao|producao
export const GET = protegerRota(
  async (request: NextRequest) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const ambiente = searchParams.get("ambiente") ?? "homologacao";

    const { data, error } = await supabase
      .from("diploma_config")
      .select(
        `
      *,
      ies_emissora:ies_emissora_id(id, nome, cnpj, codigo_mec, tipo),
      ies_registradora:ies_registradora_id(id, nome, cnpj, codigo_mec, tipo)
    `,
      )
      .eq("ambiente", ambiente)
      .single();

    if (error) {
      console.error("[API] Erro ao buscar diploma config:", error.message);
      return erroInterno();
    }

    return NextResponse.json(data);
  },
  { skipCSRF: true },
);

// PATCH /api/config/diploma
// Body: { ambiente, ...campos a atualizar }
export const PATCH = protegerRota(
  async (request: NextRequest) => {
    const supabase = await createClient();
    const body = await request.json();
    const { ambiente, ...updates } = body;

    if (!ambiente) {
      return NextResponse.json(
        { error: "Campo ambiente é obrigatório" },
        { status: 400 },
      );
    }

    // Campos protegidos — nunca retornar após update
    const camposProtegidos = ["id", "created_at"];
    camposProtegidos.forEach((c) => delete updates[c]);

    const { data, error } = await supabase
      .from("diploma_config")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("ambiente", ambiente)
      .select()
      .single();

    if (error) {
      console.error("[API] Erro ao atualizar diploma config:", error.message);
      return erroInterno();
    }

    return NextResponse.json(data);
  },
  { skipCSRF: true },
);
