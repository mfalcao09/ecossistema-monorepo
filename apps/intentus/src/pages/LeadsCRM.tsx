import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Plus, Pencil, Trash2, UserPlus,
  Phone, Mail, TrendingUp, LayoutGrid, List, Flame, Zap,
} from "lucide-react";
import {
  useLeads, useCreateLead, useUpdateLead, useDeleteLead,
  leadStatusLabels, leadStatusColors, leadSourceLabels,
  type Lead,
} from "@/hooks/useLeads";
import {
  useScorePortfolio,
  getScoreLevel, SCORE_LEVEL_LABELS, SCORE_LEVEL_DOT_COLORS,
} from "@/hooks/useLeadScoring";

import { useProfiles } from "@/hooks/useDealCardFeatures";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import { LeadKanbanBoard } from "@/components/leads/LeadKanbanBoard";
import { format } from "date-fns";

const statusValues = Object.keys(leadStatusLabels);
const sourceValues = Object.keys(leadSourceLabels);

export default function LeadsCRM() {
  const [filters, setFilters] = useState({ search: "", status: "todos", source: "todos" });
  const { data: leads = [], isLoading } = useLeads(filters);
  const { data: profiles } = useProfiles();
  const create = useCreateLead();
  const update = useUpdateLead();
  const remove = useDeleteLead();
  const scorePortfolio = useScorePortfolio();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", source: "outro" as string, status: "novo" as string,
    assigned_to: null as string | null, property_id: null as string | null,
    interest_type: "", budget_min: null as number | null, budget_max: null as number | null,
    preferred_region: "", notes: "", last_contact_at: null as string | null,
    person_id: null as string | null,
  });

  const newLeads = leads.filter((l) => l.status === "novo").length;
  const activeLeads = leads.filter((l) => !["convertido", "perdido"].includes(l.status)).length;
  const convertedLeads = leads.filter((l) => l.status === "convertido").length;
  const hotLeads = leads.filter((l) => l.lead_score != null && l.lead_score >= 70).length;

  function openNew() {
    setEditing(null);
    setForm({
      name: "", email: "", phone: "", source: "outro", status: "novo",
      assigned_to: null, property_id: null, interest_type: "",
      budget_min: null, budget_max: null, preferred_region: "", notes: "",
      last_contact_at: null, person_id: null,
    });
    setDialogOpen(true);
  }

  function openEdit(l: Lead) {
    setEditing(l);
    setForm({
      name: l.name, email: l.email || "", phone: l.phone || "",
      source: l.source, status: l.status,
      assigned_to: l.assigned_to, property_id: l.property_id,
      interest_type: l.interest_type || "",
      budget_min: l.budget_min, budget_max: l.budget_max,
      preferred_region: l.preferred_region || "", notes: l.notes || "",
      last_contact_at: l.last_contact_at, person_id: l.person_id,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = {
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      interest_type: form.interest_type || null,
      preferred_region: form.preferred_region || null,
      notes: form.notes || null,
      assigned_to: form.assigned_to || null,
    };
    if (editing) {
      update.mutate({ id: editing.id, ...payload } as any, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(payload as any, { onSuccess: () => setDialogOpen(false) });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Pipeline</h1>
          <p className="text-muted-foreground text-sm">Captação, distribuição e acompanhamento de leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => scorePortfolio.mutate()} disabled={scorePortfolio.isPending}>
            <Zap className="h-4 w-4 mr-1" /> {scorePortfolio.isPending ? "Pontuando..." : "Pontuar Todos"}
          </Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Lead</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Novos Leads</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{newLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando primeiro contato</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Leads Ativos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">Em acompanhamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Convertidos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{convertedLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">Viraram cliente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Leads Quentes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
              <Flame className="h-5 w-5" />
              {hotLeads}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Score ≥ 70</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taxa Conversão</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(1) : "0"}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email, telefone..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="pl-9" />
        </div>
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {statusValues.map((v) => <SelectItem key={v} value={v}>{leadStatusLabels[v]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.source} onValueChange={(v) => setFilters({ ...filters, source: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Origens</SelectItem>
            {sourceValues.map((v) => <SelectItem key={v} value={v}>{leadSourceLabels[v]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs: Table and Kanban */}
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-1.5"><LayoutGrid className="h-4 w-4" /> Funil</TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5"><List className="h-4 w-4" /> Tabela</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <LeadKanbanBoard leads={leads} isLoading={isLoading} onCardClick={setDetailLead} onStatusChange={(id, status) => update.mutate({ id, status } as any)} />
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Interesse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        Nenhum lead encontrado. Cadastre o primeiro lead.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((l) => {
                      const assignedProfile = profiles?.find((p: any) => p.user_id === l.assigned_to);
                      return (
                        <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetailLead(l)}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-sm">
                              {l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
                              {l.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{l.email}</span>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{leadSourceLabels[l.source] || l.source}</Badge></TableCell>
                          <TableCell>{l.interest_type || "—"}</TableCell>
                          <TableCell>
                            <Badge className={leadStatusColors[l.status] || ""}>{leadStatusLabels[l.status] || l.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {l.lead_score != null ? (
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="font-medium">{l.lead_score}</span>
                                <span className={`h-2 w-2 rounded-full ${SCORE_LEVEL_DOT_COLORS[getScoreLevel(l.lead_score)]}`} />
                                <span className="text-muted-foreground text-xs">{SCORE_LEVEL_LABELS[getScoreLevel(l.lead_score)]}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{assignedProfile?.name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(l.created_at), "dd/MM/yy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Dialog */}
      <LeadDetailDialog
        open={!!detailLead}
        onOpenChange={(open) => !open && setDetailLead(null)}
        lead={detailLead}
      />

      {/* Create/Edit Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Lead" : "Novo Lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceValues.map((v) => <SelectItem key={v} value={v}>{leadSourceLabels[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusValues.map((v) => <SelectItem key={v} value={v}>{leadStatusLabels[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Interesse</Label>
                <Select value={form.interest_type || ""} onValueChange={(v) => setForm({ ...form, interest_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Compra</SelectItem>
                    <SelectItem value="locacao">Locação</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Corretor Responsável</Label>
                <Select value={form.assigned_to || "none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {profiles?.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Região Preferida</Label>
              <Input value={form.preferred_region} onChange={(e) => setForm({ ...form, preferred_region: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Orçamento Mínimo</Label>
                <Input type="number" value={form.budget_min ?? ""} onChange={(e) => setForm({ ...form, budget_min: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-1.5">
                <Label>Orçamento Máximo</Label>
                <Input type="number" value={form.budget_max ?? ""} onChange={(e) => setForm({ ...form, budget_max: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
