"use client";

import { useCallback, useMemo } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { DashboardWidgetRow } from "@/lib/atendimento/dashboards";
import { WidgetRenderer } from "./WidgetRenderer";

// Cast para contornar mismatch entre @types/react-grid-layout e @types/react 18.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResponsiveGridLayout = WidthProvider(
  Responsive,
) as unknown as React.ComponentType<any>;

interface Props {
  widgets: DashboardWidgetRow[];
  canEdit: boolean;
  cols?: number;
  onLayoutChange: (widgetId: string, layout: Layout) => void;
  onRemoveWidget: (widgetId: string) => void;
}

export function DashboardGrid({
  widgets,
  canEdit,
  cols = 12,
  onLayoutChange,
  onRemoveWidget,
}: Props) {
  const layouts = useMemo(() => {
    const lg: Layout[] = widgets.map((w, idx) => {
      const l = w.layout ?? { w: 4, h: 2 };
      return {
        i: w.id,
        x: typeof l.x === "number" ? l.x : (idx * 4) % cols,
        y: typeof l.y === "number" ? l.y : Math.floor(idx / 3),
        w: l.w,
        h: l.h,
        minW: l.minW ?? 2,
        minH: l.minH ?? 1,
        maxW: l.maxW,
        maxH: l.maxH,
      };
    });
    return { lg, md: lg, sm: lg, xs: lg, xxs: lg };
  }, [widgets, cols]);

  const handleChange = useCallback(
    (current: Layout[]) => {
      if (!canEdit) return;
      for (const l of current) {
        const old = widgets.find((w) => w.id === l.i);
        if (!old) continue;
        const prev = old.layout;
        if (
          prev?.x === l.x &&
          prev?.y === l.y &&
          prev?.w === l.w &&
          prev?.h === l.h
        ) {
          continue;
        }
        onLayoutChange(l.i, l);
      }
    },
    [canEdit, onLayoutChange, widgets],
  );

  if (widgets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm text-slate-500">
          Nenhum widget neste dashboard ainda.
        </p>
        {canEdit && (
          <p className="text-xs text-slate-400 mt-1">
            Clique em <strong>Adicionar widget</strong> para começar.
          </p>
        )}
      </div>
    );
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: cols, md: cols, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={80}
      margin={[12, 12]}
      isDraggable={canEdit}
      isResizable={canEdit}
      draggableHandle=".widget-drag-handle"
      onLayoutChange={handleChange}
      compactType="vertical"
    >
      {widgets.map((w) => (
        <div key={w.id} className="widget-cell">
          <WidgetRenderer
            widget={w}
            canEdit={canEdit}
            onRemove={() => onRemoveWidget(w.id)}
          />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
