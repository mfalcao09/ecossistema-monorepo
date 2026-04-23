/**
 * POST /api/atendimento/widgets/share
 *   body { widget_id: string, ttl_seconds?: number (60–2592000) }
 *   → { ok, token, url, expires_at }  — o token é mostrado UMA VEZ.
 *
 * DELETE /api/atendimento/widgets/share?id=<share_token_id>
 *   → revoga o token (set revoked_at = now()).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { signWidgetToken } from "@/lib/atendimento/dashboards";

const shareSchema = z.object({
  widget_id: z.string().uuid(),
  ttl_seconds: z.number().int().min(60).max(2_592_000).optional(),
});

export const POST = protegerRota(
  async (request, { userId }) => {
    const body = await request.json().catch(() => null);
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "payload_invalido",
          detalhes: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: widget, error: wErr } = await (admin as any)
      .from("dashboard_widgets")
      .select("id, is_public")
      .eq("id", parsed.data.widget_id)
      .maybeSingle();
    if (wErr || !widget) {
      return NextResponse.json(
        { ok: false, error: "widget_not_found" },
        { status: 404 },
      );
    }
    if (!widget.is_public) {
      return NextResponse.json(
        { ok: false, error: "widget_not_public" },
        { status: 403 },
      );
    }

    const ttl = parsed.data.ttl_seconds ?? 3600;
    const { token, hash, payload } = signWidgetToken(widget.id, ttl);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tokenRow, error } = await (admin as any)
      .from("widget_share_tokens")
      .insert({
        widget_id: widget.id,
        token_hash: hash,
        created_by: userId,
        expires_at: new Date(payload.exp * 1000).toISOString(),
      })
      .select("id, expires_at")
      .single();
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const base = process.env.NEXT_PUBLIC_APP_URL || "";
    const url = `${base}/api/atendimento/widgets/embed?token=${encodeURIComponent(token)}`;

    return NextResponse.json({
      ok: true,
      share_id: tokenRow.id,
      token,
      url,
      expires_at: tokenRow.expires_at,
    });
  },
  { skipCSRF: true },
);

export const DELETE = protegerRota(
  async (request) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id_missing" },
        { status: 400 },
      );
    }
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("widget_share_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  },
  { skipCSRF: true },
);
