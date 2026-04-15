import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Send } from "lucide-react";
import {
  useCommunicationSequences, useCommunicationLogs, useCreateSequence, useUpdateSequence, useDeleteSequence,
  triggerEventLabels, channelLabels, type CommunicationStep
} from "@/hooks/useCommunicationSequences";
import { format } from "date-fns";

type StepForm = Omit<CommunicationStep, "id" | "sequence_id">;

export default function RelationshipCommunication() {
  const { data: sequences = [], isLoading } = useCommunicationSequences();
  const { data: logs = [], isLoading: loadingLogs } = useCommunicationLogs();
  const createSeq = useCreateSequence();
  const updateSeq = useUpdateSequence();
  const deleteSeq = useDeleteSequence();

  const [showDialog, setShowDialog] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formSteps, setFormSteps] = useState<StepForm[]>([]);

  const addStep = () => setFormSteps(prev => [...prev, { step_order: prev.length + 1, delay_days: 0, channel: "notificacao", message_template: "", subject: null }]);
  const removeStep = (i: number) => setFormSteps(prev => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, value: any) => setFormSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const handleSave = () => {
    if (!formName.trim() || !formTrigger) return;
    createSeq.mutate({ name: formName, trigger_event: formTrigger, steps: formSteps });
    resetForm();
  };

  const resetForm = () => {
    setShowDialog(false);
    setFormName("");
    setFormTrigger("");
    setFormSteps([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Régua de Comunicação</h1>
          <p className="text-muted-foreground">Sequências automáticas de mensagens por evento</p>
        </div>
      </div>

      <Tabs defaultValue="reguas">
        <TabsList>
          <TabsTrigger value="reguas">Réguas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="reguas" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setShowDialog(true); addStep(); }}><Plus className="h-4 w-4 mr-1" />Nova Régua</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Etapas</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : sequences.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma régua configurada</TableCell></TableRow>
                ) : sequences.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{triggerEventLabels[s.trigger_event] || s.trigger_event}</Badge></TableCell>
                    <TableCell>{s.communication_sequence_steps?.length || 0}</TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={(v) => updateSeq.mutate({ id: s.id, active: v })} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteSeq.mutate(s.id)}>Excluir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Régua</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLogs ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum envio registrado</TableCell></TableRow>
                ) : logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.communication_sequences?.name || "—"}</TableCell>
                    <TableCell>{l.people?.name || "—"}</TableCell>
                    <TableCell>{channelLabels[l.channel] || l.channel}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "enviado" ? "default" : l.status === "falha" ? "destructive" : "secondary"}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(l.sent_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Criar Régua */}
      <Dialog open={showDialog} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Régua de Comunicação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Boas-vindas novo inquilino" /></div>
            <div><Label>Gatilho</Label>
              <Select value={formTrigger} onValueChange={setFormTrigger}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerEventLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Etapas</Label>
                <Button variant="outline" size="sm" onClick={addStep}><Plus className="h-3 w-3 mr-1" />Etapa</Button>
              </div>
              {formSteps.map((step, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <div className="w-24">
                          <Label className="text-xs">Delay (dias)</Label>
                          <Input type="number" min={0} value={step.delay_days} onChange={e => updateStep(i, "delay_days", parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Canal</Label>
                          <Select value={step.channel} onValueChange={v => updateStep(i, "channel", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(channelLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {step.channel !== "notificacao" && (
                        <div><Label className="text-xs">Assunto</Label><Input value={step.subject || ""} onChange={e => updateStep(i, "subject", e.target.value)} placeholder="Assunto do e-mail" /></div>
                      )}
                      <div><Label className="text-xs">Mensagem</Label><Textarea value={step.message_template} onChange={e => updateStep(i, "message_template", e.target.value)} placeholder="Template da mensagem..." rows={2} /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive mt-4" onClick={() => removeStep(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createSeq.isPending}><Send className="h-4 w-4 mr-1" />Criar Régua</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
