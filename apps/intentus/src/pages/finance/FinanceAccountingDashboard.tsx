import { useMemo } from "react";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, BookOpen, BookText, FileCheck, Scale, FileOutput, Lock, SplitSquareHorizontal, FileUp, GitCompareArrows, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(210,60%,50%)", "hsl(40,80%,50%)", "hsl(280,60%,50%)"];

export default function FinanceAccountingDashboard() {
  const navigate = useNavigate();
  const { entries } = useJournalEntries({});
  const { accounts } = useChartOfAccounts();

  const { data: periods = [] } = useQuery({
    queryKey: ["accounting_periods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounting_periods" as any).select("*").order("period_start");
      if (error) throw error;
      return data as any[];
    },
  });

  const confirmedEntries = entries.filter(e => e.status === "confirmado");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEntries = confirmedEntries.filter(e => e.entry_date.startsWith(currentMonth));

  // KPIs
  const totalEntries = confirmedEntries.length;
  const thisMonthCount = thisMonthEntries.length;
  const totalDebit = confirmedEntries.reduce((s, e) => s + (e.total_debit || 0), 0);

  // Balance by type
  const balanceByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of confirmedEntries) {
      for (const line of (entry.lines || [])) {
        const account = accounts.find(a => a.id === line.account_id);
        if (!account) continue;
        const type = account.account_type;
        const isDevedora = account.nature === "devedora";
        const delta = isDevedora ? (Number(line.debit_amount) - Number(line.credit_amount)) : (Number(line.credit_amount) - Number(line.debit_amount));
        map.set(type, (map.get(type) || 0) + delta);
      }
    }
    return map;
  }, [confirmedEntries, accounts]);

  const receita = balanceByType.get("receita") || 0;
  const despesa = balanceByType.get("despesa") || 0;
  const resultado = receita - despesa;

  // Monthly revenue vs expense (last 12 months)
  const monthlyData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map(m => {
      let rev = 0, exp = 0;
      for (const entry of confirmedEntries) {
        if (!entry.entry_date.startsWith(m)) continue;
        for (const line of (entry.lines || [])) {
          const account = accounts.find(a => a.id === line.account_id);
          if (!account) continue;
          if (account.account_type === "receita") rev += Number(line.credit_amount) - Number(line.debit_amount);
          if (account.account_type === "despesa") exp += Number(line.debit_amount) - Number(line.credit_amount);
        }
      }
      return { month: m.slice(5), receita: rev, despesa: exp };
    });
  }, [confirmedEntries, accounts]);

  // Pie data for asset composition
  const pieData = useMemo(() => {
    const types = ["ativo", "passivo", "receita", "despesa", "patrimonio_liquido"];
    const labels: Record<string, string> = { ativo: "Ativo", passivo: "Passivo", receita: "Receita", despesa: "Despesa", patrimonio_liquido: "PL" };
    return types.filter(t => (balanceByType.get(t) || 0) !== 0).map(t => ({
      name: labels[t],
      value: Math.abs(balanceByType.get(t) || 0),
    }));
  }, [balanceByType]);

  // Alerts
  const openPeriods = periods.filter((p: any) => p.status === "aberto" && new Date(p.period_end) < new Date());
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const quickLinks = [
    { label: "Livro Diário", url: "/financeiro/livro-diario", icon: BookOpen },
    { label: "Livro Razão", url: "/financeiro/livro-razao", icon: BookText },
    { label: "Balancete", url: "/financeiro/balancete", icon: FileCheck },
    { label: "Balanço", url: "/financeiro/balanco", icon: Scale },
    { label: "Prestação Contas", url: "/financeiro/prestacao-contas", icon: FileOutput },
    { label: "Fechamento", url: "/financeiro/fechamento", icon: Lock },
    { label: "Rateio", url: "/financeiro/rateio", icon: SplitSquareHorizontal },
    { label: "Exportação", url: "/financeiro/exportacao-contabil", icon: FileUp },
    { label: "Conciliação", url: "/financeiro/conciliacao-contabil", icon: GitCompareArrows },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Contábil</h1>
        <p className="text-muted-foreground text-sm">Visão geral dos indicadores contábeis</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Lançamentos (Mês)</p><p className="text-2xl font-bold">{thisMonthCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Total Confirmados</p><p className="text-2xl font-bold">{totalEntries}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Receita Acumulada</p><p className="text-2xl font-bold text-green-600">R$ {fmt(receita)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-xs text-muted-foreground">Resultado</p>
          <div className="flex items-center gap-2">
            {resultado >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
            <p className={`text-2xl font-bold ${resultado >= 0 ? "text-green-600" : "text-destructive"}`}>R$ {fmt(resultado)}</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Alerts */}
      {openPeriods.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {openPeriods.length} período(s) passado(s) sem fechar
          </span>
          <Button variant="link" size="sm" className="ml-auto" onClick={() => navigate("/financeiro/fechamento")}>Ver períodos</Button>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Receita vs Despesa (12 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: number) => `R$ ${fmt(v)}`} />
                <Bar dataKey="receita" fill="hsl(142,60%,45%)" name="Receita" />
                <Bar dataKey="despesa" fill="hsl(0,65%,50%)" name="Despesa" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Composição Patrimonial</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center py-16 text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${fmt(v)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Ferramentas Contábeis</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {quickLinks.map(link => (
              <Button key={link.url} variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => navigate(link.url)}>
                <link.icon className="h-5 w-5" />
                <span className="text-xs">{link.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
