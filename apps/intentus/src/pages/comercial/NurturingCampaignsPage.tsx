/**
 * NurturingCampaignsPage — Campanhas de Nurturing Multi-Canal.
 * 4 tabs: Dashboard, Campanhas, Criar Campanha, Gerador de Conteúdo IA.
 *
 * Sessão 98 — CRM F3 C03
 */
import { useState, useMemo } from "react";
import {
  useNurturingDashboard,
  useNurturingCampaigns,
  useNurturingCampaignDetail,
  useCreateNurturingCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useAddNurturingContacts,
  useUpdateContactStep,
  useGenerateNurturingContent,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CONTACT_STATUS_LABELS,
  GOAL_OPTIONS,
  type NurturingStep,
  type NurturingChannel,
  type CampaignStatus,
  type ContactStatus,
  type NurturingCampaignRecord,
} from "@/hooks/useNurturingCampaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Users,
  TrendingUp,
  MessageCircle,
  Mail,
  Phone,
  Sparkles,
  Copy,
  Check,
  ChevronRight,
  BarChart3,
  Target,
  Loader2,
} from "lucide-react";

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/40" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  switch (channel) {
    case "whatsapp": return <MessageCircle className="h-4 w-4" />;
    case "email": return <Mail className="h-4 w-4" />;
    case "sms": return <Phone className="h-4 w-4" />;
    case "telefone": return <Phone className="h-4 w-4" />;
    default: return <MessageCircle className="h-4 w-4" />;
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function NurturingCampaignsPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Queries
  const { data: dashboard, isLoading: dashLoading } = useNurturingDashboard();
  const { data: campaignsData, isLoading: campsLoading } = useNurturingCampaigns();
  const { data: campaignDetail } = useNurturingCampaignDetail(selectedCampaignId);

  // Mutations
  const createCampaign = useCreateNurturingCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const addContacts = useAddNurturingContacts();
  const updateContact = useUpdateContactStep();
  const generateContent = useGenerateNurturingContent();

  // Create form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    goal: "engajamento",
    target_segment: "todos",
    channels: ["whatsapp"] as string[],
    steps: [
      { step_order: 1, channel: "whatsapp" as NurturingChannel, delay_hours: 0, subject: "", message_template: "", is_active: true },
      { step_order: 2, channel: "whatsapp" as NurturingChannel, delay_hours: 48, subject: "", message_template: "", is_active: true },
      { step_order: 3, channel: "email" as NurturingChannel, delay_hours: 120, subject: "", message_template: "", is_active: true },
    ] as NurturingStep[],
  });

  // Content generator state
  const [genChannel, setGenChannel] = useState<NurturingChannel>("whatsapp");
  const [genGoal, setGenGoal] = useState("engajamento");
  const [genContext, setGenContext] = useState("");
  const [genTone, setGenTone] = useState("consultivo");
  const [genStep, setGenStep] = useState(1);

  const campaigns = campaignsData?.campaigns || [];

  // ── Handlers ────────────────────────────────────────────────

  function handleCreate() {
    if (!form.name.trim()) return;
    createCampaign.mutate({
      name: form.name,
      description: form.description,
      goal: form.goal,
      target_segment: form.target_segment,
      channels: form.channels,
      steps: form.steps,
    }, {
      onSuccess: () => {
        setShowCreateDialog(false);
        setForm(prev => ({ ...prev, name: "", description: "" }));
      },
    });
  }

  function addStep() {
    const last = form.steps[form.steps.length - 1];
    setForm(prev => ({
      ...prev,
      steps: [...prev.steps, {
        step_order: prev.steps.length + 1,
        channel: "whatsapp" as NurturingChannel,
        delay_hours: (last?.delay_hours || 0) + 72,
        subject: "",
        message_template: "",
        is_active: true,
      }],
    }));
  }

  function removeStep(idx: number) {
    if (form.steps.length <= 1) return;
    setForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 })),
    }));
  }

  function updateStep(idx: number, field: string, value: unknown) {
    setForm(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  }

  function copyToClipboard(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  // ── Dashboard Tab ───────────────────────────────────────────

  function renderDashboard() {
    if (dashLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (!dashboard) return <p className="text-muted-foreground py-8 text-center">Sem dados</p>;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Campanhas" value={dashboard.total_campaigns} icon={Megaphone} />
          <KpiCard title="Contatos totais" value={dashboard.contacts.total} icon={Users} />
          <KpiCard title="Taxa de resposta" value={`${dashboard.avg_response_rate}%`} icon={MessageCircle} />
          <KpiCard title="Conversões" value={dashboard.contacts.converted} subtitle={`${dashboard.conversion_rate}% taxa`} icon={TrendingUp} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Por Status</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(dashboard.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={STATUS_COLORS[status as CampaignStatus] || "bg-gray-100"}>
                      {STATUS_LABELS[status as CampaignStatus] || status}
                    </Badge>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Por Canal</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboard.by_channel.map((ch) => (
                  <div key={ch.channel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChannelIcon channel={ch.channel} />
                      <span className="text-sm">{CHANNEL_LABELS[ch.channel as NurturingChannel] || ch.channel}</span>
                    </div>
                    <span className="font-medium">{ch.count}</span>
                  </div>
                ))}
                {dashboard.by_channel.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha ainda</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Funil de Contatos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4 text-center">
              {[
                { label: "Total", value: dashboard.contacts.total, color: "bg-blue-500" },
                { label: "Ativos", value: dashboard.contacts.active, color: "bg-green-500" },
                { label: "Concluídos", value: dashboard.contacts.completed, color: "bg-cyan-500" },
                { label: "Opt-out", value: dashboard.contacts.opted_out, color: "bg-orange-500" },
                { label: "Convertidos", value: dashboard.contacts.converted, color: "bg-emerald-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className={`h-2 rounded-full ${item.color} mb-2`} style={{
                    width: `${dashboard.contacts.total > 0 ? Math.max(10, (item.value / dashboard.contacts.total) * 100) : 10}%`,
                  }} />
                  <p className="text-lg font-bold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Campaigns Tab ───────────────────────────────────────────

  function renderCampaigns() {
    if (campsLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Campanhas ({campaigns.length})</h3>
          <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />Nova Campanha</Button>
        </div>

        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhuma campanha de nurturing criada.</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />Criar primeira campanha
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((camp) => {
              const d = camp.action_details;
              const status = (d.status || camp.status || "draft") as CampaignStatus;
              const metrics = d.metrics || { total_contacts: 0, active_contacts: 0, completed: 0, converted: 0, response_rate: 0 };
              const steps = d.steps || [];
              const totalSteps = steps.length;
              const progress = metrics.total_contacts > 0 && totalSteps > 0
                ? Math.round((metrics.completed / metrics.total_contacts) * 100)
                : 0;

              return (
                <Card key={camp.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{d.name || "Sem nome"}</h4>
                          <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
                        </div>
                        {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        {status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => pauseCampaign.mutate(camp.id)}>
                            <Pause className="h-3 w-3 mr-1" />Pausar
                          </Button>
                        )}
                        {(status === "draft" || status === "paused") && (
                          <Button size="sm" variant="outline" onClick={() => resumeCampaign.mutate(camp.id)}>
                            <Play className="h-3 w-3 mr-1" />Ativar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => {
                          setSelectedCampaignId(camp.id);
                          setActiveTab("detail");
                        }}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {(d.channels || []).map((ch: string) => (
                        <Badge key={ch} variant="outline" className="text-xs">
                          <ChannelIcon channel={ch} />
                          <span className="ml-1">{CHANNEL_LABELS[ch as NurturingChannel] || ch}</span>
                        </Badge>
                      ))}
                      <Badge variant="outline" className="text-xs">{totalSteps} passos</Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-center text-sm mb-3">
                      <div><p className="font-bold">{metrics.total_contacts}</p><p className="text-xs text-muted-foreground">Contatos</p></div>
                      <div><p className="font-bold">{metrics.active_contacts}</p><p className="text-xs text-muted-foreground">Ativos</p></div>
                      <div><p className="font-bold">{metrics.converted}</p><p className="text-xs text-muted-foreground">Convertidos</p></div>
                      <div><p className="font-bold">{metrics.response_rate}%</p><p className="text-xs text-muted-foreground">Resposta</p></div>
                    </div>

                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{progress}% concluído</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Campaign Detail (sub-tab) ───────────────────────────────

  function renderDetail() {
    if (!campaignDetail) return <p className="text-muted-foreground py-8 text-center">Selecione uma campanha</p>;

    const d = campaignDetail.action_details;
    const steps = d.steps || [];
    const contacts = d.contacts || [];
    const metrics = d.metrics || { total_contacts: 0, active_contacts: 0, completed: 0, opted_out: 0, converted: 0, open_rate: 0, response_rate: 0 };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => { setActiveTab("campaigns"); setSelectedCampaignId(null); }}>
              ← Voltar
            </Button>
            <h3 className="text-lg font-semibold mt-2">{d.name}</h3>
            {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
          </div>
          <Badge className={STATUS_COLORS[(d.status || "draft") as CampaignStatus]}>
            {STATUS_LABELS[(d.status || "draft") as CampaignStatus]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Contatos" value={metrics.total_contacts} icon={Users} />
          <KpiCard title="Open Rate" value={`${metrics.open_rate}%`} icon={Mail} />
          <KpiCard title="Response Rate" value={`${metrics.response_rate}%`} icon={MessageCircle} />
          <KpiCard title="Convertidos" value={metrics.converted} icon={TrendingUp} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Sequência ({steps.length} passos)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {steps.map((step: NurturingStep, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {step.step_order}
                    </div>
                    {idx < steps.length - 1 && <div className="w-0.5 h-6 bg-border mt-1" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={CHANNEL_COLORS[step.channel] || "bg-gray-100"}>
                        <ChannelIcon channel={step.channel} />
                        <span className="ml-1">{CHANNEL_LABELS[step.channel]}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {step.delay_hours === 0 ? "Imediato" : `+${step.delay_hours}h`}
                      </span>
                    </div>
                    {step.subject && <p className="text-sm font-medium mt-1">Assunto: {step.subject}</p>}
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {step.message_template || "Sem mensagem definida"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Contatos ({contacts.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => {
                addContacts.mutate({
                  campaign_id: campaignDetail.id,
                  segment_filter: { status: "novo" },
                });
              }} disabled={addContacts.isPending}>
                {addContacts.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Adicionar leads "Novo"
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato na campanha</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {contacts.map((c, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="text-sm font-medium">{c.lead_name}</p>
                      <p className="text-xs text-muted-foreground">Passo {c.current_step}/{steps.length}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {CONTACT_STATUS_LABELS[c.status as ContactStatus] || c.status}
                      </Badge>
                      {c.status === "active" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                            updateContact.mutate({
                              campaign_id: campaignDetail.id,
                              lead_id: c.lead_id,
                              new_step: c.current_step + 1,
                              interaction: true,
                            });
                          }}>Avançar</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={() => {
                            updateContact.mutate({
                              campaign_id: campaignDetail.id,
                              lead_id: c.lead_id,
                              new_status: "converted" as ContactStatus,
                            });
                          }}>Converteu</Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Content Generator Tab ───────────────────────────────────

  function renderContentGenerator() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />Gerador de Conteúdo IA</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Canal</Label>
                <Select value={genChannel} onValueChange={(v) => setGenChannel(v as NurturingChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Objetivo</Label>
                <Select value={genGoal} onValueChange={setGenGoal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tom</Label>
                <Select value={genTone} onValueChange={setGenTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="consultivo">Consultivo</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Passo nº</Label>
                <Input type="number" min={1} max={10} value={genStep} onChange={(e) => setGenStep(Number(e.target.value))} />
              </div>
            </div>

            <div>
              <Label>Contexto (opcional)</Label>
              <Textarea
                placeholder="Ex: Apartamento 3 quartos no Jardins, lançamento, R$ 850K..."
                value={genContext}
                onChange={(e) => setGenContext(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              onClick={() => generateContent.mutate({ channel: genChannel, goal: genGoal, context: genContext, tone: genTone, step_number: genStep })}
              disabled={generateContent.isPending}
            >
              {generateContent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar Conteúdo
            </Button>
          </CardContent>
        </Card>

        {generateContent.data && (
          <div className="space-y-4">
            {generateContent.data.subject && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Assunto (E-mail)</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-sm">{generateContent.data.subject}</p>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generateContent.data!.subject, 0)}>
                      {copiedIdx === 0 ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-sm">Mensagem Principal</CardTitle></CardHeader>
              <CardContent>
                <div className="relative">
                  <p className="text-sm whitespace-pre-wrap pr-8">{generateContent.data.message}</p>
                  <Button size="sm" variant="ghost" className="absolute top-0 right-0" onClick={() => copyToClipboard(generateContent.data!.message, 1)}>
                    {copiedIdx === 1 ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                {generateContent.data.cta && (
                  <Badge className="mt-3 bg-primary/10 text-primary">CTA: {generateContent.data.cta}</Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Variante A/B</CardTitle></CardHeader>
              <CardContent>
                <div className="relative">
                  <p className="text-sm whitespace-pre-wrap pr-8">{generateContent.data.ab_variant}</p>
                  <Button size="sm" variant="ghost" className="absolute top-0 right-0" onClick={() => copyToClipboard(generateContent.data!.ab_variant, 2)}>
                    {copiedIdx === 2 ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Melhor Horário</CardTitle></CardHeader>
                <CardContent><p className="text-sm">{generateContent.data.timing_tip}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Dicas de Personalização</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {generateContent.data.personalization_tips.map((tip: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">•</span>{tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create Campaign Dialog ──────────────────────────────────

  function renderCreateDialog() {
    return (
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha de Nurturing</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Reativação leads frios" />
              </div>
              <div>
                <Label>Objetivo</Label>
                <Select value={form.goal} onValueChange={(v) => setForm(p => ({ ...p, goal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Sequência de Passos ({form.steps.length})</Label>
                <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3 w-3 mr-1" />Passo</Button>
              </div>

              <div className="space-y-3">
                {form.steps.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Passo {idx + 1}</span>
                      {form.steps.length > 1 && (
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500" onClick={() => removeStep(idx)}>Remover</Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Canal</Label>
                        <Select value={step.channel} onValueChange={(v) => updateStep(idx, "channel", v)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Delay (horas)</Label>
                        <Input type="number" className="h-8" min={0} value={step.delay_hours}
                          onChange={(e) => updateStep(idx, "delay_hours", Number(e.target.value))} />
                      </div>
                      {step.channel === "email" && (
                        <div>
                          <Label className="text-xs">Assunto</Label>
                          <Input className="h-8" value={step.subject || ""} onChange={(e) => updateStep(idx, "subject", e.target.value)} />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Mensagem</Label>
                      <Textarea rows={2} value={step.message_template}
                        onChange={(e) => updateStep(idx, "message_template", e.target.value)}
                        placeholder="Use {nome} como placeholder..." />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createCampaign.isPending || !form.name.trim()}>
              {createCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Nurturing Multi-Canal
          </h1>
          <p className="text-muted-foreground">Campanhas de nutrição de leads com sequências automatizadas</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />Nova Campanha
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns"><Megaphone className="h-4 w-4 mr-2" />Campanhas</TabsTrigger>
          <TabsTrigger value="content"><Sparkles className="h-4 w-4 mr-2" />Conteúdo IA</TabsTrigger>
          {selectedCampaignId && <TabsTrigger value="detail"><Target className="h-4 w-4 mr-2" />Detalhe</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard">{renderDashboard()}</TabsContent>
        <TabsContent value="campaigns">{renderCampaigns()}</TabsContent>
        <TabsContent value="content">{renderContentGenerator()}</TabsContent>
        <TabsContent value="detail">{renderDetail()}</TabsContent>
      </Tabs>

      {renderCreateDialog()}
    </div>
  );
}
