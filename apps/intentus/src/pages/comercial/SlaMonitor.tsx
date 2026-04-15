/**
 * SlaMonitor v2 — Dashboard de SLA com engine backend.
 * Rota: /comercial/sla
 * Usa commercial-sla-engine EF para regras dinâmicas, violações, escalonamento.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, ShieldAlert, Clock, AlertTriangle, CheckCircle2, Users, Target,
  Loader2, Settings, History, RefreshCw, Save, type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useSlaEngineDashboard,
  useSlaHistory,
  useUpdateSlaRules,
  useCheckSlaViolations,
  SLA_TYPE_LABELS,
  SEVERITY_COLORS,
  DEAL_STATUS_LABELS,
  type SlaRules,
  type SlaViolation,
} from "@/hooks/useSlaEngineV2";

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KPI({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
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

// ─── Rules Editor ────────────────────────────────────────────────────────────

function RulesEditor({
  rules,
  onSave,
  isPending,
}: {
  rules: SlaRules;
  onSave: (rules: Partial<SlaRules>) => void;
  isPending: boolean;
}) {
  const [localRules, setLocalRules] = useState<SlaRules>(rules);

  const updateLeads = (key: string, value: any) => {
    setLocalRules((prev) => ({ ...prev, leads: { ...prev.leads, [key]: value } }));
  };

  const updateDeals = (key: string, value: any) => {
    setLocalRules((prev) => ({ ...prev, deals: { ...prev.deals, [key]: value } }));
  };

  const updateStageHours = (stage: string, value: number) => {
    setLocalRules((prev) => ({
      ...prev,
      deals: { ...prev.deals, stage_hours: { ...prev.deals.stage_hours, [stage]: value } },
    }));
  };

  const updateEscalation = (key: string, value: any) => {
    setLocalRules((prev) => ({ ...prev, escalation: { ...prev.escalation, [key]: value } }));
  };

  return (
    <div className="space-y-6">
      {/* Lead SLAs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">SLA de Leads</CardTitle>
            <Switch
              checked={localRules.leads.enabled}
              onCheckedChange={(v) => updateLeads("enabled", v)}
            />
          </div>
        </CardHeader>
        {localRules.leads.enabled && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Primeiro Contato (minutos)</Label>
                <Input
                  type="number"
                  value={localRules.leads.first_response_minutes}
                  onChange={(e) => updateLeads("first_response_minutes", Number(e.target.value))}
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Follow-up (horas)</Label>
                <Input
                  type="number"
                  value={localRules.leads.follow_up_hours}
                  onChange={(e) => updateLeads("follow_up_hours", Number(e.target.value))}
                  className="h-8 mt-1"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Deal SLAs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">SLA de Negócios</CardTitle>
            <Switch
              checked={localRules.deals.enabled}
              onCheckedChange={(v) => updateDeals("enabled", v)}
            />
          </div>
        </CardHeader>
        {localRules.deals.enabled && (
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Tempo Máximo Total (dias)</Label>
              <Input
                type="number"
                value={localRules.deals.max_total_days}
                onChange={(e) => updateDeals("max_total_days", Number(e.target.value))}
                className="h-8 mt-1 w-32"
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Tempo por Estágio (horas)</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(localRules.deals.stage_hours).map(([stage, hours]) => (
                  <div key={stage} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 truncate">
                      {DEAL_STATUS_LABELS[stage] || stage}
                    </span>
                    <Input
                      type="number"
                      value={hours}
                      onChange={(e) => updateStageHours(stage, Number(e.target.value))}
                      className="h-7 w-20 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">h</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Escalation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Escalonamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Alerta em % do SLA</Label>
              <Input
                type="number"
                value={localRules.escalation.warning_threshold_pct}
                onChange={(e) => updateEscalation("warning_threshold_pct", Number(e.target.value))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Crítico em % do SLA</Label>
              <Input
                type="number"
                value={localRules.escalation.critical_threshold_pct}
                onChange={(e) => updateEscalation("critical_threshold_pct", Number(e.target.value))}
                className="h-8 mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={localRules.escalation.auto_escalate}
                onCheckedChange={(v) => updateEscalation("auto_escalate", v)}
              />
              <Label className="text-xs">Auto-escalonar críticos</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={localRules.escalation.auto_notify}
                onCheckedChange={(v) => updateEscalation("auto_notify", v)}
              />
              <Label className="text-xs">Auto-notificar via Pulse</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => onSave(localRules)} disabled={isPending}>
        <Save className="h-4 w-4 mr-2" />
        {isPending ? "Salvando..." : "Salvar Regras"}
      </Button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function SlaMonitor() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading } = useSlaEngineDashboard();
  const { data: historyData } = useSlaHistory();
  const updateRules = useUpdateSlaRules();
  const checkViolations = useCheckSlaViolations();

  const handleSaveRules = (rules: Partial<SlaRules>) => {
    updateRules.mutate(rules, {
      onSuccess: () => toast.success("Regras de SLA atualizadas"),
      onError: () => toast.error("Erro ao salvar regras"),
    });
  };

  const handleRefresh = () => {
    checkViolations.mutate(undefined, {
      onSuccess: (data: any) =>
        toast.success(`Verificação concluída: ${data?.summary?.total_violations || 0} violações`),
      onError: () => toast.error("Erro na verificação"),
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" /> SLA Engine
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            Enforcement automático, regras dinâmicas e escalonamento inteligente
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={checkViolations.isPending}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${checkViolations.isPending ? "animate-spin" : ""}`} />
          Verificar agora
        </Button>
      </div>

      {/* KPIs */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI
            label="Violações"
            value={dashboard.summary.total_violations}
            icon={AlertTriangle}
            color={dashboard.summary.total_violations > 0 ? "text-red-600" : "text-green-600"}
          />
          <KPI label="Críticas" value={dashboard.summary.critical} icon={ShieldAlert} color="text-red-600" />
          <KPI
            label="Compliance"
            value={`${dashboard.compliance.first_response_rate}%`}
            icon={CheckCircle2}
            color={dashboard.compliance.first_response_rate >= 80 ? "text-green-600" : "text-red-600"}
          />
          <KPI
            label="Tempo Resposta"
            value={dashboard.compliance.avg_response_minutes > 0 ? `${dashboard.compliance.avg_response_minutes}min` : "—"}
            icon={Clock}
            color={dashboard.compliance.avg_response_minutes <= 60 ? "text-green-600" : "text-amber-600"}
          />
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-12" /></CardContent></Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="violations" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Violações
            {dashboard && (
              <Badge variant="secondary" className="ml-1 text-xs">{dashboard.summary.total_violations}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Settings className="h-4 w-4" /> Regras
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* Violations Tab */}
        <TabsContent value="violations">
          {dashboard && dashboard.violations.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Violações Ativas ({dashboard.violations.length})</CardTitle>
                <CardDescription>
                  {dashboard.summary.by_type.first_response} primeiro contato,{" "}
                  {dashboard.summary.by_type.follow_up} follow-up,{" "}
                  {dashboard.summary.by_type.stage_time} estágio,{" "}
                  {dashboard.summary.by_type.total_time} tempo total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-1.5 pr-3">
                    {dashboard.violations.map((v: SlaViolation, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0">
                        <Badge className={`${SEVERITY_COLORS[v.severity]} text-[9px] shrink-0`}>
                          {v.severity === "critical" ? "CRÍTICO" : "ALERTA"}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {SLA_TYPE_LABELS[v.sla_type] || v.sla_type}
                        </Badge>
                        <span className="font-medium truncate max-w-[200px]">{v.entity_name}</span>
                        <span className="text-muted-foreground shrink-0">
                          SLA: {v.sla_target_value}{v.sla_target_unit} | Real: {v.actual_value}{v.sla_target_unit}
                        </span>
                        <span className="flex-1" />
                        {v.assigned_name && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> {v.assigned_name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : dashboard && dashboard.violations.length === 0 ? (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="flex items-center gap-2 p-6">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Nenhuma violação de SLA ativa — Todos os prazos estão sendo cumpridos!
                </span>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          {dashboard?.rules ? (
            <RulesEditor
              rules={dashboard.rules}
              onSave={handleSaveRules}
              isPending={updateRules.isPending}
            />
          ) : (
            <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Histórico de Escalonamentos</CardTitle>
              <CardDescription>Registro de violações críticas detectadas e escalonamentos automáticos</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[50vh]">
                {historyData?.history && historyData.history.length > 0 ? (
                  <div className="space-y-2 pr-3">
                    {historyData.history.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 text-xs py-2 border-b last:border-0">
                        <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                          {entry.trigger_event === "sla_violation_critical" ? "AUTO" : "MANUAL"}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{entry.action_taken}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de escalonamento.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
