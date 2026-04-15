import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Bot, Webhook, Globe, Cpu } from "lucide-react";
import { useChatIntegrations, useCreateChatIntegration, useUpdateChatIntegration, useDeleteChatIntegration } from "@/hooks/useChat";
import { toast } from "sonner";

const TYPE_MAP: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  agente_ia: { label: "Agente IA", icon: Bot },
  webhook: { label: "Webhook", icon: Webhook },
  api_externa: { label: "API Externa", icon: Globe },
  bot: { label: "Bot", icon: Cpu },
};

export function ChatIntegrations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "webhook", config: "{}" });

  const { data: integrations } = useChatIntegrations();
  const createIntegration = useCreateChatIntegration();
  const updateIntegration = useUpdateChatIntegration();
  const deleteIntegration = useDeleteChatIntegration();

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    let parsedConfig = {};
    try { parsedConfig = JSON.parse(form.config); } catch { return toast.error("JSON de configuração inválido"); }
    createIntegration.mutate(
      { name: form.name, type: form.type, config: parsedConfig },
      { onSuccess: () => { setDialogOpen(false); setForm({ name: "", type: "webhook", config: "{}" }); toast.success("Integração criada"); } }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Integração</Button>
      </div>

      {(integrations ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhuma integração configurada</p>
            <p className="text-sm text-muted-foreground">Crie agentes de IA, webhooks ou conecte APIs externas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(integrations ?? []).map((integ) => {
            const typeInfo = TYPE_MAP[integ.type] || { label: integ.type, icon: Globe };
            const Icon = typeInfo.icon;
            return (
              <Card key={integ.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm">{integ.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{typeInfo.label}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={integ.active}
                        onCheckedChange={(active) => updateIntegration.mutate({ id: integ.id, active })}
                      />
                      <span className="text-sm text-muted-foreground">{integ.active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteIntegration.mutate(integ.id, { onSuccess: () => toast.success("Integração removida") })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Integração</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agente_ia">Agente IA</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="api_externa">API Externa</SelectItem>
                  <SelectItem value="bot">Bot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Configuração (JSON)</Label><Textarea value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} rows={4} className="font-mono text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
