/**
 * NarrativeReport — Relatórios comerciais com narrativa IA.
 * Rota: /comercial/relatorio-ia
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useGenerateReport,
  PERIOD_LABELS,
  type ReportPeriod,
  type NarrativeReport as NarrativeReportType,
} from "@/hooks/useNarrativeReport";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowLeft, FileText, Loader2, Sparkles, TrendingUp, DollarSign,
  Users, Calendar, Target, CheckCircle2, XCircle, type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function NarrativeReport() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ReportPeriod>("mensal");
  const generateReport = useGenerateReport();
  const [report, setReport] = useState<NarrativeReportType | null>(null);

  const handleGenerate = () => {
    generateReport.mutate(period, {
      onSuccess: (data) => setReport(data),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/relatorios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Relatório IA com Narrativa
          </h1>
          <p className="text-sm text-muted-foreground">
            Relatório comercial automatizado com análise textual gerada por IA
          </p>
        </div>
        <div className="flex gap-1">
          {(["semanal", "mensal", "trimestral"] as ReportPeriod[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod(p)}>
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
        <Button onClick={handleGenerate} disabled={generateReport.isPending} className="gap-1.5">
          {generateReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar Relatório
        </Button>
      </div>

      {!report && !generateReport.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">Nenhum relatório gerado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione o período e clique em "Gerar Relatório" para criar uma análise com narrativa IA
            </p>
          </CardContent>
        </Card>
      )}

      {generateReport.isPending && (
        <Card>
          <CardContent className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Gerando relatório com IA...</span>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Report header */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Relatório {PERIOD_LABELS[report.period as ReportPeriod]}</p>
                <p className="text-xs text-muted-foreground">
                  Gerado em {format(new Date(report.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {report.generated_by}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {report.model_used === "gemini-2.0-flash" ? "IA Real" : "Regras"}
              </Badge>
            </CardContent>
          </Card>

          {/* KPIs grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <KPI label="Negócios" value={report.kpis.new_deals} icon={TrendingUp} />
            <KPI label="Ganhos" value={report.kpis.won_deals} icon={CheckCircle2} color="text-green-600" />
            <KPI label="Receita" value={fmtBRL(report.kpis.won_revenue)} icon={DollarSign} color="text-green-600" />
            <KPI label="Win Rate" value={`${report.kpis.win_rate}%`} icon={Target} color={report.kpis.win_rate >= 50 ? "text-green-600" : "text-amber-600"} />
            <KPI label="Leads" value={report.kpis.new_leads} icon={Users} />
            <KPI label="Conversão" value={`${report.kpis.lead_conversion_rate}%`} icon={Target} color="text-primary" />
            <KPI label="Visitas" value={report.kpis.total_visits} icon={Calendar} />
          </div>

          {/* Leads by source chart */}
          {Object.keys(report.leads_by_source).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Leads por Fonte</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={Object.entries(report.leads_by_source).map(([source, count]) => ({ source, count }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="source" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" fill="#e2a93b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Narrative */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Análise Narrativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {report.narrative.split("\n").map((line, i) => (
                  line.trim() ? <p key={i} className="text-sm leading-relaxed mb-2">{line}</p> : null
                ))}
              </div>
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
          <Icon className={`h-3.5 w-3.5 ${color || "text-muted-foreground"}`} />
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}
