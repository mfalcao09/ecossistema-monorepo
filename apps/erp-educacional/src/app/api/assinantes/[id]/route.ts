import { protegerRota } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Wrapper manual porque protegerRota não suporta params de rota dinâmica
  const handler = protegerRota(
    async (request, { userId, tenantId }) => {
      const { id } = await params;
      const supabase = await createClient();
      const body = await request.json();

      const { data, error } = await supabase
        .from("assinantes")
        .update(body)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: sanitizarErro(error.message, 500) },
          { status: 500 },
        );
      }
      return NextResponse.json(data);
    },
    { skipCSRF: true },
  );
  return handler(req);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const handler = protegerRota(
    async (request, { userId, tenantId }) => {
      const { id } = await params;
      const supabase = await createClient();

      const { error } = await supabase.from("assinantes").delete().eq("id", id);

      if (error) {
        return NextResponse.json(
          { error: sanitizarErro(error.message, 500) },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true });
    },
    { skipCSRF: true },
  );
  return handler(req);
}
