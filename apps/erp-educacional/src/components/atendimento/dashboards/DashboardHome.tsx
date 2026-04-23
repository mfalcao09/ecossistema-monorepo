"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Plus, Settings as SettingsIcon } from "lucide-react";
import type { Layout } from "react-grid-layout";
import type {
  CatalogWidget,
  Dashboard,
  WidgetLayout,
} from "@/lib/atendimento/dashboards";
import { useCan } from "@/hooks/atendimento/use-can";
import {
  useCatalog,
  useDashboards,
  useWidgets,
} from "@/hooks/atendimento/use-dashboards";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSwitcher } from "./DashboardSwitcher";
import { DashboardGrid } from "./DashboardGrid";
import { WidgetCatalogDrawer } from "./WidgetCatalogDrawer";

const STORAGE_KEY = "atendimento:lastDashboardId";

export function DashboardHome() {
  const dashboardsState = useDashboards();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const canViewRaw = useCan("dashboard", "view");
  const canWrite = useCan("dashboard", "edit") ?? false;
  const canViewLoading = canViewRaw === null;
  const canView = canViewRaw !== false; // null (loading) ou true → mostra

  const current = useMemo(
    () =>
      dashboardsState.data.find((d) => d.id === currentId) ??
      dashboardsState.data.find((d) => d.is_default) ??
      dashboardsState.data[0] ??
      null,
    [dashboardsState.data, currentId],
  );

  // pega userId (pra comparar ownership no switcher)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // persiste última dashboard aberta
  useEffect(() => {
    if (currentId) {
      try {
        localStorage.setItem(STORAGE_KEY, currentId);
      } catch {
        /* noop */
      }
    }
  }, [currentId]);

  useEffect(() => {
    if (currentId || dashboardsState.data.length === 0) return;
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const hit = stored
      ? dashboardsState.data.find((d) => d.id === stored)
      : null;
    setCurrentId(hit?.id ?? current?.id ?? null);
  }, [dashboardsState.data, currentId, current]);

  const widgetsState = useWidgets(current?.id ?? null);
  const catalogState = useCatalog();

  // ── CRUD dashboards ────────────────────────────────────────────────────────
  const handleCreate = useCallback(
    async (name: string) => {
      const r = await fetch("/api/atendimento/dashboards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (r.ok && j.dashboard) {
        await dashboardsState.refetch();
        setCurrentId(j.dashboard.id);
      }
    },
    [dashboardsState],
  );

  const handleRename = useCallback(
    async (d: Dashboard, name: string) => {
      await fetch(`/api/atendimento/dashboards/${d.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await dashboardsState.refetch();
    },
    [dashboardsState],
  );

  const handleDelete = useCallback(
    async (d: Dashboard) => {
      await fetch(`/api/atendimento/dashboards/${d.id}`, { method: "DELETE" });
      await dashboardsState.refetch();
      if (currentId === d.id) setCurrentId(null);
    },
    [currentId, dashboardsState],
  );

  const handleTogglePin = useCallback(
    async (d: Dashboard) => {
      await fetch(`/api/atendimento/dashboards/${d.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pinned_order: d.pinned_order > 0 ? 0 : 1,
        }),
      });
      await dashboardsState.refetch();
    },
    [dashboardsState],
  );

  // ── CRUD widgets ───────────────────────────────────────────────────────────
  const canEditCurrent = !!(
    current &&
    canWrite &&
    current.owner_user_id === userId
  );

  const handleLayoutChange = useCallback(
    async (widgetId: string, layout: Layout) => {
      const payload: WidgetLayout = {
        x: layout.x,
        y: layout.y,
        w: layout.w,
        h: layout.h,
      };
      await fetch(
        `/api/atendimento/widgets?id=${encodeURIComponent(widgetId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ layout: payload }),
        },
      );
      // não refetch; estado visual já está correto pelo RGL
    },
    [],
  );

  const handleAddWidget = useCallback(
    async (w: CatalogWidget) => {
      if (!current) return;
      await fetch("/api/atendimento/widgets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dashboard_id: current.id,
          catalog_slug: w.slug,
        }),
      });
      await widgetsState.refetch();
      setCatalogOpen(false);
    },
    [current, widgetsState],
  );

  const handleRemoveWidget = useCallback(
    async (widgetId: string) => {
      await fetch(
        `/api/atendimento/widgets?id=${encodeURIComponent(widgetId)}`,
        { method: "DELETE" },
      );
      await widgetsState.refetch();
    },
    [widgetsState],
  );

  if (canViewLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-400 text-center">
        Carregando dashboard…
      </div>
    );
  }
  if (!canView) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Você não tem permissão para ver dashboards de Atendimento.
      </div>
    );
  }

  const error = dashboardsState.error ?? widgetsState.error;

  return (
    <div className="space-y-5">
      <DashboardHeader />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DashboardSwitcher
          current={current}
          dashboards={dashboardsState.data}
          currentUserId={userId}
          canWrite={canWrite}
          onSelect={(d) => setCurrentId(d.id)}
          onCreate={handleCreate}
          onRename={handleRename}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
        />
        <div className="flex items-center gap-2">
          {canEditCurrent && (
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <Plus size={12} /> Adicionar widget
            </button>
          )}
          <Link
            href="/atendimento/relatorios"
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            Relatórios
          </Link>
          <Link
            href="/atendimento/configuracoes/widgets"
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 inline-flex items-center gap-1"
          >
            <SettingsIcon size={12} /> Widgets
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {current && (
        <DashboardGrid
          widgets={widgetsState.data}
          canEdit={canEditCurrent}
          cols={current.layout_cols}
          onLayoutChange={handleLayoutChange}
          onRemoveWidget={handleRemoveWidget}
        />
      )}

      <WidgetCatalogDrawer
        open={catalogOpen}
        catalog={catalogState.data}
        loading={catalogState.loading}
        onClose={() => setCatalogOpen(false)}
        onAdd={handleAddWidget}
      />
    </div>
  );
}
