/**
 * Cron: agrega métricas diárias para dashboards/relatórios (S7).
 * Schedule: 10 0 * * *   (todo dia às 00:10 UTC — dia anterior completo)
 *
 * Estratégia:
 *   1. Computa métricas do dia anterior (D-1) via RPC compute_daily_metrics.
 *   2. Se ?backfill=N, também recalcula os últimos N dias (default 0, limite 90).
 *   3. É idempotente — RPC faz UPSERT em metrics_snapshots por (account_id, day).
 *
 * Auth: header Authorization: Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BACKFILL = 90;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function isoDayUTC(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const requestedBackfill = Number(url.searchParams.get("backfill") ?? "0");
  const backfill = Math.min(
    Math.max(Number.isFinite(requestedBackfill) ? requestedBackfill : 0, 0),
    MAX_BACKFILL,
  );

  const admin = createAdminClient();
  const ranAt = new Date().toISOString();

  // Dias a computar: D-1, D-2, …, D-(backfill+1)
  const days: string[] = [];
  for (let i = 1; i <= backfill + 1; i++) days.push(isoDayUTC(i));

  const results: Array<{ day: string; ok: boolean; error?: string }> = [];
  for (const day of days) {
    const { error } = await admin.rpc("compute_daily_metrics", { target_day: day });
    if (error) {
      results.push({ day, ok: false, error: error.message });
    } else {
      results.push({ day, ok: true });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - okCount;

  return NextResponse.json({
    ok: failedCount === 0,
    ran_at: ranAt,
    days_processed: days.length,
    succeeded: okCount,
    failed: failedCount,
    results,
  });
}

export const maxDuration = 60;
