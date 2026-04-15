import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CheckSquare, Trash2, AlertTriangle } from "lucide-react";
import { useDevelopments } from "@/hooks/useDevelopments";
import { useDevelopmentTasks, useCreateTask, useUpdateTaskStatus, useDeleteTask } from "@/hooks/useDevelopmentTasks";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["dev_task_status"];
type TaskPriority = Database["public"]["Enums"]["dev_task_priority"];

const statusLabels: Record<string, string> = { pendente: "Pendente", em_andamento: "Em Andamento", concluida: "Concluída" };
const statusColors: Record<string, string> = { pendente: "bg-yellow-100 text-yellow-800", em_andamento: "bg-blue-100 text-blue-800", concluida: "bg-emerald-100 text-emerald-800" };
const priorityLabels: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const priorityColors: Record<string, string> = { baixa: "text-muted-foreground", media: "text-yellow-600", alta: "text-red-600" };

export default function DevTasks() {
  const { data: developments = [] } = useDevelopments();
  const [filterDev, setFilterDev] = useState<string>("all");
  const { data: tasks = [], isLoading } = useDevelopmentTasks(filterDev !== "all" ? filterDev : undefined);
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ development_id: "", title: "", description: "", due_date: "", priority: "media" as TaskPriority });

  const overdue = tasks.filter(t => t.status !== "concluida" && t.due_date && new Date(t.due_date) < new Date());

  function openCreate() {
    setForm({ development_id: developments[0]?.id || "", title: "", description: "", due_date: "", priority: "media" });
    setDialogOpen(true);
  }

  function handleCreate() {
    if (!form.title || !form.development_id) return;
    createTask.mutate(form, { onSuccess: () => setDialogOpen(false) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Tarefas</h1>
          <p className="text-muted-foreground text-sm">Follow-ups, alertas e gestão de tarefas</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterDev} onValueChange={setFilterDev}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {developments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nova Tarefa</Button>
        </div>
      </div>

      {overdue.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">{overdue.length} tarefa(s) vencida(s)</span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : tasks.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma tarefa encontrada.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t: any) => {
                  const isOverdue = t.status !== "concluida" && t.due_date && new Date(t.due_date) < new Date();
                  return (
                    <TableRow key={t.id} className={isOverdue ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <p className="font-medium text-sm">{t.title}</p>
                        {t.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{t.description}</p>}
                      </TableCell>
                      <TableCell><span className={`text-xs font-medium ${priorityColors[t.priority]}`}>{priorityLabels[t.priority]}</span></TableCell>
                      <TableCell className={`text-sm ${isOverdue ? "text-destructive font-medium" : ""}`}>{t.due_date || "—"}</TableCell>
                      <TableCell>
                        <Select value={t.status} onValueChange={(v: TaskStatus) => updateStatus.mutate({ id: t.id, status: v })}>
                          <SelectTrigger className="w-36 h-7"><Badge className={`${statusColors[t.status]} text-[10px]`}>{statusLabels[t.status]}</Badge></SelectTrigger>
                          <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTask.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Empreendimento *</Label>
              <Select value={form.development_id} onValueChange={v => setForm({ ...form, development_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{developments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v: TaskPriority) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createTask.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
