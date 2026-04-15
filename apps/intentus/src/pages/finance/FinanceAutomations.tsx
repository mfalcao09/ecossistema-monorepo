import { useState } from "react";
import { useFinanceAutomations } from "@/hooks/useFinanceAutomations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Zap, Trash2 } from "lucide-react";

const triggerLabels: Record<string, string> = {
  parcela_vencendo: "Parcela Vencendo",
  parcela_vencida: "Parcela Vencida",
  repasse_pendente: "Repasse Pendente",
  comissao_pendente: "Comissão Pendente",
  garantia_locaticia_vencendo: "Garantia Locatícia Vencendo",
  apolice_vencendo: "Apólice de Seguro Vencendo",
  acordo_parcela_atrasada: "Parcela de Acordo Atrasada",
  conciliacao_divergente: "Conciliação com Divergência",
};

const actionLabels: Record<string, string> = {
  notificacao: "Enviar Notificação",
  tarefa: "Criar Tarefa",
  lembrete: "Criar Lembrete",
  webhook: "Disparar Webhook",
};

export default function FinanceAutomations() {
  const { automations, createAutomation, toggleActive, deleteAutomation } = useFinanceAutomations();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger_event: "parcela_vencendo",
    delay_days: "0",
    action_type: "notificacao",
  });

  const handleCreate = () => {
    createAutomation.mutate(
      { name: form.name, trigger_event: form.trigger_event, delay_days: parseInt(form.delay_days) || 0, action_type: form.action_type },
      {
        onSuccess: () => {
          setShowDialog(false);
          setForm({ name: "", trigger_event: "parcela_vencendo", delay_days: "0", action_type: "notificacao" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="h-6 w-6" /> Automações Financeiras</h1>
          <p className="text-muted-foreground">Regras automáticas para parcelas, repasses, comissões e impostos</p>
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
                <TableHead className="w-[60px]">Ativa</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Delay</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead className="w-[60px]" />
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
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteAutomation.mutate(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {automations.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma automação configurada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Automação Financeira</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Notificar parcela vencida" />
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
            <Button onClick={handleCreate} disabled={!form.name || createAutomation.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
