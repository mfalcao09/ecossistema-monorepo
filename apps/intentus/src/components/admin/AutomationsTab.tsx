import { useState, useEffect } from "react";
import { useSlaRules } from "@/hooks/useSlaRules";
import { useFinanceAutomations } from "@/hooks/useFinanceAutomations";
import { useCommunicationSequences, triggerEventLabels } from "@/hooks/useCommunicationSequences";
import { useCollectionRules, collectionActionLabels } from "@/hooks/useCollectionRules";
import { useTenantModules } from "@/hooks/useTenantModules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, Headset, Wrench, FileX, ScrollText, Users, Handshake,
  RotateCcw, Save, Loader2, ExternalLink, Zap, Send, AlertTriangle, Lock,
} from "lucide-react";
import type { SlaRules } from "@/lib/slaDefaults";

const priorityLabels: Record<string, string> = {
  urgente_hours: "Urgente",
  alta_hours: "Alta",
  media_hours: "Média",
  baixa_hours: "Baixa",
};

const slaSections = [
  { key: "tickets" as const, label: "Atendimento (Tickets)", icon: Headset, color: "blue", unit: "horas", description: "Prazo máximo para resolução de tickets por prioridade", fields: ["urgente_hours", "alta_hours", "media_hours", "baixa_hours"] as const },
  { key: "manutencao" as const, label: "Manutenção", icon: Wrench, color: "amber", unit: "horas", description: "Prazo máximo para conclusão de manutenções", fields: ["urgente_hours", "alta_hours", "media_hours", "baixa_hours"] as const },
] as const;

function UpgradeCard({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  const navigate = useNavigate();
  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-3 text-center py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Disponível nos planos superiores ou como módulo extra.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/modulos")}>
            Ver Módulos Extras
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AutomationsTab() {
  const navigate = useNavigate();
  const { hasModule } = useTenantModules();
  const { rules: slaRules, isLoading: slaLoading, save: saveSla, isSaving: slaSaving, reset: resetSla, isResetting: slaResetting } = useSlaRules();

  const hasFinanceAutomations = hasModule("addon_automacoes_financeiro");
  const hasCommunicationSequences = hasModule("addon_regua_comunicacao");
  const hasCollectionRules = hasModule("financeiro_basico");

  const { automations: finAutomations, isLoading: finLoading, toggleActive } = useFinanceAutomations();
  const { data: sequences, isLoading: seqLoading } = useCommunicationSequences();
  const { data: collectionRules, isLoading: colLoading } = useCollectionRules();

  const [draft, setDraft] = useState<SlaRules>(slaRules);

  useEffect(() => { setDraft(slaRules); }, [slaRules]);

  const updateField = (section: keyof SlaRules, field: string, value: number) => {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], [field]: Math.max(1, value) } }));
  };

  const toggleSection = (section: keyof SlaRules, enabled: boolean) => {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], enabled } }));
  };

  const handleSaveSla = async () => { await saveSla(draft); };
  const handleResetSla = async () => { await resetSla(); };

  return (
    <div className="space-y-8">
      {/* ===== SLA RULES ===== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Regras de SLA</h3>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleResetSla} disabled={slaResetting || slaSaving}>
              {slaResetting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />} Restaurar Padrão
            </Button>
            <Button size="sm" onClick={handleSaveSla} disabled={slaSaving || slaResetting}>
              {slaSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar SLA
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Tickets & Manutenção */}
          {slaSections.map((section) => {
            const sectionData = draft[section.key] as Record<string, any>;
            const Icon = section.icon;
            return (
              <Card key={section.key} className={`border-${section.color}-200 dark:border-${section.color}-800 ${!sectionData.enabled ? "opacity-60" : ""} transition-opacity`}>
                <CardHeader className={`bg-${section.color}-50 dark:bg-${section.color}-950/40 rounded-t-lg py-3 px-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 text-${section.color}-600 dark:text-${section.color}-400`} />
                      <CardTitle className="text-sm font-semibold">{section.label}</CardTitle>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{section.unit}</Badge>
                    </div>
                    <Switch checked={sectionData.enabled} onCheckedChange={(v) => toggleSection(section.key, v)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                </CardHeader>
                {sectionData.enabled && (
                  <CardContent className="pt-4 pb-3">
                    <div className="grid grid-cols-2 gap-3">
                      {section.fields.map((field) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-xs font-medium">{priorityLabels[field]}</Label>
                          <div className="flex items-center gap-2">
                            <Input type="number" min={1} value={sectionData[field]} onChange={(e) => updateField(section.key, field, parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                            <span className="text-xs text-muted-foreground">h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Rescisões */}
          <Card className={`border-red-200 dark:border-red-800 ${!draft.rescisoes.enabled ? "opacity-60" : ""} transition-opacity`}>
            <CardHeader className="bg-red-50 dark:bg-red-950/40 rounded-t-lg py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileX className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <CardTitle className="text-sm font-semibold">Rescisões</CardTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">dias</Badge>
                </div>
                <Switch checked={draft.rescisoes.enabled} onCheckedChange={(v) => toggleSection("rescisoes", v)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Prazo máximo para conclusão do processo de rescisão</p>
            </CardHeader>
            {draft.rescisoes.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="space-y-1 max-w-[200px]">
                  <Label className="text-xs font-medium">Prazo Máximo</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} value={draft.rescisoes.prazo_max_dias} onChange={(e) => updateField("rescisoes", "prazo_max_dias", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                    <span className="text-xs text-muted-foreground">dias</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Renovações */}
          <Card className={`border-green-200 dark:border-green-800 ${!draft.renovacoes.enabled ? "opacity-60" : ""} transition-opacity`}>
            <CardHeader className="bg-green-50 dark:bg-green-950/40 rounded-t-lg py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <CardTitle className="text-sm font-semibold">Renovações</CardTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">dias</Badge>
                </div>
                <Switch checked={draft.renovacoes.enabled} onCheckedChange={(v) => toggleSection("renovacoes", v)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Dias de antecedência para iniciar o processo de renovação</p>
            </CardHeader>
            {draft.renovacoes.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Antecedência</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={draft.renovacoes.antecedencia_dias} onChange={(e) => updateField("renovacoes", "antecedencia_dias", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Prazo p/ Finalização</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={draft.renovacoes.prazo_finalizacao_dias} onChange={(e) => updateField("renovacoes", "prazo_finalizacao_dias", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comercial</p>

          {/* Leads */}
          <Card className={`border-cyan-200 dark:border-cyan-800 ${!draft.leads.enabled ? "opacity-60" : ""} transition-opacity`}>
            <CardHeader className="bg-cyan-50 dark:bg-cyan-950/40 rounded-t-lg py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <CardTitle className="text-sm font-semibold">Leads (Comercial)</CardTitle>
                </div>
                <Switch checked={draft.leads.enabled} onCheckedChange={(v) => toggleSection("leads", v)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Prazos para primeiro contato e follow-up</p>
            </CardHeader>
            {draft.leads.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Primeiro Contato</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={draft.leads.primeiro_contato_hours} onChange={(e) => updateField("leads", "primeiro_contato_hours", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                      <span className="text-xs text-muted-foreground">horas</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Follow-up</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={draft.leads.followup_dias} onChange={(e) => updateField("leads", "followup_dias", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Negócios */}
          <Card className={`border-indigo-200 dark:border-indigo-800 ${!draft.negocios.enabled ? "opacity-60" : ""} transition-opacity`}>
            <CardHeader className="bg-indigo-50 dark:bg-indigo-950/40 rounded-t-lg py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-sm font-semibold">Negócios (Comercial)</CardTitle>
                </div>
                <Switch checked={draft.negocios.enabled} onCheckedChange={(v) => toggleSection("negocios", v)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Prazos máximos por etapa e para conclusão total</p>
            </CardHeader>
            {draft.negocios.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Tempo por Etapa</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={draft.negocios.tempo_etapa_dias} onChange={(e) => updateField("negocios", "tempo_etapa_dias", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Conclusão Total</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={draft.negocios.conclusao_total_dias} onChange={(e) => updateField("negocios", "conclusao_total_dias", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Separator />

      {/* ===== AUTOMAÇÕES FINANCEIRAS ===== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">Automações Financeiras</h3>
          </div>
          {hasFinanceAutomations && (
            <Button size="sm" variant="outline" onClick={() => navigate("/financeiro/automacoes")}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Gerenciar
            </Button>
          )}
        </div>
        {hasFinanceAutomations ? (
          <Card>
            <CardContent className="pt-6">
              {finLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (finAutomations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma automação financeira configurada.</p>
              ) : (
                <div className="space-y-2">
                  {(finAutomations ?? []).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div className="flex items-center gap-3">
                        <Badge variant={a.active ? "default" : "secondary"} className="text-[10px]">{a.active ? "Ativa" : "Inativa"}</Badge>
                        <span className="text-sm font-medium">{a.name}</span>
                      </div>
                      <Switch checked={a.active} onCheckedChange={(v) => toggleActive.mutate({ id: a.id, active: v })} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <UpgradeCard title="Automações Financeiras" icon={Zap} />
        )}
      </div>

      <Separator />

      {/* ===== RÉGUAS DE COMUNICAÇÃO ===== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Réguas de Comunicação</h3>
          </div>
          {hasCommunicationSequences && (
            <Button size="sm" variant="outline" onClick={() => navigate("/relacionamento/regua")}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Gerenciar
            </Button>
          )}
        </div>
        {hasCommunicationSequences ? (
          <Card>
            <CardContent className="pt-6">
              {seqLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (sequences ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma régua configurada.</p>
              ) : (
                <div className="space-y-2">
                  {(sequences ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div className="flex items-center gap-3">
                        <Badge variant={s.active ? "default" : "secondary"} className="text-[10px]">{s.active ? "Ativa" : "Inativa"}</Badge>
                        <span className="text-sm font-medium">{s.name}</span>
                        <Badge variant="outline" className="text-[10px]">{triggerEventLabels[s.trigger_event] || s.trigger_event}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <UpgradeCard title="Réguas de Comunicação" icon={Send} />
        )}
      </div>

      <Separator />

      {/* ===== REGRAS DE COBRANÇA ===== */}
      {hasCollectionRules && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold">Regras de Cobrança</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/financeiro/inadimplencia")}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Gerenciar
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {colLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (collectionRules ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma regra de cobrança configurada.</p>
              ) : (
                <div className="space-y-2">
                  {(collectionRules ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div className="flex items-center gap-3">
                        <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">{r.active ? "Ativa" : "Inativa"}</Badge>
                        <span className="text-sm font-medium">{r.name}</span>
                        <Badge variant="outline" className="text-[10px]">{r.days_after_due}d após vencimento</Badge>
                        <Badge variant="outline" className="text-[10px]">{collectionActionLabels[r.action_type] || r.action_type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
