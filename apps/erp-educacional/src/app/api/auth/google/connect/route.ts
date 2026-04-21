/**
 * GET /api/auth/google/connect
 * Redireciona para consent Google OAuth. state = user_id (assinado via JWT supabase).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { buildAuthorizationUrl } from "@/lib/atendimento/google-oauth";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = buildAuthorizationUrl(user.id);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "config_error" },
      { status: 500 },
    );
  }
}
