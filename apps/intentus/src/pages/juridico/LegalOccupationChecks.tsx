import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Search, Plus, Pencil, Trash2, MoreHorizontal, MapPin } from "lucide-react";
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
import { toast } from "sonner";
import { format } from "date-fns";

export default function LegalOccupationChecks() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ check_type: "vistoria_preventiva", scheduled_date: "", status: "agendada", findings: "" });
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal-occupation-checks"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_occupation_checks").select("*").order("scheduled_date"); if (error) throw error; return data; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const payload = { ...form, scheduled_date: form.scheduled_date || null, tenant_id, created_by: user.id, property_id: null as string | null };
      if (editing) { const { error } = await supabase.from("legal_occupation_checks").update({ ...form, scheduled_date: form.scheduled_date || null }).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("legal_occupation_checks").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-occupation-checks"] }); toast.success("Verificação salva!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_occupation_checks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-occupation-checks"] }); toast.success("Removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ check_type: "vistoria_preventiva", scheduled_date: "", status: "agendada", findings: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ check_type: t.check_type, scheduled_date: t.scheduled_date || "", status: t.status, findings: t.findings || "" }); setFormOpen(true); };

  const pendentes = items.filter((i: any) => i.status === "agendada").length;
  const irregularidades = items.filter((i: any) => i.status === "irregularidade_detectada").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Controle de Ocupação</h1><p className="text-muted-foreground">Prevenção de usucapião e invasão em imóveis desocupados.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Verificação</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{pendentes}</div><p className="text-xs text-muted-foreground">Vistorias Pendentes</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{irregularidades}</div><p className="text-xs text-muted-foreground">Irregularidades</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{items.length}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
      </div>
      <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Data Agendada</TableHead><TableHead>Status</TableHead><TableHead>Achados</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma verificação.</TableCell></TableRow> : items.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell><Badge variant="outline">{i.check_type === "vistoria_preventiva" ? "Vistoria" : i.check_type === "conta_consumo" ? "Conta Consumo" : "Foto Periódica"}</Badge></TableCell>
                  <TableCell>{i.scheduled_date ? format(new Date(i.scheduled_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant={i.status === "concluida" ? "default" : i.status === "irregularidade_detectada" ? "destructive" : "secondary"}>{i.status === "irregularidade_detectada" ? "Irregularidade" : i.status}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{i.findings || "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(i)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(i.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Verificação" : "Nova Verificação"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tipo</Label><Select value={form.check_type} onValueChange={(v) => setForm({ ...form, check_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vistoria_preventiva">Vistoria Preventiva</SelectItem><SelectItem value="conta_consumo">Conta de Consumo</SelectItem><SelectItem value="foto_periodica">Foto Periódica</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agendada">Agendada</SelectItem><SelectItem value="concluida">Concluída</SelectItem><SelectItem value="irregularidade_detectada">Irregularidade Detectada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Data Agendada</Label><Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Achados / Observações</Label><Textarea value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} rows={4} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
