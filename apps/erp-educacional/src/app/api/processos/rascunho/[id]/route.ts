import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { verificarAuth } from "@/lib/security/api-guard";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET - Buscar dados de rascunho por ID do processo
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("processos_emissao")
    .select(
      "id, nome, status, curso_id, turno, periodo_letivo, data_colacao, dados_rascunho",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Rascunho não encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
