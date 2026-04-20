/**
 * Cron: sync de templates Meta → Supabase.
 * Schedule: */30 * * * *  (a cada 30min) — ver vercel.json.
 *
 * Autenticação: header Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron envia automaticamente quando CRON_SECRET está em env vars)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncInboxTemplates } from "../../atendimento/templates/sync/route";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("atendimento_inboxes")
    .select("id")
    .eq("channel_type", "whatsapp")
    .eq("enabled", true);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const inboxIds = (data ?? []).map((r) => r.id);
  console.log(`[cron/sync-meta-templates] iniciando sync de ${inboxIds.length} inbox(es)`);
  const results = await Promise.all(inboxIds.map(syncInboxTemplates));

  const totals = results.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      upserted: acc.upserted + r.upserted,
      errors: acc.errors + r.errors,
    }),
    { fetched: 0, upserted: 0, errors: 0 },
  );

  return NextResponse.json({
    ok: totals.errors === 0,
    ran_at: new Date().toISOString(),
    inboxes: results,
    totals,
  });
}

// maxDuration em segundos — Meta API pode demorar se tiver muitos templates
export const maxDuration = 60;
