import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Star, TrendingUp, TrendingDown, Users, BarChart3 } from "lucide-react";
import { useSatisfactionSurveys, useSatisfactionResponses, useCreateSurvey, useUpdateSurvey, useDeleteSurvey } from "@/hooks/useSatisfactionSurveys";
import { format } from "date-fns";

const triggerLabels: Record<string, string> = {
  vistoria_concluida: "Vistoria Concluída",
  rescisao_finalizada: "Rescisão Finalizada",
  atendimento_resolvido: "Atendimento Resolvido",
  manutencao_concluida: "Manutenção Concluída",
  contrato_ativado: "Contrato Ativado",
};

export default function RelationshipSurveys() {
  const { data: surveys = [], isLoading: loadingSurveys } = useSatisfactionSurveys();
  const { data: responses = [], isLoading: loadingResponses } = useSatisfactionResponses();
  const createSurvey = useCreateSurvey();
  const updateSurvey = useUpdateSurvey();
  const deleteSurvey = useDeleteSurvey();

  const [showDialog, setShowDialog] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("nps");
  const [formTrigger, setFormTrigger] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  // KPI calculations
  const totalResponses = responses.length;
  const avgScore = totalResponses > 0 ? (responses.reduce((s, r) => s + r.score, 0) / totalResponses) : 0;
  const promoters = responses.filter(r => r.score >= 9).length;
  const detractors = responses.filter(r => r.score <= 6).length;
  const npsScore = totalResponses > 0 ? Math.round(((promoters - detractors) / totalResponses) * 100) : 0;

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editId) {
      updateSurvey.mutate({ id: editId, name: formName, survey_type: formType, trigger_event: formTrigger || undefined });
    } else {
      createSurvey.mutate({ name: formName, survey_type: formType, trigger_event: formTrigger || undefined });
    }
    resetForm();
  };

  const resetForm = () => {
    setShowDialog(false);
    setFormName("");
    setFormType("nps");
    setFormTrigger("");
    setEditId(null);
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setFormName(s.name);
    setFormType(s.survey_type);
    setFormTrigger(s.trigger_event || "");
    setShowDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pesquisas de Satisfação</h1>
          <p className="text-muted-foreground">Configure e acompanhe pesquisas NPS e CSAT</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <BarChart3 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">{avgScore.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Nota Média</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">{totalResponses}</p>
          <p className="text-xs text-muted-foreground">Total Respostas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold text-green-600">{promoters}</p>
          <p className="text-xs text-muted-foreground">Promotores (9-10)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <TrendingDown className="h-5 w-5 mx-auto text-destructive mb-1" />
          <p className="text-2xl font-bold text-destructive">{detractors}</p>
          <p className="text-xs text-muted-foreground">Detratores (0-6)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Star className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{npsScore}</p>
          <p className="text-xs text-muted-foreground">Score NPS</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="modelos">
        <TabsList>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="respostas">Respostas</TabsTrigger>
        </TabsList>

        <TabsContent value="modelos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-1" />Nova Pesquisa</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSurveys ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : surveys.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma pesquisa configurada</TableCell></TableRow>
                ) : surveys.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{s.survey_type.toUpperCase()}</Badge></TableCell>
                    <TableCell>{triggerLabels[s.trigger_event || ""] || s.trigger_event || "—"}</TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={(v) => updateSurvey.mutate({ id: s.id, active: v })} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteSurvey.mutate(s.id)}>Excluir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="respostas">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pesquisa</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingResponses ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : responses.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma resposta recebida</TableCell></TableRow>
                ) : responses.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.satisfaction_surveys?.name || "—"}</TableCell>
                    <TableCell>{r.people?.name || "Anônimo"}</TableCell>
                    <TableCell>
                      <Badge variant={r.score >= 9 ? "default" : r.score <= 6 ? "destructive" : "secondary"}>
                        {r.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.comment || "—"}</TableCell>
                    <TableCell>{format(new Date(r.responded_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Criar/Editar */}
      <Dialog open={showDialog} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Pesquisa" : "Nova Pesquisa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: NPS Pós-Vistoria" /></div>
            <div><Label>Tipo</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nps">NPS (0-10)</SelectItem>
                  <SelectItem value="csat">CSAT (1-5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Gatilho (evento)</Label>
              <Select value={formTrigger} onValueChange={setFormTrigger}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createSurvey.isPending || updateSurvey.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
