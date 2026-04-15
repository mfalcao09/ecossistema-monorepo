/**
 * ProspectorAIPage — Captação Ativa com IA.
 * 4 tabs: Dashboard, Análise ICP, Templates, Campanhas.
 */

import { useState } from "react";
import {
  ArrowLeft, Target, Brain, MessageSquare, Megaphone,
  RefreshCw, Plus, TrendingUp, Users, Phone, Mail,
  Copy, CheckCircle2, Zap, BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useProspectorDashboard, useAnalyzeIcp, useGenerateApproach,
  useCreateCampaign, useUpdateCampaignContact, useProspectorCampaigns,
  SOURCE_LABELS, STATUS_LABELS, CHANNEL_LABELS,
  type IcpResult, type ApproachResult, type Campaign, type CampaignDetails,
} from "@/hooks/useProspectorAI";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color = "text-gray-900 dark:text-white", suffix = "" }: {
  label: string; value: number | string; icon: React.ElementType; color?: string; suffix?: string;
}) {
  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}{suffix}</p>
          </div>
          <Icon className="w-8 h-8 text-gray-300 dark:text-gray-700" />
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-400 w-32 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 relative overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
          {value} ({pct}%)
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProspectorAIPage() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading: dashLoading } = useProspectorDashboard();
  const analyzeIcp = useAnalyzeIcp();
  const generateApproach = useGenerateApproach();
  const createCampaign = useCreateCampaign();
  const updateContact = useUpdateCampaignContact();
  const { data: campaignsData } = useProspectorCampaigns();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [icpResult, setIcpResult] = useState<IcpResult | null>(null);
  const [approachResult, setApproachResult] = useState<ApproachResult | null>(null);
  const [approachChannel, setApproachChannel] = useState("whatsapp");
  const [approachContext, setApproachContext] = useState("");
  const [approachTone, setApproachTone] = useState("consultivo");

  // Campaign form
  const [campaignName, setCampaignName] = useState("");
  const [campaignChannel, setCampaignChannel] = useState("whatsapp");
  const [campaignGoal, setCampaignGoal] = useState("50");
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  // ── Actions ──
  const handleAnalyzeIcp = () => {
    analyzeIcp.mutate(undefined, {
      onSuccess: (data) => { setIcpResult(data); toast.success("Análise ICP concluída!"); },
      onError: (err) => toast.error(`Erro: ${err.message}`),
    });
  };

  const handleGenerateApproach = () => {
    generateApproach.mutate(
      { channel: approachChannel, context: approachContext || undefined, tone: approachTone },
      {
        onSuccess: (data) => { setApproachResult(data); toast.success("Templates gerados!"); },
        onError: (err) => toast.error(`Erro: ${err.message}`),
      },
    );
  };

  const handleCreateCampaign = () => {
    if (!campaignName.trim()) { toast.error("Nome da campanha é obrigatório"); return; }
    createCampaign.mutate(
      { name: campaignName, channel: campaignChannel, goal_contacts: parseInt(campaignGoal) || 50 },
      {
        onSuccess: () => {
          toast.success("Campanha criada!"); setShowNewCampaign(false);
          setCampaignName(""); setCampaignGoal("50");
        },
        onError: (err) => toast.error(`Erro: ${err.message}`),
      },
    );
  };

  const handleCopyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const handleTrackMetric = (campaignId: string, metric: "contact" | "response" | "meeting" | "conversion") => {
    updateContact.mutate({ campaign_id: campaignId, metric }, {
      onSuccess: () => toast.success("Métrica atualizada!"),
    });
  };

  const campaigns = (campaignsData?.campaigns || []) as Campaign[];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1419] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Prospector IA</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Captação ativa inteligente com análise de perfil ideal</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Leads Novos (30d)" value={dashboard?.new_leads_30d ?? "—"} icon={Users} color="text-blue-600 dark:text-blue-400" />
          <KpiCard label="Taxa de Conversão" value={dashboard?.conversion_rate ?? "—"} icon={TrendingUp} color="text-green-600 dark:text-green-400" suffix="%" />
          <KpiCard label="Campanhas Ativas" value={dashboard?.campaigns?.active ?? 0} icon={Megaphone} color="text-purple-600 dark:text-purple-400" />
          <KpiCard label="Taxa de Resposta" value={dashboard?.campaigns?.response_rate ?? 0} icon={Zap} color="text-amber-600 dark:text-amber-400" suffix="%" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="w-4 h-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="icp" className="gap-2"><Brain className="w-4 h-4" />Análise ICP</TabsTrigger>
            <TabsTrigger value="templates" className="gap-2"><MessageSquare className="w-4 h-4" />Templates</TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2"><Megaphone className="w-4 h-4" />Campanhas</TabsTrigger>
          </TabsList>

          {/* ── Tab: Dashboard ── */}
          <TabsContent value="dashboard">
            {dashLoading ? (
              <div className="flex justify-center py-16"><RefreshCw className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : !dashboard ? (
              <Card><CardContent className="py-12 text-center text-gray-500">Sem dados</CardContent></Card>
            ) : (
              <div className="space-y-6">
                {/* Funnel */}
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardHeader><CardTitle className="text-base">Funil de Leads</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <FunnelBar label="Novo" value={dashboard.funnel.novo} total={dashboard.funnel.total} color="bg-blue-500" />
                    <FunnelBar label="Contatado" value={dashboard.funnel.contatado} total={dashboard.funnel.total} color="bg-cyan-500" />
                    <FunnelBar label="Qualificado" value={dashboard.funnel.qualificado} total={dashboard.funnel.total} color="bg-teal-500" />
                    <FunnelBar label="Visita Agendada" value={dashboard.funnel.visita_agendada} total={dashboard.funnel.total} color="bg-green-500" />
                    <FunnelBar label="Proposta" value={dashboard.funnel.proposta} total={dashboard.funnel.total} color="bg-amber-500" />
                    <FunnelBar label="Convertido" value={dashboard.funnel.convertido} total={dashboard.funnel.total} color="bg-emerald-500" />
                    <FunnelBar label="Perdido" value={dashboard.funnel.perdido} total={dashboard.funnel.total} color="bg-red-400" />
                  </CardContent>
                </Card>

                {/* Sources + Campaign metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader><CardTitle className="text-base">Leads por Origem</CardTitle></CardHeader>
                    <CardContent>
                      {dashboard.by_source.length === 0 ? (
                        <p className="text-gray-500 text-sm">Sem dados</p>
                      ) : (
                        <div className="space-y-2">
                          {dashboard.by_source.map(({ source, count }) => (
                            <div key={source} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{SOURCE_LABELS[source] || source}</span>
                              <Badge variant="outline">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader><CardTitle className="text-base">Métricas de Campanhas</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: "Contatos", value: dashboard.campaigns.total_contacts },
                          { label: "Respostas", value: dashboard.campaigns.total_responses },
                          { label: "Reuniões", value: dashboard.campaigns.total_meetings },
                          { label: "Conversões", value: dashboard.campaigns.total_conversions },
                        ].map((m) => (
                          <div key={m.label} className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{m.value}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: ICP Analysis ── */}
          <TabsContent value="icp">
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Análise de Perfil Ideal (ICP)</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Analisa leads convertidos para definir o perfil ideal de cliente</p>
                    </div>
                    <Button onClick={handleAnalyzeIcp} disabled={analyzeIcp.isPending} className="bg-purple-600 hover:bg-purple-700">
                      {analyzeIcp.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                      {analyzeIcp.isPending ? "Analisando..." : "Analisar ICP"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {icpResult && (
                <>
                  {/* ICP Summary */}
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="w-5 h-5" />Perfil Ideal do Cliente</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-gray-700 dark:text-gray-300">{icpResult.icp.icp_summary}</p>
                      {icpResult.icp.budget_recommendation && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">Faixa de Orçamento: {icpResult.icp.budget_recommendation}</p>
                        </div>
                      )}
                      {icpResult.icp.best_approach_time && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Melhor Horário: {icpResult.icp.best_approach_time}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Insights + Channels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader><CardTitle className="text-base">Insights Principais</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {icpResult.icp.key_insights.map((insight, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                              <p className="text-sm text-gray-700 dark:text-gray-300">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader><CardTitle className="text-base">Canais Recomendados</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {icpResult.icp.recommended_channels.map((ch, i) => (
                            <div key={i} className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm text-gray-900 dark:text-white">{ch.channel}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{ch.reason}</p>
                              </div>
                              <Badge variant="outline" className={
                                ch.priority === "alta" ? "border-red-300 text-red-600" :
                                ch.priority === "media" ? "border-amber-300 text-amber-600" : "border-gray-300"
                              }>{ch.priority}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Strategies */}
                  {icpResult.icp.prospecting_strategies.length > 0 && (
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader><CardTitle className="text-base">Estratégias de Prospecção</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {icpResult.icp.prospecting_strategies.map((s, i) => (
                            <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                              <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{s.strategy}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{s.description}</p>
                              <Badge variant="outline" className="text-xs">{s.expected_conversion} conversão</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Metrics */}
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader><CardTitle className="text-base">Dados da Análise</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{icpResult.metrics.total_leads}</p>
                          <p className="text-xs text-gray-500">Total Leads</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{icpResult.metrics.converted_leads}</p>
                          <p className="text-xs text-gray-500">Convertidos</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{icpResult.metrics.conversion_rate}%</p>
                          <p className="text-xs text-gray-500">Taxa Conversão</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">R$ {(icpResult.metrics.avg_deal_value / 1000).toFixed(0)}k</p>
                          <p className="text-xs text-gray-500">Ticket Médio</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Templates ── */}
          <TabsContent value="templates">
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Gerar Templates de Abordagem</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Canal</label>
                      <Select value={approachChannel} onValueChange={setApproachChannel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Tom</label>
                      <Select value={approachTone} onValueChange={setApproachTone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consultivo">Consultivo</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Contexto (opcional)</label>
                      <Input placeholder="Ex: Apartamento 3 quartos no Centro" value={approachContext}
                        onChange={(e) => setApproachContext(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleGenerateApproach} disabled={generateApproach.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {generateApproach.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                    {generateApproach.isPending ? "Gerando..." : "Gerar Templates"}
                  </Button>
                </CardContent>
              </Card>

              {approachResult && (
                <>
                  <div className="space-y-4">
                    {approachResult.templates.map((t, i) => (
                      <Card key={i} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">{t.title}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Melhor para: {t.best_for} • Taxa esperada: {t.expected_response_rate}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleCopyTemplate(t.message)}>
                              <Copy className="w-3 h-3 mr-1" />Copiar
                            </Button>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-3">
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{t.message}</p>
                          </div>
                          {t.follow_up && (
                            <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Follow-up</p>
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleCopyTemplate(t.follow_up)}>
                                  <Copy className="w-3 h-3 mr-1" />Copiar
                                </Button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{t.follow_up}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {approachResult.tips.length > 0 && (
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="pt-6">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Dicas</h4>
                        <div className="space-y-1">
                          {approachResult.tips.map((tip, i) => (
                            <p key={i} className="text-sm text-blue-700 dark:text-blue-300">• {tip}</p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Campaigns ── */}
          <TabsContent value="campaigns">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white">Campanhas de Prospecção</h3>
                <Dialog open={showNewCampaign} onOpenChange={setShowNewCampaign}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-2" />Nova Campanha</Button>
                  </DialogTrigger>
                  <DialogContent className="dark:bg-gray-900">
                    <DialogHeader><DialogTitle>Criar Campanha</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nome</label>
                        <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Prospecção Q1 2026" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Canal</label>
                        <Select value={campaignChannel} onValueChange={setCampaignChannel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="telefone">Telefone</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Meta de Contatos</label>
                        <Input type="number" value={campaignGoal} onChange={(e) => setCampaignGoal(e.target.value)} />
                      </div>
                      <Button onClick={handleCreateCampaign} disabled={createCampaign.isPending} className="w-full bg-purple-600 hover:bg-purple-700">
                        {createCampaign.isPending ? "Criando..." : "Criar Campanha"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {campaigns.length === 0 ? (
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardContent className="py-16 text-center">
                    <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhuma campanha criada</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Crie uma campanha para rastrear seus esforços de prospecção</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((c) => {
                    const d = c.action_details as CampaignDetails;
                    const progress = d.goal_contacts > 0 ? Math.min(100, Math.round((d.contacts_made / d.goal_contacts) * 100)) : 0;
                    const respRate = d.contacts_made > 0 ? Math.round((d.responses_received / d.contacts_made) * 100) : 0;
                    return (
                      <Card key={c.id} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">{d.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">{CHANNEL_LABELS[d.channel] || d.channel}</Badge>
                                <Badge variant="outline" className={c.status === "active" ? "border-green-300 text-green-600" : "border-gray-300"}>
                                  {c.status === "active" ? "Ativa" : c.status}
                                </Badge>
                                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-500 dark:text-gray-400">Progresso</span>
                              <span className="font-medium text-gray-900 dark:text-white">{d.contacts_made}/{d.goal_contacts}</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{d.contacts_made}</p>
                              <p className="text-xs text-gray-500">Contatos</p>
                            </div>
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                              <p className="text-lg font-bold text-blue-600">{d.responses_received}</p>
                              <p className="text-xs text-gray-500">Respostas ({respRate}%)</p>
                            </div>
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                              <p className="text-lg font-bold text-amber-600">{d.meetings_booked}</p>
                              <p className="text-xs text-gray-500">Reuniões</p>
                            </div>
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                              <p className="text-lg font-bold text-green-600">{d.conversions}</p>
                              <p className="text-xs text-gray-500">Conversões</p>
                            </div>
                          </div>

                          {/* Quick track buttons */}
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleTrackMetric(c.id, "contact")} disabled={updateContact.isPending}>
                              <Phone className="w-3 h-3 mr-1" />+1 Contato
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleTrackMetric(c.id, "response")} disabled={updateContact.isPending}>
                              <MessageSquare className="w-3 h-3 mr-1" />+1 Resposta
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleTrackMetric(c.id, "meeting")} disabled={updateContact.isPending}>
                              <Users className="w-3 h-3 mr-1" />+1 Reunião
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleTrackMetric(c.id, "conversion")} disabled={updateContact.isPending} className="border-green-300 text-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />+1 Conversão
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
