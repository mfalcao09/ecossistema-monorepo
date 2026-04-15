import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BarChart3, AlertTriangle, Trophy } from "lucide-react";
import { useDevelopments } from "@/hooks/useDevelopments";
import { useDevelopmentDashboard } from "@/hooks/useDevelopmentDashboard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const COLORS = ["hsl(160, 84%, 39%)", "hsl(45, 93%, 47%)", "hsl(25, 95%, 53%)", "hsl(0, 84%, 60%)", "hsl(0, 0%, 64%)"];

export default function DevDashboard() {
  const { data: developments = [] } = useDevelopments();
  const [selectedDev, setSelectedDev] = useState<string>("");
  const devId = selectedDev || developments[0]?.id || "";
  const { data: dashboard, isLoading } = useDevelopmentDashboard(devId || undefined);

  const pieData = dashboard ? [
    { name: "Disponível", value: dashboard.availableUnits },
    { name: "Vendida", value: dashboard.soldUnitsCount },
    { name: "Outras", value: dashboard.totalUnits - dashboard.availableUnits - dashboard.soldUnitsCount },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Dashboard Comercial</h1>
          <p className="text-muted-foreground text-sm">KPIs de vendas, VGV, conversão e métricas</p>
        </div>
        <Select value={devId} onValueChange={setSelectedDev}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecionar empreendimento" /></SelectTrigger>
          <SelectContent>{developments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!devId ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Selecione um empreendimento.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : dashboard ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">VGV Total</p>
                <p className="text-xl font-bold">{fmt(dashboard.totalVGV)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">VGV Vendido</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(dashboard.soldVGV)}</p>
                {dashboard.totalVGV > 0 && <Progress value={dashboard.pctVGV} className="h-1.5 mt-2" />}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                <p className="text-xl font-bold">{dashboard.conversionRate}%</p>
                <p className="text-[10px] text-muted-foreground">{dashboard.approvedProposals}/{dashboard.totalProposals} propostas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-xl font-bold">{dashboard.avgTicket > 0 ? fmt(dashboard.avgTicket) : "—"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard.staleUnitsCount > 0 && (
              <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="py-3 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{dashboard.staleUnitsCount} unidade(s) encalhada(s)</p>
                    <p className="text-[10px] text-muted-foreground">Disponíveis há mais de 90 dias</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {dashboard.overdueTasks > 0 && (
              <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
                <CardContent className="py-3 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{dashboard.overdueTasks} tarefa(s) vencida(s)</p>
                    <p className="text-[10px] text-muted-foreground">Follow-ups atrasados</p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Contratos Ativos</p>
                <p className="text-xl font-bold">{dashboard.activeContracts} <span className="text-sm font-normal text-muted-foreground">/ {dashboard.totalContracts}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="py-4">
                <p className="text-sm font-medium mb-3">Distribuição de Unidades</p>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-sm font-medium mb-3">Propostas por Mês</p>
                {dashboard.proposalsByMonth.some(m => m.count > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboard.proposalsByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Propostas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Broker ranking */}
          {dashboard.brokerRanking.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-medium">Ranking de Corretores</p>
                </div>
                <div className="space-y-2">
                  {dashboard.brokerRanking.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <span>{b.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{fmt(b.volume)}</span>
                        <span className="text-muted-foreground text-xs ml-2">({b.count} venda{b.count !== 1 ? "s" : ""})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Units summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total", value: dashboard.totalUnits, color: "text-foreground" },
              { label: "Disponíveis", value: dashboard.availableUnits, color: "text-emerald-600" },
              { label: "Vendidas", value: dashboard.soldUnitsCount, color: "text-red-600" },
              { label: "Encalhadas", value: dashboard.staleUnitsCount, color: "text-amber-600" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="py-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
