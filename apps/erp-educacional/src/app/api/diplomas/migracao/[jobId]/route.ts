import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/diplomas/migracao/[jobId]
//   Retorna status atual de um job de migração (usado para polling no frontend)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { jobId } = await params;
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("migracao_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }

  return NextResponse.json(job);
}
