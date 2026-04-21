/**
 * POST /api/atendimento/api-keys/[id]/rotate
 *
 * Gera NOVA chave plaintext, atualiza hash + prefix, seta rotated_at.
 * A chave anterior deixa de funcionar. Retorna plaintext UMA VEZ.
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { generateApiKey } from "@/lib/atendimento/api-key";

type RouteParams = { id: string };

export const POST = withPermission("webhooks", "edit")(async (_req: NextRequest, ctx) => {
  const params = (await (ctx.params as Promise<RouteParams> | undefined))
    ?? ({ id: "" } as RouteParams);

  const { plaintext, hash, prefix } = generateApiKey();

  const { data, error } = await ctx.supabase
    .from("api_keys")
    .update({
      key_hash: hash,
      key_prefix: prefix,
      rotated_at: new Date().toISOString(),
      active: true,
      revoked_at: null,
    })
    .eq("id", params.id)
    .select("id, name, key_prefix, scopes, rotated_at")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({
    key: data,
    plaintext,
    warning: "Grave esta chave agora — a chave anterior foi invalidada.",
  });
});
