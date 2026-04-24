/**
 * GET /api/atendimento/inboxes?channel=whatsapp
 * Lista inboxes habilitados. Usado pelas UIs de templates/agendamentos.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = request.nextUrl.searchParams.get("channel");
  const admin = createAdminClient();

  let query = admin
    .from("atendimento_inboxes")
    .select("id, name, channel_type, enabled")
    .eq("enabled", true)
    .order("name");
  if (channel) query = query.eq("channel_type", channel);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
