"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Dashboard,
  CatalogWidget,
  DashboardWidgetRow,
} from "@/lib/atendimento/dashboards-client";

interface FetchState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useDashboards(): FetchState<Dashboard[]> & {
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/atendimento/dashboards");
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Falha ao listar");
      setData(j.dashboards ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useWidgets(
  dashboardId: string | null,
): FetchState<DashboardWidgetRow[]> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<DashboardWidgetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!dashboardId) {
      setData([]);
      return;
    }
    try {
      setLoading(true);
      const r = await fetch(
        `/api/atendimento/widgets?dashboard_id=${encodeURIComponent(dashboardId)}`,
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Falha ao listar widgets");
      setData(j.widgets ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useCatalog(): FetchState<CatalogWidget[]> {
  const [data, setData] = useState<CatalogWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const r = await fetch("/api/atendimento/dashboards/catalog");
        const j = await r.json();
        if (aborted) return;
        if (!r.ok) throw new Error(j.erro || "Falha no catálogo");
        setData(j.catalog ?? []);
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
  }, []);

  return { data, loading, error };
}
