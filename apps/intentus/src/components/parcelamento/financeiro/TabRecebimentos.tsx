/**
 * Aba 2 — Recebimentos
 *
 * 📚 CONCEITO PEDAGÓGICO
 * Recebimentos é a "régua de vendas" do empreendimento. Mostra quando e quanto
 * dinheiro vai entrar no caixa ao longo do tempo, separando:
 *   • Entrada / Sinal (na assinatura do contrato)
 *   • Parcelas mensais durante a obra
 *   • Balão final (na entrega das chaves ou escrituração)
 *   • Repasse bancário (quando o comprador financia com o banco)
 *
 * VGV = Valor Geral de Vendas — soma de todos os lotes × preço unitário.
 * É o "teto" de receita possível se 100% das unidades forem vendidas.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ParcelamentoFinancial } from "@/lib/parcelamento/types";
import { useParcelamentoCashFlowRows } from "@/hooks/useSimularFinanceiro";
import { DollarSign, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
}

function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000)
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function formatChartValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${value.toFixed(0)}`;
}

function formatPct(value?: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">Mês {label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">R$ {formatChartValue(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function TabRecebimentos({ financial }: Props) {
  const { data: chartData, isLoading: loadingRows } = useParcelamentoCashFlowRows(
    financial?.id
  );

  const hasData = financial != null;
  const hasRows = chartData && chartData.length > 0;

  const vgv = financial?.vgv_total;
  const custoTotal =
    (financial?.custo_obra_total ?? 0) +
    (financial?.custo_terreno ?? 0) +
    (financial?.custo_legalizacao ?? 0) +
    (financial?.custo_marketing ?? 0) +
    (financial?.custo_comissoes ?? 0);

  const margemBruta =
    vgv != null && custoTotal > 0
      ? ((vgv - custoTotal) / vgv) * 100
      : null;

  // Build receivables curve from cash flow rows
  const recebimentosData = hasRows
    ? (() => {
        let acumulado = 0;
        return chartData.map((r) => {
          acumulado += r.entradas;
          return {
            mes: r.mes,
            entradas_mes: r.entradas,
            entradas_acumuladas: acumulado,
            pct_vgv: vgv && vgv > 0 ? (acumulado / vgv) * 100 : 0,
          };
        });
      })()
    : [];

  // Mês em que atinge 50% do VGV
  const mes50pct = recebimentosData.find((r) => r.pct_vgv >= 50)?.mes ?? null;
  // Mês em que atinge 90% do VGV
  const mes90pct = recebimentosData.find((r) => r.pct_vgv >= 90)?.mes ?? null;
  // Total efetivamente recebido
  const totalRecebido = hasRows ? recebimentosData[recebimentosData.length - 1]?.entradas_acumuladas : null;

  const displayData =
    recebimentosData.length > 36
      ? recebimentosData.filter((_, i) => i % 3 === 0)
      : recebimentosData;

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>O que são Recebimentos?</strong> É o cronograma de entradas de
          caixa ao longo do projeto — sinal na venda, parcelas mensais, balão
          na entrega e repasse bancário. O <em>VGV</em> (Valor Geral de Vendas)
          é o potencial máximo de receita se 100% das unidades forem vendidas ao
          preço-tabela.
        </AlertDescription>
      </Alert>

      {/* KPIs resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">VGV Total</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrency(vgv)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Recebido</p>
          <p className="text-lg font-semibold text-emerald-600">
            {formatCurrency(totalRecebido)}
          </p>
          {vgv && totalRecebido ? (
            <p className="text-xs text-gray-400 mt-0.5">
              {((totalRecebido / vgv) * 100).toFixed(1)}% do VGV
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Margem Bruta</p>
          <p
            className={`text-lg font-semibold ${
              margemBruta == null
                ? "text-gray-900"
                : margemBruta >= 20
                ? "text-emerald-600"
                : margemBruta >= 10
                ? "text-yellow-600"
                : "text-red-500"
            }`}
          >
            {formatPct(margemBruta)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">50% do VGV em</p>
          <p className="text-lg font-semibold text-gray-900">
            {mes50pct != null ? `Mês ${mes50pct}` : "—"}
          </p>
          {mes90pct != null && (
            <p className="text-xs text-gray-400 mt-0.5">
              90% no Mês {mes90pct}
            </p>
          )}
        </div>
      </div>

      {/* Gráfico de curva de recebimentos */}
      {loadingRows ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : hasRows ? (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Curva de Recebimentos — Mensal × Acumulado
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRecAcum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `M${v}`}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => formatChartValue(v)}
                width={52}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                domain={[0, 110]}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="entradas_acumuladas"
                name="Recebimentos Acumulados"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorRecAcum)"
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="entradas_mes"
                name="Entradas do Mês"
                stroke="#6366f1"
                strokeWidth={1.5}
                fill="#6366f1"
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
          {chartData.length > 36 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              * Agrupado a cada 3 meses ({chartData.length} meses no total)
            </p>
          )}
        </div>
      ) : hasData ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <DollarSign className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500 font-medium">Carregando linhas do fluxo…</p>
        </div>
      ) : null}

      {/* Breakdown de custos */}
      {hasData && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Composição de Custos
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {[
                { label: "Custo de Obra", value: financial?.custo_obra_total },
                { label: "Custo do Terreno", value: financial?.custo_terreno },
                { label: "Legalização / Aprovação", value: financial?.custo_legalizacao },
                { label: "Marketing / Vendas", value: financial?.custo_marketing },
                { label: "Comissões Comerciais", value: financial?.custo_comissoes },
              ].map(({ label, value }) => (
                <tr key={label} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{label}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {formatCurrency(value)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {vgv && value ? `${((value / vgv) * 100).toFixed(1)}% do VGV` : ""}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-800">Total de Custos</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {custoTotal > 0 ? formatCurrency(custoTotal) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">
                  {vgv && custoTotal > 0 ? `${((custoTotal / vgv) * 100).toFixed(1)}% do VGV` : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!hasData && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-16 gap-3">
          <DollarSign className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">
            Sem premissas financeiras cadastradas
          </p>
          <p className="text-xs text-gray-300">
            Simule um cenário financeiro para ver o cronograma de recebimentos
          </p>
        </div>
      )}
    </div>
  );
}
