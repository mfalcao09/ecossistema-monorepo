/**
 * GET /api/atendimento/contacts?q=&limit=
 * Lista simplificada usada pelos modals (templates send, scheduling).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const q = request.nextUrl.searchParams;
  const limit = Math.min(Number(q.get("limit") ?? 200), 1000);
  const search = q.get("q");

  let query = admin
    .from("atendimento_contacts")
    .select("id, name, phone_number, phone_number_e164, email")
    .order("name")
    .limit(limit);

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
