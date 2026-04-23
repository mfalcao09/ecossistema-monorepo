/**
 * GET /api/atendimento/widgets/embed?token=<JWT>
 *
 * Endpoint público (sem sessão) para consumo de widgets externos em iframe.
 * Valida JWT HMAC-SHA256 + presença do token_hash na tabela widget_share_tokens
 * (não revogado, não expirado).
 *
 * Retorna dados agregados (snapshots + totals) do widget, sem quaisquer dados
 * pessoais — apenas agregações numéricas já sanitizadas no schema.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenHash, verifyWidgetToken } from "@/lib/atendimento/dashboards";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("token_missing", { status: 400 });

  const payload = verifyWidgetToken(token);
  if (!payload) return new Response("invalid_token", { status: 401 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRow } = await (admin as any)
    .from("widget_share_tokens")
    .select("id, expires_at, revoked_at, widget_id")
    .eq("token_hash", tokenHash(token))
    .maybeSingle();

  if (!tokenRow) return new Response("unknown_token", { status: 401 });
  if (tokenRow.revoked_at) return new Response("revoked", { status: 401 });
  if (new Date(tokenRow.expires_at) < new Date()) {
    return new Response("expired", { status: 401 });
  }
  if (tokenRow.widget_id !== payload.widget_id) {
    return new Response("widget_mismatch", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: widget } = await (admin as any)
    .from("dashboard_widgets")
    .select("id, title, widget_type, metric_key, range_days, is_public")
    .eq("id", payload.widget_id)
    .maybeSingle();

  if (!widget || !widget.is_public) {
    return new Response("widget_unavailable", { status: 403 });
  }

  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(
    today.getTime() - (widget.range_days - 1) * 86400000,
  );
  const from = fromDate.toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snapshots, error } = await (admin as any)
    .from("metrics_snapshots")
    .select("day, " + widget.metric_key)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  // Increment use_count (fire-and-forget)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (admin as any)
    .from("widget_share_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      use_count: ((tokenRow as { use_count?: number }).use_count ?? 0) + 1,
    })
    .eq("id", tokenRow.id)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .then((_: unknown) => {});

  return NextResponse.json({
    ok: true,
    widget: {
      id: widget.id,
      title: widget.title,
      type: widget.widget_type,
      metric_key: widget.metric_key,
    },
    range: { from, to },
    snapshots: snapshots ?? [],
  });
}
