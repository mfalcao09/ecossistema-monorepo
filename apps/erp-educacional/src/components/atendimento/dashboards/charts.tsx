"use client";

/**
 * Charts minimalistas em SVG puro — evita adicionar recharts/tremor como
 * dependência extra. Suficiente para os widgets S7 (line, bar, pie).
 *
 * Design: neutro, responsivo, pt-BR friendly.
 */

import { useMemo } from "react";

export interface SeriesPoint {
  label: string;
  value: number;
}

const PALETTE = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

// ─────────────────────────────────────────────────────────────────────────────
// LineChart
// ─────────────────────────────────────────────────────────────────────────────
export function LineChart({
  data,
  height = 180,
  color = "#10b981",
  showArea = true,
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  showArea?: boolean;
}) {
  const width = 600;
  const padding = { top: 10, right: 10, bottom: 22, left: 36 };
  const { path, areaPath, yTicks, xTicks, maxV } = useMemo(() => {
    if (data.length === 0) {
      return { path: "", areaPath: "", yTicks: [] as number[], xTicks: [] as Array<{ x: number; label: string }>, maxV: 0 };
    }
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const max = Math.max(...data.map((d) => d.value), 1);
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => {
      const x = padding.left + i * step;
      const y = padding.top + innerH - (d.value / max) * innerH;
      return { x, y };
    });
    const p = pts.map((pt, i) => (i === 0 ? `M${pt.x},${pt.y}` : `L${pt.x},${pt.y}`)).join(" ");
    const firstX = pts[0]?.x ?? 0;
    const lastX = pts[pts.length - 1]?.x ?? 0;
    const a = `${p} L${lastX},${padding.top + innerH} L${firstX},${padding.top + innerH} Z`;
    const ticks = [0, 0.5, 1].map((t) => Math.round(t * max));
    // Mostra labels do X somente em alguns pontos
    const stride = Math.max(1, Math.floor(data.length / 6));
    const xT = data
      .map((d, i) => ({ x: padding.left + i * step, label: d.label, show: i % stride === 0 || i === data.length - 1 }))
      .filter((p) => p.show);
    return { path: p, areaPath: a, yTicks: ticks, xTicks: xT, maxV: max };
  }, [data, height]);

  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      {/* grid Y */}
      {yTicks.map((t, i) => {
        const y = padding.top + (height - padding.top - padding.bottom) * (1 - t / (maxV || 1));
        return (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">
              {t}
            </text>
          </g>
        );
      })}
      {showArea && <path d={areaPath} fill={color} fillOpacity={0.15} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={height - 6} textAnchor="middle" fontSize={9} fill="#64748b">
          {t.label}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BarChart
// ─────────────────────────────────────────────────────────────────────────────
export function BarChart({
  data,
  height = 180,
  color = "#3b82f6",
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
}) {
  const width = 600;
  const padding = { top: 10, right: 10, bottom: 26, left: 36 };
  if (data.length === 0) return <EmptyChart height={height} />;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = 6;
  const barW = Math.max(2, innerW / data.length - gap);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={padding.top + innerH}
        y2={padding.top + innerH}
        stroke="#e2e8f0"
      />
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = padding.left + i * (barW + gap);
        const y = padding.top + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={color} />
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize={9} fill="#64748b">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PieChart
// ─────────────────────────────────────────────────────────────────────────────
export function PieChart({
  data,
  size = 180,
}: {
  data: SeriesPoint[];
  size?: number;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total === 0) return <EmptyChart height={size} />;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  let acc = 0;

  const slices = data.map((d, i) => {
    const startAngle = (acc / total) * 2 * Math.PI;
    acc += d.value;
    const endAngle = (acc / total) * 2 * Math.PI;
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
    const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
    const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
    const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
    return { path, color: PALETTE[i % PALETTE.length], label: d.label, value: d.value };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1} />
        ))}
      </svg>
      <ul className="text-xs text-slate-700 space-y-1">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="font-medium">{s.label}</span>
            <span className="text-slate-500">
              ({s.value} · {((s.value / total) * 100).toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FunnelChart
// ─────────────────────────────────────────────────────────────────────────────
export function FunnelChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  if (data.length === 0) return <EmptyChart height={180} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const w = (d.value / max) * 100;
        return (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-xs text-slate-700">
              <span className="font-medium capitalize">{d.label.replace(/_/g, " ")}</span>
              <span className="tabular-nums">{d.value}</span>
            </div>
            <div className="h-6 bg-slate-100 rounded">
              <div
                className="h-6 rounded"
                style={{
                  width: `${w}%`,
                  background: PALETTE[i % PALETTE.length],
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="w-full flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded"
      style={{ height }}
    >
      Sem dados no período
    </div>
  );
}
