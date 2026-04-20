import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { withPermission } from "@/lib/atendimento/permissions";

/**
 * GET  /api/atendimento/invites
 *   → lista convites pendentes (não aceitos, não revogados, não expirados)
 *
 * POST /api/atendimento/invites
 *   body: { email, role_id, team_id? }
 *   → gera token, expira em 7 dias, retorna link de aceite
 *
 * Para FIC (single-tenant) o envio por email ainda é manual — operador
 * copia o link. Fase 2 SaaS integra Resend / Supabase magic link.
 */

const TTL_DAYS = 7;
const INVITE_TOKEN_BYTES = 32; // 64 chars hex

function generateToken(): string {
  return crypto.randomBytes(INVITE_TOKEN_BYTES).toString("hex");
}

function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const GET = withPermission("users", "view")(async (_req: NextRequest, ctx) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("agent_invites")
    .select("id, email, role_id, team_id, expires_at, created_at, invited_by")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
});

export const POST = withPermission("users", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    role_id?: string;
    team_id?: string | null;
  } | null;

  if (!body?.email || !isEmailValid(body.email)) {
    return NextResponse.json({ erro: "Email inválido." }, { status: 400 });
  }
  if (!body?.role_id) {
    return NextResponse.json({ erro: "Campo 'role_id' é obrigatório." }, { status: 400 });
  }

  // Confere role existe
  const { data: role } = await ctx.supabase
    .from("agent_roles")
    .select("id")
    .eq("id", body.role_id)
    .maybeSingle();
  if (!role) return NextResponse.json({ erro: "Cargo não encontrado." }, { status: 404 });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await ctx.supabase
    .from("agent_invites")
    .insert({
      email: body.email.trim().toLowerCase(),
      role_id: body.role_id,
      team_id: body.team_id ?? null,
      invited_by: ctx.userId,
      token,
      expires_at: expiresAt,
    })
    .select("id, email, role_id, team_id, expires_at, created_at")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Monta link de aceite (frontend lida com o fluxo)
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const acceptUrl = `${origin}/atendimento/convite?token=${token}`;

  return NextResponse.json(
    {
      invite: data,
      accept_url: acceptUrl,
      token_preview: `${token.slice(0, 8)}…`,
    },
    { status: 201 },
  );
});
