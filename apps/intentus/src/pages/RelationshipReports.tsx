import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Users, FileText, AlertTriangle, Wrench, Star, Download } from "lucide-react";
import { useRelationshipReports } from "@/hooks/useRelationshipReports";
import { exportToCSV } from "@/lib/csvExport";
import { format, subMonths } from "date-fns";

export default function RelationshipReports() {
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data, isLoading } = useRelationshipReports(startDate, endDate);

  const npsScore = data && data.totalResponses > 0
    ? Math.round(((data.promoters - data.detractors) / data.totalResponses) * 100)
    : null;

  const exportSection = (section: string) => {
    if (!data) return;
    const rows: Record<string, any>[] = [];
    if (section === "atendimento") {
      rows.push({
        "Total Tickets": data.totalTickets,
        "Resolvidos": data.resolvedTickets,
        "SLA Cumprido": data.slaMetCount,
        "SLA Estourado": data.slaBrokenCount,
      });
    } else if (section === "contratos") {
      rows.push({
        "Total Contratos": data.totalContracts,
        "Renovações": data.renewalCount,
        "Rescisões": data.terminationCount,
      });
    } else if (section === "financeiro") {
      rows.push({
        "Parcelas em Atraso": data.overdueInstallments,
        "Valor em Atraso": data.overdueAmount,
      });
    } else if (section === "manutencao") {
      rows.push({
        "Abertas": data.maintenanceOpen,
        "Concluídas": data.maintenanceClosed,
      });
    } else if (section === "satisfacao") {
      rows.push({
        "Respostas": data.totalResponses,
        "NPS Score": npsScore ?? "N/A",
        "Promotores": data.promoters,
        "Neutros": data.neutrals,
        "Detratores": data.detractors,
        "Média": data.npsAverage?.toFixed(1) ?? "N/A",
      });
    }
    exportToCSV(rows, `relatorio_${section}_${startDate}_${endDate}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios de Relacionamento</h1>
        <p className="text-muted-foreground">Indicadores consolidados do pós-venda</p>
      </div>

      {/* Filtro Período */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-4">
            <div><Label>De</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><Label>Até</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
      ) : !data ? (
        <div className="text-center py-12 text-muted-foreground">Selecione um período</div>
      ) : (
        <div className="space-y-6">
          {/* Atendimento */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" />Atendimento</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportSection("atendimento")}><Download className="h-3 w-3 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center"><p className="text-2xl font-bold">{data.totalTickets}</p><p className="text-xs text-muted-foreground">Total Tickets</p></div>
                <div className="text-center"><p className="text-2xl font-bold">{data.resolvedTickets}</p><p className="text-xs text-muted-foreground">Resolvidos</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-green-600">{data.slaMetCount}</p><p className="text-xs text-muted-foreground">SLA Cumprido</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-destructive">{data.slaBrokenCount}</p><p className="text-xs text-muted-foreground">SLA Estourado</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Contratos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Contratos</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportSection("contratos")}><Download className="h-3 w-3 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center"><p className="text-2xl font-bold">{data.totalContracts}</p><p className="text-xs text-muted-foreground">Novos no Período</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-green-600">{data.renewalCount}</p><p className="text-xs text-muted-foreground">Renovações</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-destructive">{data.terminationCount}</p><p className="text-xs text-muted-foreground">Rescisões</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Financeiro */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Inadimplência</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportSection("financeiro")}><Download className="h-3 w-3 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center"><p className="text-2xl font-bold text-destructive">{data.overdueInstallments}</p><p className="text-xs text-muted-foreground">Parcelas em Atraso</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-destructive">R$ {data.overdueAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">Valor Total</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Manutenção */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2"><Wrench className="h-5 w-5" />Manutenção</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportSection("manutencao")}><Download className="h-3 w-3 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center"><p className="text-2xl font-bold">{data.maintenanceOpen}</p><p className="text-xs text-muted-foreground">Abertas</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-green-600">{data.maintenanceClosed}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Satisfação */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2"><Star className="h-5 w-5" />Satisfação (NPS)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportSection("satisfacao")}><Download className="h-3 w-3 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              {data.totalResponses === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma resposta no período</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center"><p className="text-2xl font-bold">{data.npsAverage?.toFixed(1)}</p><p className="text-xs text-muted-foreground">Nota Média</p></div>
                  <div className="text-center"><p className="text-2xl font-bold">{npsScore}</p><p className="text-xs text-muted-foreground">Score NPS</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-green-600">{data.promoters}</p><p className="text-xs text-muted-foreground">Promotores</p></div>
                  <div className="text-center"><p className="text-2xl font-bold">{data.neutrals}</p><p className="text-xs text-muted-foreground">Neutros</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-destructive">{data.detractors}</p><p className="text-xs text-muted-foreground">Detratores</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
