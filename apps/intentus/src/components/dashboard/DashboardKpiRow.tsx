import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useBiDashboard, type KpiCard } from "@/hooks/useBiDashboard";

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 56;
  const h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

function KpiCardItem({ kpi }: { kpi: KpiCard }) {
  const navigate = useNavigate();

  return (
    <div
      className={`relative flex flex-col justify-between bg-card border border-border rounded-xl p-5 overflow-hidden transition-all duration-150 ${kpi.route ? "cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5" : ""}`}
      onClick={() => kpi.route && navigate(kpi.route)}
    >
      {/* Subtle glow on hover via pseudo */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {kpi.label}
            </div>
            <div
              className="text-2xl font-semibold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {kpi.value}
            </div>
          </div>
          <span className="text-xl mt-0.5" role="img">{kpi.icon}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5">
            {kpi.change.startsWith("+") || kpi.change.startsWith("-") ? (
              kpi.changePositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )
            ) : (
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={`text-xs font-medium ${kpi.changePositive ? "text-emerald-400" : "text-red-400"}`}>
              {kpi.change}
            </span>
          </div>
          {kpi.sparkline && kpi.sparkline.length > 1 && (
            <Sparkline data={kpi.sparkline} />
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardKpiRow() {
  const { data, isLoading } = useBiDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.kpis?.length) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {data.kpis.map((kpi, i) => (
        <KpiCardItem key={i} kpi={kpi} />
      ))}
    </div>
  );
}
