/**
 * ChannelROIAnalysis — Dashboard de ROI por canal de captação.
 * Rota: /comercial/roi-canais
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useChannelROI,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
} from "@/hooks/useChannelROI";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowLeft, TrendingUp, Users, DollarSign, Target,
  AlertTriangle, Loader2, CheckCircle2, Clock,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ChannelROIAnalysis() {
  const navigate = useNavigate();
  const { dashboard, isLoading, isError } = useChannelROI();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/leads")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            ROI por Canal de Captação
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            Performance de cada canal de captação — volume, conversão e receita
          </p>
        </div>
      </div>

      {isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">Erro ao carregar dados de ROI</span>
          </CardContent>
        </Card>
      )}

      {dashboard && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Total de Leads" value={dashboard.totals.totalLeads} icon={Users} />
            <KPI label="Convertidos" value={dashboard.totals.convertedLeads} icon={CheckCircle2} color="text-green-600" />
            <KPI label="Taxa Conversão" value={`${dashboard.totals.avgConversionRate}%`} icon={Target} color="text-primary" />
            <KPI label="Receita Total" value={fmtBRL(dashboard.totals.totalRevenue)} icon={DollarSign} color="text-green-600" />
          </div>

          {/* Best/Worst channels */}
          {(dashboard.totals.bestChannel || dashboard.totals.worstChannel) && (
            <div className="flex gap-3">
              {dashboard.totals.bestChannel && (
                <Card className="flex-1 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                  <CardContent className="p-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Melhor canal: <strong>{CHANNEL_LABELS[dashboard.totals.bestChannel] || dashboard.totals.bestChannel}</strong></span>
                  </CardContent>
                </Card>
              )}
              {dashboard.totals.worstChannel && (
                <Card className="flex-1 border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
                  <CardContent className="p-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">Menor conversão: <strong>{CHANNEL_LABELS[dashboard.totals.worstChannel] || dashboard.totals.worstChannel}</strong></span>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Revenue by channel chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Receita Gerada por Canal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dashboard.channels.filter((c) => c.revenueWon > 0)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis
                    type="category"
                    dataKey="channel"
                    tick={{ fontSize: 11 }}
                    width={110}
                    tickFormatter={(v) => CHANNEL_LABELS[v] || v}
                  />
                  <Tooltip
                    formatter={(v: number) => fmtBRL(v)}
                    labelFormatter={(v) => CHANNEL_LABELS[v as string] || v}
                  />
                  <Bar dataKey="revenueWon" name="Receita" radius={[0, 4, 4, 0]}>
                    {dashboard.channels.filter((c) => c.revenueWon > 0).map((c) => (
                      <Cell key={c.channel} fill={CHANNEL_COLORS[c.channel] || "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Channel detail cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dashboard.channels.map((ch) => (
              <Card key={ch.channel} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CHANNEL_COLORS[ch.channel] || "#6b7280" }}
                    />
                    <span className="font-medium text-sm">{CHANNEL_LABELS[ch.channel] || ch.channel}</span>
                    <span className="flex-1" />
                    <Badge variant="outline" className="text-[10px]">{ch.totalLeads} leads</Badge>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Conversão</span>
                      <p className={`font-semibold ${ch.conversionRate >= 30 ? "text-green-600" : ch.conversionRate >= 15 ? "text-amber-600" : "text-red-600"}`}>
                        {ch.conversionRate}%
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Receita</span>
                      <p className="font-semibold">{fmtBRL(ch.revenueWon)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ciclo médio</span>
                      <p className="font-semibold">{ch.avgDaysToConvert > 0 ? `${ch.avgDaysToConvert}d` : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ticket médio</span>
                      <p className="font-semibold">{ch.avgDealValue > 0 ? fmtBRL(ch.avgDealValue) : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Últimos 30d</span>
                      <p className="font-semibold">{ch.last30d}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Últimos 7d</span>
                      <p className="font-semibold">{ch.last7d}</p>
                    </div>
                  </div>

                  {/* Conversion bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${ch.conversionRate}%`,
                          backgroundColor: CHANNEL_COLORS[ch.channel] || "#6b7280",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>{ch.convertedLeads} convertidos</span>
                      <span>{ch.lostLeads} perdidos</span>
                      <span>{ch.activeLeads} ativos</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Conversion rate comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Taxa de Conversão por Canal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard.channels.filter((c) => c.totalLeads >= 2)}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="channel"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => CHANNEL_LABELS[v]?.slice(0, 12) || v}
                  />
                  <YAxis tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    formatter={(v: number) => `${v}%`}
                    labelFormatter={(v) => CHANNEL_LABELS[v as string] || v}
                  />
                  <Bar dataKey="conversionRate" name="Conversão %" radius={[4, 4, 0, 0]}>
                    {dashboard.channels.filter((c) => c.totalLeads >= 2).map((c) => (
                      <Cell
                        key={c.channel}
                        fill={c.conversionRate >= 30 ? "#22c55e" : c.conversionRate >= 15 ? "#f59e0b" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
