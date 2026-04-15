import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, TrendingUp, Users, Target, Clock } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";

export default function CommercialReports() {
  const [period, setPeriod] = useState("3");

  const startDate = startOfMonth(subMonths(new Date(), parseInt(period)));
  const endDate = endOfMonth(new Date());

  const { data: leads = [] } = useQuery({
    queryKey: ["report-leads", period],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("leads")
        .select("id, name, status, source, created_at, assigned_to")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["report-deals", period],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("deal_requests")
        .select("id, status, created_at, total_value")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["report-visits", period],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let q = supabase
        .from("commercial_visits")
        .select("id, status, scheduled_at, feedback_rating")
        .gte("scheduled_at", startDate.toISOString())
        .lte("scheduled_at", endDate.toISOString());
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return data || [];
    },
  });

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.status === "convertido").length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0";
  const totalDeals = deals.length;
  const closedDeals = deals.filter((d: any) => d.status === "aprovado_comercial" || d.status === "concluido" || d.status === "contrato_finalizado").length;
  const totalVisits = visits.length;
  const realizedVisits = visits.filter((v: any) => v.status === "realizada").length;
  const avgRating = visits.filter((v: any) => v.feedback_rating).length > 0
    ? (visits.filter((v: any) => v.feedback_rating).reduce((acc: number, v: any) => acc + v.feedback_rating, 0) / visits.filter((v: any) => v.feedback_rating).length).toFixed(1)
    : "—";
  const totalVolume = deals.filter((d: any) => d.status === "aprovado_comercial" || d.status === "concluido" || d.status === "contrato_finalizado").reduce((acc: number, d: any) => acc + (d.total_value || 0), 0);

  const handleExportCSV = () => {
    const rows = [
      { Metrica: "Total de Leads", Valor: totalLeads },
      { Metrica: "Leads Convertidos", Valor: convertedLeads },
      { Metrica: "Taxa de Conversão", Valor: `${conversionRate}%` },
      { Metrica: "Total de Negócios", Valor: totalDeals },
      { Metrica: "Negócios Fechados", Valor: closedDeals },
      { Metrica: "Volume Fechado", Valor: `R$ ${totalVolume.toLocaleString("pt-BR")}` },
      { Metrica: "Total de Visitas", Valor: totalVisits },
      { Metrica: "Visitas Realizadas", Valor: realizedVisits },
      { Metrica: "Rating Médio", Valor: avgRating },
    ];
    exportToCSV(rows, `relatorio-comercial-${format(new Date(), "yyyyMMdd")}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios Comerciais</h1>
          <p className="text-muted-foreground">Métricas de desempenho comercial</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" /> Leads
            </div>
            <p className="text-2xl font-bold">{totalLeads}</p>
            <p className="text-xs text-muted-foreground">{convertedLeads} convertidos ({conversionRate}%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="h-4 w-4" /> Negócios
            </div>
            <p className="text-2xl font-bold">{totalDeals}</p>
            <p className="text-xs text-muted-foreground">{closedDeals} fechados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" /> Volume Fechado
            </div>
            <p className="text-2xl font-bold">R$ {totalVolume.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" /> Visitas
            </div>
            <p className="text-2xl font-bold">{totalVisits}</p>
            <p className="text-xs text-muted-foreground">{realizedVisits} realizadas | Rating: {avgRating}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Resumo por Fonte de Lead</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Convertidos</TableHead>
                <TableHead>Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(
                leads.reduce((acc: Record<string, { total: number; converted: number }>, l: any) => {
                  const src = l.source || "Não informado";
                  if (!acc[src]) acc[src] = { total: 0, converted: 0 };
                  acc[src].total++;
                  if (l.status === "convertido") acc[src].converted++;
                  return acc;
                }, {})
              ).map(([source, stats]) => (
                <TableRow key={source}>
                  <TableCell className="capitalize">{source}</TableCell>
                  <TableCell>{(stats as any).total}</TableCell>
                  <TableCell>{(stats as any).converted}</TableCell>
                  <TableCell>{((stats as any).total > 0 ? (((stats as any).converted / (stats as any).total) * 100).toFixed(1) : 0)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
