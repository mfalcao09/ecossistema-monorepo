import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Headset, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useTickets,
  useCreateTicket,
  useUpdateTicket,
  ticketCategoryLabels,
  ticketStatusLabels,
  ticketStatusColors,
  ticketPriorityLabels,
  ticketPriorityColors,
  ticketDepartmentLabels,
  type Ticket,
} from "@/hooks/useTickets";
import { usePeople } from "@/hooks/usePeople";
import { useProperties } from "@/hooks/useProperties";
import { TicketBoard } from "@/components/tickets/TicketBoard";
import { TicketDetailDialog } from "@/components/tickets/TicketDetailDialog";

export default function HelpDesk() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: tickets = [], isLoading } = useTickets();
  const { data: people = [] } = usePeople();
  const { data: properties = [] } = useProperties({});
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

  const [form, setForm] = useState({
    person_id: "", subject: "", category: "outro", description: "", priority: "media",
    property_id: "", contract_id: "",
  });

  const filtered = tickets.filter((t) =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    (t.people?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const openCount = tickets.filter((t) => t.status === "aberto").length;
  const inProgressCount = tickets.filter((t) => t.status === "em_atendimento").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolvido").length;
  const slaBreachedCount = tickets.filter(
    (t) => t.sla_deadline && isPast(new Date(t.sla_deadline)) && t.status !== "resolvido" && t.status !== "cancelado"
  ).length;

  function handleCreate() {
    if (!form.person_id || !form.subject) return;
    createTicket.mutate(form, {
      onSuccess: () => {
        setCreateOpen(false);
        setForm({ person_id: "", subject: "", category: "outro", description: "", priority: "media", property_id: "", contract_id: "" });
      },
    });
  }

  function handleSelect(ticket: Ticket) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Central de Atendimento</h1>
          <p className="text-muted-foreground text-sm">Help Desk e gestão de chamados</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Ticket
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Headset className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openCount}</p>
                <p className="text-xs text-muted-foreground">Abertos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">Em Atendimento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolvedCount}</p>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{slaBreachedCount}</p>
                <p className="text-xs text-muted-foreground">SLA Estourado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por assunto ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList className="h-9">
            <TabsTrigger value="kanban" className="text-xs">Kanban</TabsTrigger>
            <TabsTrigger value="lista" className="text-xs">Lista</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Carregando tickets...</p>
      ) : view === "kanban" ? (
        <TicketBoard tickets={filtered} onSelect={handleSelect} onStatusChange={(id, status) => updateTicket.mutate({ id, status })} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Abertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Headset className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhum ticket encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelect(t)}>
                      <TableCell className="font-medium max-w-[200px] truncate">{t.subject}</TableCell>
                      <TableCell>{t.people?.full_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{ticketCategoryLabels[t.category]}</Badge></TableCell>
                      <TableCell><Badge className={ticketPriorityColors[t.priority]}>{ticketPriorityLabels[t.priority]}</Badge></TableCell>
                      <TableCell><Badge className={ticketStatusColors[t.status]}>{ticketStatusLabels[t.status]}</Badge></TableCell>
                      <TableCell>{t.assigned_department ? ticketDepartmentLabels[t.assigned_department] : "—"}</TableCell>
                      <TableCell>{format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={form.person_id} onValueChange={(v) => setForm({ ...form, person_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar pessoa" /></SelectTrigger>
                <SelectContent>
                  {people.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assunto *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ex: Dúvida sobre reajuste" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ticketCategoryLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ticketPriorityLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Imóvel (opcional)</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar imóvel" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createTicket.isPending}>Criar Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <TicketDetailDialog ticket={selectedTicket} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
