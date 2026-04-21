"use client";

import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = "text-emerald-600",
  bg = "bg-emerald-50",
  delta,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  color?: string;
  bg?: string;
  delta?: number; // percentage vs previous period
}) {
  const DeltaIcon =
    delta === undefined
      ? null
      : delta > 0
        ? TrendingUp
        : delta < 0
          ? TrendingDown
          : Minus;
  const deltaColor =
    delta === undefined
      ? ""
      : delta > 0
        ? "text-emerald-600"
        : delta < 0
          ? "text-red-600"
          : "text-slate-400";

  return (
    <div className={`rounded-xl ${bg} p-4 border border-transparent`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <div className={`w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center ${color}`}>
            <Icon size={16} />
          </div>
        ) : null}
      </div>
      {DeltaIcon ? (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${deltaColor}`}>
          <DeltaIcon size={12} />
          <span>{Math.abs(delta ?? 0).toFixed(1)}%</span>
          <span className="text-slate-400 font-normal">vs. período anterior</span>
        </div>
      ) : null}
    </div>
  );
}
