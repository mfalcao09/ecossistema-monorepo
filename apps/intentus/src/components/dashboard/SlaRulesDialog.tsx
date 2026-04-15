import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, Headset, Wrench, FileX, ScrollText, RotateCcw, Save, Loader2, Users, Handshake,
} from "lucide-react";
import type { SlaRules } from "@/lib/slaDefaults";

interface SlaRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRules: SlaRules;
  onSave: (rules: SlaRules) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving: boolean;
  isResetting: boolean;
}

const priorityLabels: Record<string, string> = {
  urgente_hours: "Urgente",
  alta_hours: "Alta",
  media_hours: "Média",
  baixa_hours: "Baixa",
};

const sections = [
  {
    key: "tickets" as const,
    label: "Atendimento (Tickets)",
    icon: Headset,
    accentBg: "bg-blue-50 dark:bg-blue-950/40",
    accentBorder: "border-blue-200 dark:border-blue-800",
    accentIcon: "text-blue-600 dark:text-blue-400",
    unit: "horas",
    description: "Prazo máximo para resolução de tickets por prioridade",
    fields: ["urgente_hours", "alta_hours", "media_hours", "baixa_hours"] as const,
  },
  {
    key: "manutencao" as const,
    label: "Manutenção",
    icon: Wrench,
    accentBg: "bg-amber-50 dark:bg-amber-950/40",
    accentBorder: "border-amber-200 dark:border-amber-800",
    accentIcon: "text-amber-600 dark:text-amber-400",
    unit: "horas",
    description: "Prazo máximo para conclusão de manutenções por prioridade",
    fields: ["urgente_hours", "alta_hours", "media_hours", "baixa_hours"] as const,
  },
] as const;

export default function SlaRulesDialog({
  open, onOpenChange, currentRules, onSave, onReset, isSaving, isResetting,
}: SlaRulesDialogProps) {
  const [draft, setDraft] = useState<SlaRules>(currentRules);

  useEffect(() => {
    if (open) setDraft(currentRules);
  }, [open, currentRules]);

  const updateField = (section: keyof SlaRules, field: string, value: number) => {
    setDraft((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: Math.max(1, value) },
    }));
  };

  const toggleSection = (section: keyof SlaRules, enabled: boolean) => {
    setDraft((prev) => ({
      ...prev,
      [section]: { ...prev[section], enabled },
    }));
  };

  const handleSave = async () => {
    await onSave(draft);
    onOpenChange(false);
  };

  const handleReset = async () => {
    await onReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Regras de SLA</DialogTitle>
              <DialogDescription>
                Configure os prazos de SLA para cada área da sua operação
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tickets & Manutenção sections */}
          {sections.map((section) => {
            const sectionData = draft[section.key] as Record<string, any>;
            const Icon = section.icon;
            return (
              <Card key={section.key} className={`${section.accentBorder} ${!sectionData.enabled ? "opacity-60" : ""} transition-opacity`}>
                <CardHeader className={`${section.accentBg} rounded-t-lg py-3 px-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${section.accentIcon}`} />
                      <CardTitle className="text-sm font-semibold">{section.label}</CardTitle>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {section.unit}
                      </Badge>
                    </div>
                    <Switch
                      checked={sectionData.enabled}
                      onCheckedChange={(v) => toggleSection(section.key, v)}
                    />
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
                            <Input
                              type="number"
                              min={1}
                              value={sectionData[field]}
                              onChange={(e) => updateField(section.key, field, parseInt(e.target.value) || 1)}
                              className="h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">h</span>
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
                <Switch
                  checked={draft.rescisoes.enabled}
                  onCheckedChange={(v) => toggleSection("rescisoes", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Prazo máximo para conclusão do processo de rescisão
              </p>
            </CardHeader>
            {draft.rescisoes.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="space-y-1 max-w-[200px]">
                  <Label className="text-xs font-medium">Prazo Máximo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={draft.rescisoes.prazo_max_dias}
                      onChange={(e) => updateField("rescisoes", "prazo_max_dias", parseInt(e.target.value) || 1)}
                      className="h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
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
                <Switch
                  checked={draft.renovacoes.enabled}
                  onCheckedChange={(v) => toggleSection("renovacoes", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Dias de antecedência para iniciar o processo de renovação
              </p>
            </CardHeader>
            {draft.renovacoes.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Antecedência</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.renovacoes.antecedencia_dias}
                        onChange={(e) => updateField("renovacoes", "antecedencia_dias", parseInt(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Prazo p/ Finalização</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.renovacoes.prazo_finalizacao_dias}
                        onChange={(e) => updateField("renovacoes", "prazo_finalizacao_dias", parseInt(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comercial</p>

          {/* Leads (Comercial) */}
          <Card className={`border-cyan-200 dark:border-cyan-800 ${!draft.leads.enabled ? "opacity-60" : ""} transition-opacity`}>
            <CardHeader className="bg-cyan-50 dark:bg-cyan-950/40 rounded-t-lg py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <CardTitle className="text-sm font-semibold">Leads (Comercial)</CardTitle>
                </div>
                <Switch
                  checked={draft.leads.enabled}
                  onCheckedChange={(v) => toggleSection("leads", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Prazos para primeiro contato e follow-up com leads
              </p>
            </CardHeader>
            {draft.leads.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Primeiro Contato</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.leads.primeiro_contato_hours}
                        onChange={(e) => updateField("leads", "primeiro_contato_hours", parseInt(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">horas</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Follow-up</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.leads.followup_dias}
                        onChange={(e) => updateField("leads", "followup_dias", parseInt(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Negócios (Comercial) */}
          <Card className={`border-indigo-200 dark:border-indigo-800 ${!draft.negocios.enabled ? "opacity-60" : ""} transition-opacity`}>
            <CardHeader className="bg-indigo-50 dark:bg-indigo-950/40 rounded-t-lg py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-sm font-semibold">Negócios (Comercial)</CardTitle>
                </div>
                <Switch
                  checked={draft.negocios.enabled}
                  onCheckedChange={(v) => toggleSection("negocios", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Prazos máximos por etapa e para conclusão total do negócio
              </p>
            </CardHeader>
            {draft.negocios.enabled && (
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Tempo por Etapa</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.negocios.tempo_etapa_dias}
                        onChange={(e) => updateField("negocios", "tempo_etapa_dias", parseInt(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Conclusão Total</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.negocios.conclusao_total_dias}
                        onChange={(e) => updateField("negocios", "conclusao_total_dias", parseInt(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        <Separator />

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isResetting || isSaving}
            className="gap-1"
          >
            {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Restaurar Padrão
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isResetting}
            className="gap-1"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar Regras
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
