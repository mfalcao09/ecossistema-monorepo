import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "#f59e0b"];

export default function LegalJurimetrics() {
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["legal-jurimetrics"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_jurimetrics").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  // Group by court
  const byCourt = metrics.reduce((acc: Record<string, { total: number; totalDays: number }>, m: any) => {
    const k = m.court || "Não informado";
    if (!acc[k]) acc[k] = { total: 0, totalDays: 0 };
    acc[k].total++;
    acc[k].totalDays += m.time_to_resolution_days || 0;
    return acc;
  }, {});

  const courtChart = Object.entries(byCourt).map(([court, v]: any) => ({ court, media_dias: Math.round(v.totalDays / v.total) }));

  // Resolution types
  const byResolution = metrics.reduce((acc: Record<string, number>, m: any) => {
    const k = m.resolution_type || "pendente";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const resolutionChart = Object.entries(byResolution).map(([name, value]) => ({ name, value }));

  const avgDiscount = metrics.filter((m: any) => m.discount_percentage).length > 0
    ? (metrics.filter((m: any) => m.discount_percentage).reduce((acc: number, m: any) => acc + (m.discount_percentage || 0), 0) / metrics.filter((m: any) => m.discount_percentage).length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Jurimetria</h1><p className="text-muted-foreground">Análise preditiva baseada no histórico de processos judiciais.</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{metrics.length}</div><p className="text-xs text-muted-foreground">Registros Analisados</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{avgDiscount}%</div><p className="text-xs text-muted-foreground">Desconto Médio em Acordos</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{Object.keys(byCourt).length}</div><p className="text-xs text-muted-foreground">Varas/Comarcas</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tempo Médio por Vara (dias)</CardTitle></CardHeader>
          <CardContent>
            {courtChart.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem dados suficientes.</p> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courtChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="court" fontSize={12} /><YAxis /><Tooltip /><Bar dataKey="media_dias" fill="hsl(var(--primary))" /></BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Resultado dos Processos</CardTitle></CardHeader>
          <CardContent>
            {resolutionChart.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem dados suficientes.</p> : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart><Pie data={resolutionChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{resolutionChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground">Carregando...</div>}
    </div>
  );
}
