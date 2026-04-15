/**
 * LeadCaptureSettings — Dashboard e configuração de captação multi-canal.
 * Rota: /comercial/captacao-canais
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  useCaptureDashboard,
  useCaptureConfigs,
  useCaptureLog,
  useSaveCaptureConfig,
  CHANNEL_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type CaptureChannel,
  type LeadCaptureConfig,
} from "@/hooks/useLeadCapture";
import {
  Globe,
  FileText,
  MessageCircle,
  Mail,
  Building2,
  Users,
  Phone,
  Code,
  Webhook,
  MessageSquare,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  TrendingUp,
  Radio,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ─── Icon map ────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Globe, FileText, MessageCircle, Mail, Building2,
  Users, Phone, Code, Webhook, MessageSquare,
};

const CHANNEL_ICON_MAP: Record<CaptureChannel, LucideIcon> = {
  site: Globe,
  landing_page: FileText,
  whatsapp: MessageCircle,
  email_form: Mail,
  portal: Building2,
  indicacao: Users,
  telefone: Phone,
  api: Code,
  webhook: Webhook,
  chat_widget: MessageSquare,
};

const ALL_CHANNELS: CaptureChannel[] = [
  "site", "landing_page", "whatsapp", "email_form", "portal",
  "indicacao", "telefone", "api", "webhook", "chat_widget",
];

// ─── Main Component ──────────────────────────────────────────────────────────
export function LeadCaptureSettings() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading: dashLoading, isError: dashError } = useCaptureDashboard();
  const { data: configs } = useCaptureConfigs();
  const { data: logs } = useCaptureLog();
  const saveConfig = useSaveCaptureConfig();

  const [selectedChannel, setSelectedChannel] = useState<CaptureChannel | null>(null);

  // Build config map
  const configMap = useMemo(() => {
    const map = new Map<string, LeadCaptureConfig>();
    if (configs) {
      for (const c of configs) map.set(c.channel, c);
    }
    return map;
  }, [configs]);

  const handleToggleChannel = (channel: CaptureChannel, enabled: boolean) => {
    saveConfig.mutate({ channel, is_enabled: enabled });
  };

  const handleToggleAutoAssign = (channel: CaptureChannel, enabled: boolean) => {
    saveConfig.mutate({ channel, auto_assign: enabled });
  };

  const handleToggleAutoScore = (channel: CaptureChannel, enabled: boolean) => {
    saveConfig.mutate({ channel, auto_score: enabled });
  };

  const webhookUrl = `${window.location.origin.includes("localhost") ? "https://bvryaopfjiyxjgsuhjsb.supabase.co" : "https://bvryaopfjiyxjgsuhjsb.supabase.co"}/functions/v1/commercial-lead-capture`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/leads")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            Captação Multi-Canal
            {dashLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure e monitore canais de captação de leads
          </p>
        </div>
      </div>

      {/* Error state */}
      {dashError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">
              Erro ao carregar dashboard de captação
            </span>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Captações 30d" value={dashboard.kpis.total_30d} icon={TrendingUp} />
          <KPICard label="Captações 7d" value={dashboard.kpis.total_7d} icon={Radio} />
          <KPICard label="Novos Leads" value={dashboard.kpis.new_leads} icon={CheckCircle2} color="text-green-600" />
          <KPICard label="Duplicados" value={dashboard.kpis.duplicates} icon={Users} color="text-amber-600" />
          <KPICard label="Spam Bloqueado" value={dashboard.kpis.spam_blocked} icon={ShieldAlert} color="text-gray-500" />
          <KPICard label="Taxa Conversão" value={`${dashboard.kpis.conversion_rate}%`} icon={TrendingUp} color="text-primary" />
        </div>
      )}

      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="log">Histórico</TabsTrigger>
          <TabsTrigger value="webhook">API/Webhook</TabsTrigger>
        </TabsList>

        {/* ── Channels tab ──────────────────────────────────────────── */}
        <TabsContent value="channels" className="space-y-3 mt-4">
          {ALL_CHANNELS.map((channel) => {
            const config = configMap.get(channel);
            const isEnabled = config?.is_enabled ?? false;
            const stat = dashboard?.channel_stats.find((s) => s.channel === channel);
            const Icon = CHANNEL_ICON_MAP[channel];

            return (
              <Card key={channel} className={!isEnabled ? "opacity-60" : ""}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`h-5 w-5 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{CHANNEL_LABELS[channel]}</span>
                      {isEnabled && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    {stat && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{stat.total} capturas 30d</span>
                        <span>{stat.success} novos</span>
                        <span>{stat.last_7d} últimos 7d</span>
                      </div>
                    )}
                    {!stat && isEnabled && (
                      <p className="text-xs text-muted-foreground mt-0.5">Nenhuma captura registrada</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {isEnabled && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={config?.auto_assign ?? false}
                            onCheckedChange={(v) => handleToggleAutoAssign(channel, v)}
                            className="scale-75"
                          />
                          <Label className="text-[10px] text-muted-foreground">Auto-assign</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={config?.auto_score ?? false}
                            onCheckedChange={(v) => handleToggleAutoScore(channel, v)}
                            className="scale-75"
                          />
                          <Label className="text-[10px] text-muted-foreground">Auto-score</Label>
                        </div>
                      </>
                    )}
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(v) => handleToggleChannel(channel, v)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── Log tab ──────────────────────────────────────────────── */}
        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Últimas Capturas</CardTitle>
            </CardHeader>
            <CardContent>
              {!logs || logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma captura registrada
                </p>
              ) : (
                <div className="space-y-2">
                  {logs.map((entry) => {
                    const Icon = CHANNEL_ICON_MAP[entry.channel as CaptureChannel] || Globe;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Badge className={`${STATUS_COLORS[entry.processing_status] || ""} text-[10px] px-1.5`}>
                          {STATUS_LABELS[entry.processing_status] || entry.processing_status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{CHANNEL_LABELS[entry.channel as CaptureChannel] || entry.channel}</span>
                        <span className="flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Webhook tab ──────────────────────────────────────────── */}
        <TabsContent value="webhook" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Endpoint de Captação (Público)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Use esta URL para integrar formulários externos, landing pages, webhooks de portais imobiliários ou qualquer sistema que gere leads.
              </p>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <code className="text-xs flex-1 break-all select-all">{webhookUrl}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyWebhookUrl}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-medium">Exemplo de payload (POST JSON):</p>
                <pre className="text-[11px] bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre">{`{
  "tenant_slug": "sua-empresa",
  "channel": "landing_page",
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "(11) 99999-0000",
  "message": "Tenho interesse no apartamento 2 quartos",
  "property_id": "uuid-do-imovel",
  "interest_type": "aluguel",
  "budget_min": 1500,
  "budget_max": 3000,
  "preferred_region": "Centro, Piracicaba"
}`}</pre>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Campos obrigatórios:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-4 list-disc">
                  <li><code className="text-[10px]">tenant_slug</code> ou <code className="text-[10px]">domain</code> — identificador da empresa</li>
                  <li><code className="text-[10px]">name</code> — nome do lead</li>
                  <li><code className="text-[10px]">email</code> ou <code className="text-[10px]">phone</code> — pelo menos um contato</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Canais disponíveis:</p>
                <div className="flex flex-wrap gap-1">
                  {ALL_CHANNELS.map((ch) => (
                    <Badge key={ch} variant="outline" className="text-[10px]">
                      {ch}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
