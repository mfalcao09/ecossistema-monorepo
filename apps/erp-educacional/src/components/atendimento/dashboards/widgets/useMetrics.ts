"use client";

import { useEffect, useState } from "react";

export interface Snapshot {
  day: string;
  [k: string]: string | number | Record<string, number> | null;
}

export interface MetricsPayload {
  ok: boolean;
  range: { from: string; to: string; days: number };
  snapshots: Snapshot[];
  totals: Record<string, number | Record<string, number> | null | undefined>;
}

export function useMetrics(rangeDays: number) {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const today = new Date();
        const from = new Date(today.getTime() - (rangeDays - 1) * 86400000);
        const qs = new URLSearchParams({
          from: from.toISOString().slice(0, 10),
          to: today.toISOString().slice(0, 10),
        });
        const r = await fetch(`/api/atendimento/metrics?${qs.toString()}`);
        const j = (await r.json()) as MetricsPayload;
        if (aborted) return;
        if (!j.ok) throw new Error("metrics failed");
        setData(j);
        setError(null);
      } catch (e) {
        if (aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [rangeDays]);

  return { data, loading, error };
}
