// =============================================================================
// API Route — /api/pessoas/[id]/contatos
// GET: list contatos for a pessoa
// POST: add contato to a pessoa
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verificarAuth } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { adicionarContato } from "@/lib/supabase/pessoas";
import type { PessoaContato } from "@/types/pessoas";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("pessoa_contatos")
      .select("*")
      .eq("pessoa_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar contatos: ${error.message}`);
    }

    return NextResponse.json(data as PessoaContato[]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const contato = await adicionarContato(id, body);
    return NextResponse.json(contato, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
