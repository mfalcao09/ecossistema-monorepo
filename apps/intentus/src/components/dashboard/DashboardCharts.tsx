import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, Sector,
} from "recharts";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBiDashboard } from "@/hooks/useBiDashboard";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v);

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl text-sm">
      <div className="font-semibold text-foreground mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span style={{ width: 8, height: 8, background: p.fill, borderRadius: 2, display: "inline-block" }} />
          <span>{p.name}:</span>
          <span className="text-foreground font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="hsl(var(--foreground))" style={{ fontSize: 20, fontWeight: 600 }}>
        {payload.value}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" style={{ fontSize: 11 }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill="hsl(var(--primary))" style={{ fontSize: 11, fontWeight: 600 }}>
        {(percent * 100).toFixed(0)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

export function DashboardCharts() {
  const { data, isLoading } = useBiDashboard();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-[3fr_2fr] gap-4">
        <div className="h-72 rounded-xl bg-card border border-border animate-pulse" />
        <div className="h-72 rounded-xl bg-card border border-border animate-pulse" />
      </div>
    );
  }

  const revenueData = data?.revenueChart || [];
  const portfolioData = data?.portfolioChart || [];
  const hasRevenue = revenueData.some(d => d.receitas > 0 || d.despesas > 0);
  const hasPortfolio = portfolioData.length > 0;

  return (
    <div className="grid lg:grid-cols-[3fr_2fr] gap-4">
      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Receitas vs Inadimplência</div>
            <div className="text-xs text-muted-foreground mt-0.5">Últimos 6 meses</div>
          </div>
          <button
            onClick={() => navigate("/financeiro/receitas")}
            className="text-xs text-primary hover:underline"
          >
            Ver detalhes →
          </button>
        </div>
        {hasRevenue ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v)}
                width={56}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: "hsl(var(--border))", opacity: 0.3 }} />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
              />
              <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesas" name="Inadimplência" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado financeiro neste período
          </div>
        )}
      </div>

      {/* Portfolio donut */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Portfólio de Imóveis</div>
            <div className="text-xs text-muted-foreground mt-0.5">Por status</div>
          </div>
          <button
            onClick={() => navigate("/imoveis")}
            className="text-xs text-primary hover:underline"
          >
            Ver imóveis →
          </button>
        </div>
        {hasPortfolio ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={portfolioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  dataKey="value"
                  activeIndex={activeIndex}
                  activeShape={<ActiveShape />}
                  onMouseEnter={(_, i) => setActiveIndex(i)}
                >
                  {portfolioData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              {portfolioData.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between cursor-pointer"
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span style={{ width: 8, height: 8, background: item.color, borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
                    <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground ml-2">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum imóvel cadastrado
          </div>
        )}
      </div>
    </div>
  );
}
