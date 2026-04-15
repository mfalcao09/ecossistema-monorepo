/**
 * TypeDistributionChart — Gráfico de pizza com distribuição por tipo de contrato
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { TYPE_COLORS, TYPE_LABELS } from "./constants";

interface TypeDistributionChartProps {
  /** Record de tipo → contagem (ex: { venda: 5, locacao: 12 }) */
  byType: Record<string, number> | undefined;
  isLoading: boolean;
}

export function TypeDistributionChart({ byType, isLoading }: TypeDistributionChartProps) {
  const chartData = byType
    ? Object.entries(byType)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => ({
          name: TYPE_LABELS[type] || type,
          value: count,
          color: TYPE_COLORS[type] || "#94a3b8",
        }))
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          Distribuição por Tipo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[232px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">
              Carregando...
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[232px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum contrato encontrado
          </div>
        ) : (
          <div className="h-[232px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    `${value} contrato${value !== 1 ? "s" : ""}`,
                    "",
                  ]}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: "10px" }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
