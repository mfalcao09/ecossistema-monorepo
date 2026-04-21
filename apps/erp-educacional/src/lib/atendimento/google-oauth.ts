/**
 * Google OAuth2 helpers — calendar scope.
 * Evita dep googleapis; usa fetch direto contra oauth2.googleapis.com.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: CALENDAR_SCOPES.join(" "),
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed ${res.status}: ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed ${res.status}: ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function getUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Retorna um access_token válido para o usuário, refreshando se necessário.
 */
export async function getValidAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("atendimento_google_tokens")
    .select("refresh_token, access_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;

  const isValid =
    row.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000;
  if (isValid) return row.access_token;

  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await admin
    .from("atendimento_google_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiry,
    })
    .eq("user_id", userId);
  return refreshed.access_token;
}
