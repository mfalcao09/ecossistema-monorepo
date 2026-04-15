import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ContractKPIs } from "@/hooks/useContractKPIs";

interface ContractPipelineChartProps {
  kpis: ContractKPIs | undefined;
  isLoading: boolean;
}

// Ordem lógica do pipeline (state machine do CLM)
const STATUS_CONFIG: {
  key: string;
  label: string;
  color: string;
}[] = [
  { key: "rascunho", label: "Rascunho", color: "#94a3b8" },
  { key: "em_revisao", label: "Em Revisão", color: "#60a5fa" },
  { key: "em_aprovacao", label: "Em Aprovação", color: "#f59e0b" },
  { key: "aguardando_assinatura", label: "Aguard. Assinatura", color: "#a78bfa" },
  { key: "ativo", label: "Ativo", color: "#22c55e" },
  { key: "renovado", label: "Renovado", color: "#06b6d4" },
  { key: "encerrado", label: "Encerrado", color: "#6b7280" },
  { key: "cancelado", label: "Cancelado", color: "#ef4444" },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { label: string; count: number; color: string };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm">{data.label}</p>
      <p className="text-2xl font-bold" style={{ color: data.color }}>
        {data.count}
      </p>
      <p className="text-xs text-muted-foreground">contratos</p>
    </div>
  );
}

export default function ContractPipelineChart({
  kpis,
  isLoading,
}: ContractPipelineChartProps) {
  // Montar dados do gráfico a partir de byStatus
  const chartData = STATUS_CONFIG.map((config) => ({
    key: config.key,
    label: config.label,
    count: kpis?.byStatus?.[config.key] ?? 0,
    color: config.color,
  }));

  const totalContracts = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Pipeline de Contratos
          </CardTitle>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {totalContracts} contratos no total
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : totalContracts === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum contrato encontrado com os filtros atuais
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legenda compacta abaixo do gráfico */}
        {!isLoading && totalContracts > 0 && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-4 gap-y-1">
            {chartData
              .filter((d) => d.count > 0)
              .map((d) => (
                <div key={d.key} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {d.label}: <span className="font-medium text-foreground">{d.count}</span>
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
