import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminDashboardPreferences } from "@/hooks/useAdminDashboardPreferences";
import { useAdminDashboardData } from "@/hooks/useAdminDashboardData";
import { ADMIN_DASHBOARD_BLOCKS } from "@/lib/adminDashboardCatalog";
import DashboardCustomizeDialog from "@/components/dashboard/DashboardCustomizeDialog";
import { LayoutDashboard, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CURRENCY_KPIS = new Set([
  "receita_propria", "dinheiro_transito", "a_receber", "inadimplencia",
]);

export default function AdminDashboard() {
  const [refDate, setRefDate] = useState(new Date());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { prefs, isLoading: prefsLoading, save, isSaving, reset, isResetting } = useAdminDashboardPreferences();
  const { data: kpiData, isLoading: dataLoading } = useAdminDashboardData(refDate);

  const catalogMap = useMemo(
    () => Object.fromEntries(ADMIN_DASHBOARD_BLOCKS.map((b) => [b.key, b])),
    []
  );

  const visibleBlocks = prefs.blocks.filter((b) => b.visible);
  const monthLabel = format(refDate, "MMMM yyyy", { locale: ptBR });

  const quickLinks = [
    { title: "Permissões de Telas", url: "/usuarios?tab=permissoes" },
    { title: "Log de Atividades", url: "/dados-empresa?tab=atividades" },
    { title: "Equipes", url: "/usuarios?tab=equipes" },
    { title: "Campos Personalizados", url: "/admin/configuracoes?tab=campos" },
    { title: "Automações", url: "/admin/configuracoes?tab=automacoes" },
    { title: "Notificações", url: "/admin/configuracoes?tab=notificacoes" },
    { title: "Políticas Internas", url: "/dados-empresa?tab=politicas" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Administrativo</h1>
            <p className="text-sm text-muted-foreground">Visão gerencial completa da operação.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setCustomizeOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Personalizar
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRefDate((d) => subMonths(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRefDate((d) => addMonths(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRefDate(new Date())} className="text-xs">
          Hoje
        </Button>
      </div>

      {/* KPI Blocks Grid */}
      {prefsLoading || dataLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleBlocks.map((blockPref) => {
            const catalog = catalogMap[blockPref.key];
            if (!catalog) return null;
            const Icon = catalog.icon;
            const visibleKpis = blockPref.kpis.filter((k) => k.visible);
            const hasChart = blockPref.chartEnabled && catalog.chartKpis?.length;

            const chartData = hasChart
              ? catalog.chartKpis!.map((ck) => ({
                  name: ck.label,
                  value: kpiData?.[ck.key] ?? 0,
                  color: ck.color,
                }))
              : [];

            return (
              <Card key={blockPref.key} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: `${catalog.accentColor}15` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: catalog.accentColor }} />
                    </div>
                    <CardTitle className="text-sm font-semibold">{catalog.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* KPIs */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {visibleKpis.map((kp) => {
                      const catalogKpi = catalog.kpis.find((k) => k.key === kp.key);
                      if (!catalogKpi) return null;
                      const val = kpiData?.[kp.key] ?? 0;
                      const isCurrency = CURRENCY_KPIS.has(kp.key);
                      return (
                        <div key={kp.key} className="min-w-0">
                          <p className="text-[11px] text-muted-foreground truncate">{catalogKpi.label}</p>
                          <p className="text-lg font-bold leading-tight">
                            {isCurrency ? fmt(val) : val.toLocaleString("pt-BR")}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart */}
                  {hasChart && chartData.some((d) => d.value > 0) && (
                    <div className="h-36 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        {blockPref.chartType === "pie" ? (
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={55}
                              paddingAngle={2}
                            >
                              {chartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                CURRENCY_KPIS.has(
                                  catalog.chartKpis!.find((ck) => ck.label === name)?.key || ""
                                )
                                  ? fmt(value)
                                  : value,
                                name,
                              ]}
                            />
                          </PieChart>
                        ) : (
                          <BarChart data={chartData}>
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} width={40} />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                CURRENCY_KPIS.has(
                                  catalog.chartKpis!.find((ck) => ck.label === name)?.key || ""
                                )
                                  ? fmt(value)
                                  : value,
                                name,
                              ]}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {chartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ferramentas Administrativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                {link.title}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customize Dialog */}
      <DashboardCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        currentPrefs={prefs}
        onSave={save}
        onReset={reset}
        isSaving={isSaving}
        isResetting={isResetting}
        catalogBlocks={ADMIN_DASHBOARD_BLOCKS}
      />
    </div>
  );
}
