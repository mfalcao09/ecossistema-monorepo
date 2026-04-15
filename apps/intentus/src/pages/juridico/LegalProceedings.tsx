import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Search, Plus, Pencil, Trash2, MoreHorizontal, Gavel, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  em_andamento: { label: "Em Andamento", variant: "default" },
  suspenso: { label: "Suspenso", variant: "secondary" },
  encerrado_favoravel: { label: "Encerrado (Favorável)", variant: "outline" },
  encerrado_desfavoravel: { label: "Encerrado (Desfavorável)", variant: "destructive" },
  acordo: { label: "Acordo", variant: "outline" },
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function LegalProceedings() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState<any>(null);
  const [eventForm, setEventForm] = useState({ description: "", event_type: "outro", event_date: "" });
  const [form, setForm] = useState({ case_number: "", court: "", judge: "", proceeding_type: "outro", status: "em_andamento", filed_date: "", next_deadline: "", lawyer_name: "", lawyer_oab: "", provisioned_amount: "", notes: "" });
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal-proceedings"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_proceedings").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["legal-proceeding-events", detailOpen?.id],
    enabled: !!detailOpen,
    queryFn: async () => { const { data, error } = await supabase.from("legal_proceeding_events").select("*").eq("proceeding_id", detailOpen.id).order("event_date", { ascending: false }); if (error) throw error; return data; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const payload = { ...form, filed_date: form.filed_date || null, next_deadline: form.next_deadline || null, provisioned_amount: form.provisioned_amount ? parseFloat(form.provisioned_amount) : 0, tenant_id, created_by: user.id };
      if (editing) { const { error } = await supabase.from("legal_proceedings").update({ ...form, filed_date: form.filed_date || null, next_deadline: form.next_deadline || null, provisioned_amount: form.provisioned_amount ? parseFloat(form.provisioned_amount) : 0 }).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("legal_proceedings").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-proceedings"] }); toast.success("Processo salvo!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("legal_proceeding_events").insert({ ...eventForm, event_date: eventForm.event_date || new Date().toISOString().split("T")[0], proceeding_id: detailOpen.id, tenant_id, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-proceeding-events", detailOpen?.id] }); toast.success("Andamento adicionado!"); setEventForm({ description: "", event_type: "outro", event_date: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_proceedings").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-proceedings"] }); toast.success("Removido!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ case_number: "", court: "", judge: "", proceeding_type: "outro", status: "em_andamento", filed_date: "", next_deadline: "", lawyer_name: "", lawyer_oab: "", provisioned_amount: "", notes: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ case_number: t.case_number || "", court: t.court || "", judge: t.judge || "", proceeding_type: t.proceeding_type, status: t.status, filed_date: t.filed_date || "", next_deadline: t.next_deadline || "", lawyer_name: t.lawyer_name || "", lawyer_oab: t.lawyer_oab || "", provisioned_amount: t.provisioned_amount?.toString() || "", notes: t.notes || "" }); setFormOpen(true); };

  const filtered = items.filter((i: any) => (i.case_number || "").toLowerCase().includes(search.toLowerCase()) || (i.court || "").toLowerCase().includes(search.toLowerCase()));
  const emAndamento = items.filter((i: any) => i.status === "em_andamento").length;
  const totalProv = items.reduce((acc: number, i: any) => acc + (i.provisioned_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Processos Judiciais</h1><p className="text-muted-foreground">Acompanhamento de ações judiciais com timeline de andamentos.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Processo</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{emAndamento}</div><p className="text-xs text-muted-foreground">Em Andamento</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{fmt(totalProv)}</div><p className="text-xs text-muted-foreground">Total Provisionado</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{items.length}</div><p className="text-xs text-muted-foreground">Total de Processos</p></CardContent></Card>
      </div>

      <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>

      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Nº Processo</TableHead><TableHead>Tipo</TableHead><TableHead>Vara</TableHead><TableHead>Próximo Prazo</TableHead><TableHead>Provisão</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum processo encontrado.</TableCell></TableRow> : filtered.map((i: any) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => setDetailOpen(i)}>
                  <TableCell className="font-medium">{i.case_number || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{i.proceeding_type}</Badge></TableCell>
                  <TableCell>{i.court || "—"}</TableCell>
                  <TableCell>{i.next_deadline ? format(new Date(i.next_deadline), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{fmt(i.provisioned_amount || 0)}</TableCell>
                  <TableCell><Badge variant={STATUS_MAP[i.status]?.variant || "secondary"}>{STATUS_MAP[i.status]?.label || i.status}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(i)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(i.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog with Events Timeline */}
      <Dialog open={!!detailOpen} onOpenChange={(o) => { if (!o) setDetailOpen(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Processo {detailOpen?.case_number || ""}</DialogTitle></DialogHeader>
          <Tabs defaultValue="timeline">
            <TabsList><TabsTrigger value="timeline">Andamentos</TabsTrigger><TabsTrigger value="info">Informações</TabsTrigger></TabsList>
            <TabsContent value="timeline" className="space-y-4">
              <div className="space-y-3 border rounded-md p-4">
                <div className="space-y-2"><Label>Novo Andamento</Label><Input placeholder="Descrição" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={eventForm.event_type} onValueChange={(v) => setEventForm({ ...eventForm, event_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="peticao">Petição</SelectItem><SelectItem value="audiencia">Audiência</SelectItem><SelectItem value="sentenca">Sentença</SelectItem><SelectItem value="recurso">Recurso</SelectItem><SelectItem value="acordo">Acordo</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select>
                  <Input type="date" value={eventForm.event_date} onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} />
                </div>
                <Button size="sm" disabled={addEvent.isPending || !eventForm.description.trim()} onClick={() => addEvent.mutate()}>Adicionar</Button>
              </div>
              <div className="space-y-2">
                {events.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum andamento registrado.</p> : events.map((ev: any) => (
                  <div key={ev.id} className="flex gap-3 items-start border-l-2 border-primary/30 pl-4 py-2">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{ev.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(ev.event_date), "dd/MM/yyyy")} · <Badge variant="outline" className="text-[10px]">{ev.event_type}</Badge></p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="info">
              {detailOpen && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Vara:</span> {detailOpen.court || "—"}</div>
                  <div><span className="text-muted-foreground">Juiz:</span> {detailOpen.judge || "—"}</div>
                  <div><span className="text-muted-foreground">Advogado:</span> {detailOpen.lawyer_name || "—"}</div>
                  <div><span className="text-muted-foreground">OAB:</span> {detailOpen.lawyer_oab || "—"}</div>
                  <div><span className="text-muted-foreground">Provisão:</span> {fmt(detailOpen.provisioned_amount || 0)}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={STATUS_MAP[detailOpen.status]?.variant || "secondary"}>{STATUS_MAP[detailOpen.status]?.label || detailOpen.status}</Badge></div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Processo" : "Novo Processo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nº do Processo</Label><Input value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>Tipo</Label><Select value={form.proceeding_type} onValueChange={(v) => setForm({ ...form, proceeding_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="despejo">Despejo</SelectItem><SelectItem value="cobranca">Cobrança</SelectItem><SelectItem value="revisional">Revisional</SelectItem><SelectItem value="consignatoria">Consignatória</SelectItem><SelectItem value="indenizatoria">Indenizatória</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Vara</Label><Input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} /></div>
              <div className="space-y-2"><Label>Juiz</Label><Input value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Advogado</Label><Input value={form.lawyer_name} onChange={(e) => setForm({ ...form, lawyer_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>OAB</Label><Input value={form.lawyer_oab} onChange={(e) => setForm({ ...form, lawyer_oab: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Data Ajuizamento</Label><Input type="date" value={form.filed_date} onChange={(e) => setForm({ ...form, filed_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Próximo Prazo</Label><Input type="date" value={form.next_deadline} onChange={(e) => setForm({ ...form, next_deadline: e.target.value })} /></div>
              <div className="space-y-2"><Label>Provisão (R$)</Label><Input type="number" value={form.provisioned_amount} onChange={(e) => setForm({ ...form, provisioned_amount: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="em_andamento">Em Andamento</SelectItem><SelectItem value="suspenso">Suspenso</SelectItem><SelectItem value="encerrado_favoravel">Encerrado (Favorável)</SelectItem><SelectItem value="encerrado_desfavoravel">Encerrado (Desfavorável)</SelectItem><SelectItem value="acordo">Acordo</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
