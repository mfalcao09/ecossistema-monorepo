import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export interface EnvelopeConfig {
  signature_type: string;
  deadline_at: string;
  reminder_interval: string;
  locale: string;
  pause_on_rejection: boolean;
  closing_mode: string;
  email_subject: string;
  email_message: string;
}

export const DEFAULT_CONFIG: EnvelopeConfig = {
  signature_type: "avancada",
  deadline_at: "",
  reminder_interval: "",
  locale: "pt-BR",
  pause_on_rejection: true,
  closing_mode: "automatic",
  email_subject: "",
  email_message: "",
};

interface Props {
  config: EnvelopeConfig;
  onChange: (field: keyof EnvelopeConfig, value: any) => void;
}

export default function EnvelopeConfigSection({ config, onChange }: Props) {
  const [msgOpen, setMsgOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Mensagem (collapsible) */}
      <Collapsible open={msgOpen} onOpenChange={setMsgOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold py-2 hover:text-primary transition-colors">
          <ChevronDown className={`h-4 w-4 transition-transform ${msgOpen ? "rotate-0" : "-rotate-90"}`} />
          Mensagem Personalizada
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 pl-6">
          <div className="space-y-1">
            <Label className="text-xs">Assunto do email</Label>
            <Input value={config.email_subject} onChange={(e) => onChange("email_subject", e.target.value)} placeholder="Assine o documento..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mensagem</Label>
            <Textarea value={config.email_message} onChange={(e) => onChange("email_message", e.target.value)} rows={3} placeholder="Prezado(a), solicitamos a assinatura..." />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Configurações avançadas (collapsible) */}
      <Collapsible open={cfgOpen} onOpenChange={setCfgOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold py-2 hover:text-primary transition-colors">
          <ChevronDown className={`h-4 w-4 transition-transform ${cfgOpen ? "rotate-0" : "-rotate-90"}`} />
          Configurações Avançadas
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2 pl-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Assinatura (Lei 14.063)</Label>
              <Select value={config.signature_type} onValueChange={(v) => onChange("signature_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples</SelectItem>
                  <SelectItem value="avancada">Avançada</SelectItem>
                  <SelectItem value="qualificada">Qualificada (ICP-Brasil)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data limite para assinatura</Label>
              <Input type="datetime-local" value={config.deadline_at} onChange={(e) => onChange("deadline_at", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Lembretes automáticos</Label>
              <Select value={config.reminder_interval || ""} onValueChange={(v) => onChange("reminder_interval", v)}>
                <SelectTrigger><SelectValue placeholder="Desabilitado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Desabilitado</SelectItem>
                  <SelectItem value="3_dias">A cada 3 dias</SelectItem>
                  <SelectItem value="5_dias">A cada 5 dias</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Idioma</Label>
              <Select value={config.locale} onValueChange={(v) => onChange("locale", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Pausar após recusa</Label>
              <Switch checked={config.pause_on_rejection} onCheckedChange={(v) => onChange("pause_on_rejection", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Encerramento</Label>
              <Select value={config.closing_mode} onValueChange={(v) => onChange("closing_mode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automático</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
