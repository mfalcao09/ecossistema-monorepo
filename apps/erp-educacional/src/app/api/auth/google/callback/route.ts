/**
 * GET /api/auth/google/callback?code=&state=
 * Troca code por tokens, persiste refresh_token, redireciona para /atendimento/agendamentos.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, getUserEmail } from "@/lib/atendimento/google-oauth";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errParam = request.nextUrl.searchParams.get("error");

  if (errParam) {
    return NextResponse.redirect(
      new URL(`/atendimento/agendamentos?google_error=${encodeURIComponent(errParam)}`, request.url),
    );
  }
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }
  if (state && state !== user.id) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL(
          "/atendimento/agendamentos?google_error=no_refresh_token",
          request.url,
        ),
      );
    }
    const email = await getUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const admin = createAdminClient();
    await admin
      .from("atendimento_google_tokens")
      .upsert(
        {
          user_id: user.id,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          expires_at: expiresAt,
          scope: tokens.scope,
          email,
        },
        { onConflict: "user_id" },
      );

    return NextResponse.redirect(
      new URL("/atendimento/agendamentos?google_connected=1", request.url),
    );
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(
      new URL(
        `/atendimento/agendamentos?google_error=${encodeURIComponent(err instanceof Error ? err.message : "unknown")}`,
        request.url,
      ),
    );
  }
}
