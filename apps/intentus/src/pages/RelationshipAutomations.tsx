import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Zap } from "lucide-react";
import { toast } from "sonner";

const triggerLabels: Record<string, string> = {
  contrato_vencendo: "Contrato Vencendo",
  rescisao_iniciada: "Rescisão Iniciada",
  rescisao_parada_x_dias: "Rescisão Parada (X dias)",
  reajuste_pendente: "Reajuste Pendente",
  ticket_sla_estourado: "Ticket SLA Estourado",
  ticket_aberto: "Novo Ticket Aberto",
  manutencao_urgente: "Manutenção Urgente",
  renovacao_proxima: "Renovação Próxima",
  garantia_vencendo: "Garantia Vencendo",
  vistoria_agendada: "Vistoria Agendada",
};

const actionLabels: Record<string, string> = {
  tarefa: "Criar Tarefa",
  notificacao: "Enviar Notificação",
  lembrete: "Criar Lembrete",
};

export default function RelationshipAutomations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger_event: "contrato_vencendo",
    delay_days: "0",
    action_type: "notificacao",
  });

  const { data: automations = [] } = useQuery({
    queryKey: ["relationship-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relationship_automations")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const createAutomation = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("relationship_automations").insert({
        tenant_id: tenantId,
        name: form.name,
        trigger_event: form.trigger_event,
        delay_days: parseInt(form.delay_days) || 0,
        action_type: form.action_type,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relationship-automations"] });
      setShowDialog(false);
      setForm({ name: "", trigger_event: "contrato_vencendo", delay_days: "0", action_type: "notificacao" });
      toast.success("Automação criada!");
    },
    onError: () => toast.error("Erro ao criar automação"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("relationship_automations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["relationship-automations"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automações de Relacionamento</h1>
          <p className="text-muted-foreground">Regras automáticas para gestão de contratos e atendimento</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Automação
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativa</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Delay</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Switch checked={a.active} onCheckedChange={(v) => toggleActive.mutate({ id: a.id, active: v })} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Zap className={`h-4 w-4 ${a.active ? "text-yellow-500" : "text-muted-foreground"}`} />
                      {a.name}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{triggerLabels[a.trigger_event] || a.trigger_event}</Badge></TableCell>
                  <TableCell>{a.delay_days > 0 ? `${a.delay_days} dias` : "Imediato"}</TableCell>
                  <TableCell>{actionLabels[a.action_type] || a.action_type}</TableCell>
                </TableRow>
              ))}
              {automations.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma automação configurada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Automação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Alerta de contrato vencendo" />
            </div>
            <div>
              <Label>Gatilho</Label>
              <Select value={form.trigger_event} onValueChange={(v) => setForm((f) => ({ ...f, trigger_event: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delay (dias após gatilho)</Label>
              <Input type="number" value={form.delay_days} onChange={(e) => setForm((f) => ({ ...f, delay_days: e.target.value }))} />
            </div>
            <div>
              <Label>Ação</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm((f) => ({ ...f, action_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={() => createAutomation.mutate()} disabled={!form.name || createAutomation.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
