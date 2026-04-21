/**
 * GET  /api/atendimento/api-keys — lista (só prefix + metadados, nunca plaintext)
 * POST /api/atendimento/api-keys — cria nova chave (retorna plaintext UMA VEZ)
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { generateApiKey } from "@/lib/atendimento/api-key";

const ALLOWED_SCOPES = new Set([
  "messages:send",
  "messages:read",
  "contacts:read",
  "contacts:write",
  "deals:read",
  "deals:write",
  "dashboard:read",
  "*",
]);

export const GET = withPermission("webhooks", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, rotated_at, active, revoked_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
});

export const POST = withPermission("webhooks", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    scopes?: string[];
  } | null;

  if (!body?.name) {
    return NextResponse.json({ erro: "Campo 'name' é obrigatório." }, { status: 400 });
  }
  const scopes = (body.scopes ?? []).filter((s) => ALLOWED_SCOPES.has(s));
  if (scopes.length === 0) {
    return NextResponse.json({ erro: `Pelo menos 1 scope é obrigatório. Permitidos: ${[...ALLOWED_SCOPES].join(", ")}` }, { status: 400 });
  }

  const { plaintext, hash, prefix } = generateApiKey();

  const { data, error } = await ctx.supabase
    .from("api_keys")
    .insert({
      name: body.name.trim(),
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      created_by: ctx.userId,
    })
    .select("id, name, key_prefix, scopes, active, created_at")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({
    key: data,
    plaintext,
    warning: "Grave esta chave agora — ela NÃO será exibida novamente.",
  }, { status: 201 });
});
