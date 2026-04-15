/**
 * NextBestAction.tsx — F11: Next Best Action Engine
 * Route: /relacionamento/next-best-action
 * 3 Tabs: Oportunidades | Recomendações | Dashboard
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Target, TrendingUp, DollarSign, Zap, Brain, Send, Plus, BarChart3, ArrowRight,
  CheckCircle2, XCircle, Clock, Eye, MousePointer, Sparkles, Filter,
} from "lucide-react";
import {
  useOpportunitiesDirect, useRecommendationsDirect, useStatsDirect,
  useAddOpportunityDirect, useUpdateOpportunityDirect,
  useUpdateRecommendationDirect, useScanOpportunities, useGenerateOffer,
  getOpportunityTypeLabel, getOpportunityTypeEmoji, getOpportunityTypeColor,
  getStatusLabel, getStatusColor, getStatusEmoji,
  getActionTypeLabel, getActionTypeEmoji,
  getChannelLabel, getChannelEmoji,
  getProbabilityColor, getProbabilityLabel, formatCurrency,
  type RevenueOpportunity, type NbaRecommendation, type OpportunityType,
  type OpportunityStatus, type RecommendationStatus, type ActionType, type Channel,
  type GeneratedOffer,
} from "@/hooks/useNextBestAction";

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string | number; subtitle?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5 text-white" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Opportunity Card ────────────────────────────────────────
function OpportunityCard({ opp, onGenerateOffer, onConvert, onDismiss, generatingId }: {
  opp: RevenueOpportunity;
  onGenerateOffer: (id: string) => void;
  onConvert: (id: string) => void;
  onDismiss: (id: string) => void;
  generatingId: string | null;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getOpportunityTypeEmoji(opp.opportunity_type)}</span>
            <div>
              <h4 className="font-medium text-sm">{opp.title}</h4>
              <Badge variant="outline" className={`text-xs mt-0.5 ${getOpportunityTypeColor(opp.opportunity_type)}`}>
                {getOpportunityTypeLabel(opp.opportunity_type)}
              </Badge>
            </div>
          </div>
          <Badge className={getStatusColor(opp.status)}>{getStatusEmoji(opp.status)} {getStatusLabel(opp.status)}</Badge>
        </div>

        {opp.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{opp.description}</p>}

        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          <div>
            <span className="text-muted-foreground">Valor Est.</span>
            <p className="font-semibold text-green-600">{formatCurrency(opp.estimated_value)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Propensão</span>
            <p className={`font-semibold ${getProbabilityColor(opp.probability_score)}`}>
              {opp.probability_score}% — {getProbabilityLabel(opp.probability_score)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Canal</span>
            <p>{getChannelEmoji(opp.best_channel)} {getChannelLabel(opp.best_channel)}</p>
          </div>
        </div>

        {opp.optimal_timing && (
          <p className="text-xs text-muted-foreground mb-2">
            <Clock className="h-3 w-3 inline mr-1" />Timing: {opp.optimal_timing}
          </p>
        )}

        {opp.ai_generated && (
          <Badge variant="outline" className="text-xs mb-2 bg-purple-50 text-purple-700">
            <Sparkles className="h-3 w-3 mr-1" />IA • {Math.round((opp.ai_confidence || 0) * 100)}% confiança
          </Badge>
        )}

        {(opp.status === "identified" || opp.status === "qualified") && (
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="default" className="text-xs flex-1" onClick={() => onGenerateOffer(opp.id)} disabled={generatingId === opp.id}>
              {generatingId === opp.id ? <><Sparkles className="h-3 w-3 mr-1 animate-spin" />Gerando...</> : <><Brain className="h-3 w-3 mr-1" />Gerar Oferta IA</>}
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => onConvert(opp.id)}>
              <CheckCircle2 className="h-3 w-3 mr-1" />Converter
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => onDismiss(opp.id)}>
              <XCircle className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Recommendation Card ─────────────────────────────────────
function RecommendationCard({ rec, onUpdateStatus }: {
  rec: NbaRecommendation;
  onUpdateStatus: (id: string, status: RecommendationStatus) => void;
}) {
  const offer = rec.offer_content as GeneratedOffer | null;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getActionTypeEmoji(rec.action_type)}</span>
            <div>
              <h4 className="font-medium text-sm">{getActionTypeLabel(rec.action_type)}</h4>
              {rec.revenue_opportunities && (
                <p className="text-xs text-muted-foreground">{rec.revenue_opportunities.title}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={getStatusColor(rec.status)}>{getStatusEmoji(rec.status)} {getStatusLabel(rec.status)}</Badge>
            <span className="text-xs text-muted-foreground">Score: {rec.priority_score}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs mb-2">
          <span>{getChannelEmoji(rec.channel)} {getChannelLabel(rec.channel)}</span>
          {rec.revenue_opportunities && (
            <span className="text-green-600 font-medium">{formatCurrency(rec.revenue_opportunities.estimated_value)}</span>
          )}
          {rec.variant && <Badge variant="outline" className="text-xs">Variante: {rec.variant}</Badge>}
        </div>

        {offer && (
          <div className="bg-muted/50 rounded-lg p-3 mb-2 text-xs space-y-1">
            <p className="font-medium">{offer.subject}</p>
            {offer.value_proposition && <p className="text-muted-foreground italic">{offer.value_proposition}</p>}
            {offer.call_to_action && <p className="text-primary font-medium">CTA: {offer.call_to_action}</p>}
            {offer.personalization_score && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                Personalização: {offer.personalization_score}/10
              </Badge>
            )}
          </div>
        )}

        {/* Tracking timeline */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {rec.sent_at && <Badge variant="outline" className="text-xs"><Send className="h-2.5 w-2.5 mr-0.5" />Enviado</Badge>}
          {rec.opened_at && <Badge variant="outline" className="text-xs"><Eye className="h-2.5 w-2.5 mr-0.5" />Aberto</Badge>}
          {rec.clicked_at && <Badge variant="outline" className="text-xs"><MousePointer className="h-2.5 w-2.5 mr-0.5" />Clicado</Badge>}
          {rec.converted_at && <Badge variant="outline" className="text-xs bg-green-50 text-green-700"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Convertido</Badge>}
        </div>

        {rec.status === "pending" && (
          <div className="flex gap-2">
            <Button size="sm" variant="default" className="text-xs flex-1" onClick={() => onUpdateStatus(rec.id, "approved")}>
              <CheckCircle2 className="h-3 w-3 mr-1" />Aprovar
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => onUpdateStatus(rec.id, "rejected")}>
              <XCircle className="h-3 w-3 mr-1" />Rejeitar
            </Button>
          </div>
        )}
        {rec.status === "approved" && (
          <Button size="sm" variant="default" className="text-xs w-full" onClick={() => onUpdateStatus(rec.id, "sent")}>
            <Send className="h-3 w-3 mr-1" />Marcar como Enviado
          </Button>
        )}
        {rec.status === "sent" && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => onUpdateStatus(rec.id, "opened")}>
              <Eye className="h-3 w-3 mr-1" />Aberto
            </Button>
            <Button size="sm" variant="default" className="text-xs flex-1" onClick={() => onUpdateStatus(rec.id, "converted")}>
              <DollarSign className="h-3 w-3 mr-1" />Convertido
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function NextBestAction() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("opportunities");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [addOppOpen, setAddOppOpen] = useState(false);

  // Form state
  const [newOpp, setNewOpp] = useState({ opportunity_type: "cross_sell_services" as OpportunityType, title: "", description: "", estimated_value: 0, probability_score: 50, best_channel: "email" as Channel });

  // Queries
  const { data: opportunities = [], isLoading: loadingOpps } = useOpportunitiesDirect(
    statusFilter !== "all" || typeFilter !== "all"
      ? { ...(statusFilter !== "all" ? { status: statusFilter as OpportunityStatus } : {}), ...(typeFilter !== "all" ? { opportunity_type: typeFilter as OpportunityType } : {}) }
      : undefined
  );
  const { data: recommendations = [], isLoading: loadingRecs } = useRecommendationsDirect();
  const { data: stats } = useStatsDirect();

  // Mutations
  const addOpp = useAddOpportunityDirect();
  const updateOpp = useUpdateOpportunityDirect();
  const updateRec = useUpdateRecommendationDirect();
  const scanAI = useScanOpportunities();
  const generateOffer = useGenerateOffer();

  const handleAddOpportunity = () => {
    if (!newOpp.title) { toast({ title: "Preencha o título", variant: "destructive" }); return; }
    addOpp.mutate(newOpp as any, {
      onSuccess: () => { toast({ title: "Oportunidade criada!" }); setAddOppOpen(false); setNewOpp({ opportunity_type: "cross_sell_services", title: "", description: "", estimated_value: 0, probability_score: 50, best_channel: "email" }); },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  const handleScan = () => {
    scanAI.mutate(undefined, {
      onSuccess: (r) => toast({ title: `Scan concluído!`, description: `${r.count} oportunidades detectadas. Receita estimada: ${formatCurrency(r.total_estimated_revenue)}` }),
      onError: (e: any) => toast({ title: "Erro no scan", description: e.message, variant: "destructive" }),
    });
  };

  const handleGenerateOffer = (oppId: string) => {
    setGeneratingId(oppId);
    generateOffer.mutate({ opportunityId: oppId }, {
      onSuccess: () => { toast({ title: "Oferta gerada com sucesso!" }); setGeneratingId(null); },
      onError: (e: any) => { toast({ title: "Erro ao gerar oferta", description: e.message, variant: "destructive" }); setGeneratingId(null); },
    });
  };

  const handleConvert = (id: string) => {
    updateOpp.mutate({ id, updates: { status: "converted" as any, conversion_date: new Date().toISOString().slice(0, 10) } }, {
      onSuccess: () => toast({ title: "Oportunidade convertida!" }),
    });
  };

  const handleDismiss = (id: string) => {
    updateOpp.mutate({ id, updates: { status: "dismissed" as any } }, {
      onSuccess: () => toast({ title: "Oportunidade descartada" }),
    });
  };

  const handleUpdateRecStatus = (id: string, status: RecommendationStatus) => {
    const updates: any = { status };
    if (status === "sent") updates.sent_at = new Date().toISOString();
    if (status === "opened") updates.opened_at = new Date().toISOString();
    if (status === "converted") updates.converted_at = new Date().toISOString();
    updateRec.mutate({ id, updates }, {
      onSuccess: () => toast({ title: `Status atualizado: ${getStatusLabel(status)}` }),
    });
  };

  // Computed
  const activeOpps = opportunities.filter(o => ["identified", "qualified", "in_progress"].includes(o.status));
  const pendingRecs = recommendations.filter(r => r.status === "pending");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Next Best Action Engine
          </h1>
          <p className="text-muted-foreground text-sm">Motor IA de ações inteligentes — a ação certa, no momento certo, para cada cliente</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleScan} disabled={scanAI.isPending} variant="outline">
            {scanAI.isPending ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" />Escaneando...</> : <><Brain className="h-4 w-4 mr-2" />Scan IA</>}
          </Button>
          <Dialog open={addOppOpen} onOpenChange={setAddOppOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Oportunidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Oportunidade de Receita</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={newOpp.opportunity_type} onValueChange={(v) => setNewOpp(p => ({ ...p, opportunity_type: v as OpportunityType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["cross_sell_insurance", "cross_sell_services", "upsell_property", "upsell_plan", "early_renewal", "standard_renewal", "referral_program", "reactivation", "custom"] as OpportunityType[]).map(t => (
                        <SelectItem key={t} value={t}>{getOpportunityTypeEmoji(t)} {getOpportunityTypeLabel(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Título</Label><Input value={newOpp.title} onChange={e => setNewOpp(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Cross-sell seguro residencial" /></div>
                <div><Label>Descrição</Label><Textarea value={newOpp.description} onChange={e => setNewOpp(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor Estimado (R$)</Label><Input type="number" value={newOpp.estimated_value} onChange={e => setNewOpp(p => ({ ...p, estimated_value: Number(e.target.value) }))} /></div>
                  <div><Label>Propensão (%)</Label><Input type="number" min={0} max={100} value={newOpp.probability_score} onChange={e => setNewOpp(p => ({ ...p, probability_score: Number(e.target.value) }))} /></div>
                </div>
                <div>
                  <Label>Melhor Canal</Label>
                  <Select value={newOpp.best_channel} onValueChange={(v) => setNewOpp(p => ({ ...p, best_channel: v as Channel }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["email", "whatsapp", "phone", "in_person", "push_notification"] as Channel[]).map(c => (
                        <SelectItem key={c} value={c}>{getChannelEmoji(c)} {getChannelLabel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAddOpportunity} disabled={addOpp.isPending}>
                  {addOpp.isPending ? "Salvando..." : "Criar Oportunidade"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Oportunidades Ativas" value={activeOpps.length} icon={Target} color="bg-blue-500" />
        <KpiCard title="Receita Estimada" value={formatCurrency(stats?.opportunities.total_estimated || 0)} icon={DollarSign} color="bg-green-500" />
        <KpiCard title="Receita Convertida" value={formatCurrency(stats?.opportunities.total_converted || 0)} icon={TrendingUp} color="bg-emerald-500" />
        <KpiCard title="Propensão Média" value={`${stats?.opportunities.avg_probability || 0}%`} icon={BarChart3} color="bg-purple-500" />
        <KpiCard title="Recomendações" value={stats?.recommendations.total || 0} subtitle={`${pendingRecs.length} pendentes`} icon={Zap} color="bg-amber-500" />
        <KpiCard title="Taxa Conversão" value={`${stats?.recommendations.conversion_rate || 0}%`} subtitle={`${stats?.recommendations.conversions || 0} convertidas`} icon={CheckCircle2} color="bg-teal-500" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="opportunities">
            <Target className="h-4 w-4 mr-2" />Oportunidades
            {activeOpps.length > 0 && <Badge className="ml-2 bg-blue-500 text-white text-xs">{activeOpps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <Zap className="h-4 w-4 mr-2" />Recomendações
            {pendingRecs.length > 0 && <Badge className="ml-2 bg-amber-500 text-white text-xs">{pendingRecs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />Dashboard
          </TabsTrigger>
        </TabsList>

        {/* TAB: Oportunidades */}
        <TabsContent value="opportunities" className="space-y-4">
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><Filter className="h-3 w-3 mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {(["identified", "qualified", "in_progress", "converted", "lost", "expired", "dismissed"] as OpportunityStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{getStatusEmoji(s)} {getStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                {(["cross_sell_insurance", "cross_sell_services", "upsell_property", "upsell_plan", "early_renewal", "standard_renewal", "referral_program", "reactivation", "custom"] as OpportunityType[]).map(t => (
                  <SelectItem key={t} value={t}>{getOpportunityTypeEmoji(t)} {getOpportunityTypeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingOpps ? (
            <div className="text-center py-10 text-muted-foreground">Carregando oportunidades...</div>
          ) : opportunities.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhuma oportunidade encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">Use o botão "Scan IA" para detectar oportunidades automaticamente</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {opportunities.map(o => (
                <OpportunityCard key={o.id} opp={o} onGenerateOffer={handleGenerateOffer} onConvert={handleConvert} onDismiss={handleDismiss} generatingId={generatingId} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB: Recomendações */}
        <TabsContent value="recommendations" className="space-y-4">
          {loadingRecs ? (
            <div className="text-center py-10 text-muted-foreground">Carregando recomendações...</div>
          ) : recommendations.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhuma recomendação ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Gere ofertas para oportunidades na aba anterior</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.map(r => (
                <RecommendationCard key={r.id} rec={r} onUpdateStatus={handleUpdateRecStatus} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB: Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Type */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Oportunidades por Tipo</CardTitle></CardHeader>
              <CardContent>
                {stats?.opportunities.by_type && Object.keys(stats.opportunities.by_type).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.opportunities.by_type).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm">{getOpportunityTypeEmoji(type as OpportunityType)} {getOpportunityTypeLabel(type as OpportunityType)}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* By Status */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline de Oportunidades</CardTitle></CardHeader>
              <CardContent>
                {stats?.opportunities.by_status && Object.keys(stats.opportunities.by_status).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.opportunities.by_status).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm">{getStatusEmoji(status as OpportunityStatus)} {getStatusLabel(status as OpportunityStatus)}</span>
                        <Badge className={getStatusColor(status as OpportunityStatus)}>{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Recommendations by Action */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recomendações por Ação</CardTitle></CardHeader>
              <CardContent>
                {stats?.recommendations.by_action && Object.keys(stats.recommendations.by_action).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.recommendations.by_action).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        <span className="text-sm">{getActionTypeEmoji(action as ActionType)} {getActionTypeLabel(action as ActionType)}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Funnel */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Funil de Conversão</CardTitle></CardHeader>
              <CardContent>
                {stats?.recommendations.by_status && Object.keys(stats.recommendations.by_status).length > 0 ? (
                  <div className="space-y-2">
                    {["pending", "approved", "sent", "opened", "clicked", "converted"].map(s => {
                      const count = stats.recommendations.by_status[s] || 0;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-sm w-24">{getStatusEmoji(s as RecommendationStatus)} {getStatusLabel(s as RecommendationStatus)}</span>
                          <div className="flex-1 bg-muted rounded-full h-4">
                            <div className="bg-primary/70 h-4 rounded-full transition-all" style={{ width: `${stats.recommendations.total ? (count / stats.recommendations.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
