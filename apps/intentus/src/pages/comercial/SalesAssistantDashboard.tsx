import { useState } from "react";
import { ArrowLeft, Bot, AlertTriangle, TrendingUp, DollarSign, Target, Clock, Zap, CheckCircle2, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBrokerInsights } from "@/hooks/useSalesAssistant";
import { useSalesAssistantInsights } from "@/hooks/useSalesAssistantInsights";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SalesAssistantPanel } from "@/components/deals/SalesAssistantPanel";
import { useDeals } from "@/hooks/useDeals";

export function SalesAssistantDashboard() {
  const navigate = useNavigate();
  const { data: insights, isLoading, error } = useBrokerInsights();
  const { insights: advancedInsights } = useSalesAssistantInsights();
  const { data: deals } = useDeals();
  const [selectedDealId, setSelectedDealId] = useState<string>("");

  const activeDealOptions = deals
    ?.filter((d) => !["concluido", "cancelado"].includes(d.stage_name))
    .slice(0, 10) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/comercial/negocios")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Assistente IA
                </h1>
                <p className="text-sm text-slate-500">
                  Auxílio inteligente para suas vendas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Insights Section */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Seu Resumo de Negócios
          </h2>

          {isLoading && (
            <Card className="p-8 text-center">
              <p className="text-slate-500">Carregando insights...</p>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">
                    Erro ao carregar insights
                  </p>
                  <p className="text-sm text-red-700">
                    Não foi possível carregar os dados dos seus negócios.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {insights && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 p-4">
                <p className="text-sm text-blue-600 font-medium">
                  Negócios Ativos
                </p>
                <p className="text-3xl font-bold text-blue-900 mt-2">
                  {insights.total_active_deals}
                </p>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 p-4">
                <p className="text-sm text-orange-600 font-medium">
                  Precisam Atenção
                </p>
                <p className="text-3xl font-bold text-orange-900 mt-2">
                  {insights.deals_needing_attention}
                </p>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 p-4">
                <p className="text-sm text-emerald-600 font-medium">
                  Prob. Fechamento
                </p>
                <p className="text-3xl font-bold text-emerald-900 mt-2">
                  {Math.round(insights.estimated_closing_probability * 100)}%
                </p>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 p-4">
                <p className="text-sm text-purple-600 font-medium">
                  Previsão (R$)
                </p>
                <p className="text-3xl font-bold text-purple-900 mt-2">
                  {(insights.revenue_forecast / 1000000).toFixed(1)}M
                </p>
              </Card>
            </div>
          )}

          {insights?.recommended_priorities && (
            <Card className="bg-slate-50 border-slate-200 p-4 mt-4">
              <h3 className="font-semibold text-slate-900 mb-3">
                Prioridades Recomendadas
              </h3>
              <ul className="space-y-2">
                {insights.recommended_priorities.map((priority, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-slate-400">•</span>
                    <span>{priority}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {insights?.summary && (
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 p-4 mt-4">
              <p className="text-sm text-slate-700 leading-relaxed italic">
                "{insights.summary}"
              </p>
            </Card>
          )}

          {/* ── Advanced Insights (I01) ──────────────────────── */}
          {advancedInsights && (
            <div className="space-y-4 mt-4">
              {/* Weekly summary */}
              <Card className="border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Resumo Semanal</span>
                </div>
                <p className="text-sm text-muted-foreground">{advancedInsights.weeklySummary}</p>
              </Card>

              {/* Advanced KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-3"><div className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-green-600" /><span className="text-[10px] text-muted-foreground">Pipeline</span></div><p className="text-lg font-bold">R$ {(advancedInsights.kpis.pipelineValue / 1000).toFixed(0)}k</p></CardContent></Card>
                <Card><CardContent className="p-3"><div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-red-600" /><span className="text-[10px] text-muted-foreground">Em Risco</span></div><p className="text-lg font-bold">{advancedInsights.kpis.dealsAtRisk}</p></CardContent></Card>
                <Card><CardContent className="p-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /><span className="text-[10px] text-muted-foreground">Fechando</span></div><p className="text-lg font-bold">{advancedInsights.kpis.dealsClosingSoon}</p></CardContent></Card>
                <Card><CardContent className="p-3"><div className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] text-muted-foreground">Ações Pendentes</span></div><p className="text-lg font-bold">{advancedInsights.kpis.nextActionsCount}</p></CardContent></Card>
              </div>

              {/* Next actions */}
              {advancedInsights.nextActions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Próximas Ações Recomendadas</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {advancedInsights.nextActions.slice(0, 5).map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <Badge className={a.priority === "alta" ? "bg-red-100 text-red-700" : a.priority === "media" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"} variant="secondary">
                            {a.priority}
                          </Badge>
                          <span className="font-medium">{a.propertyTitle}</span>
                          <span className="text-muted-foreground">— {a.description}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Deals at risk */}
              {advancedInsights.dealsAtRisk.length > 0 && (
                <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" /> Negócios em Risco</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {advancedInsights.dealsAtRisk.slice(0, 5).map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-xs">
                          <Badge className={d.risk === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"} variant="secondary">
                            {d.daysInStage}d
                          </Badge>
                          <span className="font-medium">{d.propertyTitle}</span>
                          <span className="text-muted-foreground">— {d.reason}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Assistant Panel */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Assistente de Vendas
          </h2>

          <Card className="border-slate-200 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Selecione um negócio:
                </label>
                <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha um negócio ativo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDealOptions.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.title || "Negócio sem título"} -{" "}
                        {deal.stage_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDealId ? (
                <SalesAssistantPanel dealId={selectedDealId} />
              ) : (
                <Card className="bg-slate-50 border-slate-200 p-8 text-center">
                  <p className="text-slate-500">
                    Selecione um negócio para começar
                  </p>
                </Card>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
