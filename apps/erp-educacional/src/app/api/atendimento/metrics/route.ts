/**
 * GET /api/atendimento/metrics
 *
 * Retorna snapshots diários e (opcionalmente) totais agregados para um range.
 *
 * Query params:
 *   from         = YYYY-MM-DD (default: hoje - 30d)
 *   to           = YYYY-MM-DD (default: hoje)
 *   metrics      = csv de MetricKey (default: todas)
 *   include_live = "1" para recomputar o dia de hoje antes de responder
 *
 * Response:
 *   {
 *     range: { from, to, days },
 *     snapshots: MetricsSnapshot[],
 *     totals: { [metric]: number | object }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dashboardsEnabled,
  isMetricKey,
  normalizeRange,
  METRIC_KEYS,
  type MetricKey,
} from "@/lib/atendimento/dashboards";

type NumericMetric = Exclude<MetricKey, "leads_by_source" | "volume_by_inbox">;

function isNumericMetric(m: MetricKey): m is NumericMetric {
  return m !== "leads_by_source" && m !== "volume_by_inbox";
}

export const GET = protegerRota(async (request: NextRequest) => {
  if (!dashboardsEnabled()) {
    return NextResponse.json(
      { ok: false, error: "ATENDIMENTO_DASHBOARDS_ENABLED off" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const { from, to, days } = normalizeRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
    30,
  );

  const metricsParam = url.searchParams.get("metrics");
  const metrics: MetricKey[] = metricsParam
    ? metricsParam.split(",").map((m) => m.trim()).filter(isMetricKey)
    : [...METRIC_KEYS];

  const admin = createAdminClient();

  if (url.searchParams.get("include_live") === "1") {
    const today = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).rpc("compute_daily_metrics", { target_day: today });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("metrics_snapshots")
    .select("*")
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const snapshots = (data ?? []) as Array<Record<string, unknown>>;

  // Totais
  const totals: Record<string, number | Record<string, number>> = {};
  for (const m of metrics) {
    if (isNumericMetric(m)) {
      let sum = 0;
      let seen = 0;
      for (const row of snapshots) {
        const v = row[m];
        if (typeof v === "number") {
          sum += v;
          seen += 1;
        }
      }
      if (m.startsWith("avg_") || m.startsWith("p50_") || m.startsWith("p90_")) {
        totals[m] = seen > 0 ? Math.round(sum / seen) : 0;
      } else {
        totals[m] = sum;
      }
    } else {
      // JSONB agregado (leads_by_source, volume_by_inbox)
      const agg: Record<string, number> = {};
      for (const row of snapshots) {
        const obj = row[m] as Record<string, number> | null;
        if (obj && typeof obj === "object") {
          for (const [k, v] of Object.entries(obj)) {
            agg[k] = (agg[k] ?? 0) + (typeof v === "number" ? v : 0);
          }
        }
      }
      totals[m] = agg;
    }
  }

  return NextResponse.json({
    ok: true,
    range: { from, to, days },
    snapshots,
    totals,
  });
});
