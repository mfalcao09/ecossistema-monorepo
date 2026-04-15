import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Search, Plus, Pencil, Trash2, MoreHorizontal, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function LegalMandatoryInsurance() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ insurance_type: "incendio", insurer_name: "", policy_number: "", start_date: "", end_date: "", premium_amount: "", status: "pendente", key_delivery_blocked: true, notes: "" });
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal-mandatory-insurance"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_mandatory_insurance").select("*").order("end_date"); if (error) throw error; return data; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const payload = { ...form, start_date: form.start_date || null, end_date: form.end_date || null, premium_amount: form.premium_amount ? parseFloat(form.premium_amount) : 0, tenant_id, created_by: user.id, property_id: null as string | null };
      if (editing) { const { error } = await supabase.from("legal_mandatory_insurance").update({ ...form, start_date: form.start_date || null, end_date: form.end_date || null, premium_amount: form.premium_amount ? parseFloat(form.premium_amount) : 0 }).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("legal_mandatory_insurance").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-mandatory-insurance"] }); toast.success("Apólice salva!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_mandatory_insurance").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-mandatory-insurance"] }); toast.success("Removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ insurance_type: "incendio", insurer_name: "", policy_number: "", start_date: "", end_date: "", premium_amount: "", status: "pendente", key_delivery_blocked: true, notes: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ insurance_type: t.insurance_type, insurer_name: t.insurer_name || "", policy_number: t.policy_number || "", start_date: t.start_date || "", end_date: t.end_date || "", premium_amount: t.premium_amount?.toString() || "", status: t.status, key_delivery_blocked: t.key_delivery_blocked, notes: t.notes || "" }); setFormOpen(true); };

  const filtered = items.filter((i: any) => (i.insurer_name || "").toLowerCase().includes(search.toLowerCase()) || (i.policy_number || "").includes(search));
  const ativas = items.filter((i: any) => i.status === "ativa").length;
  const vencendo30 = items.filter((i: any) => { if (!i.end_date || i.status !== "ativa") return false; const d = new Date(i.end_date); const now = new Date(); return d > now && d <= new Date(now.getTime() + 30 * 86400000); }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Seguros Obrigatórios</h1><p className="text-muted-foreground">Controle de apólices obrigatórias e bloqueio de entrega de chaves.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Apólice</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{ativas}</div><p className="text-xs text-muted-foreground">Apólices Ativas</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{vencendo30}</div><p className="text-xs text-muted-foreground">Vencendo em 30 dias</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{items.length}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
      </div>
      <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Seguradora</TableHead><TableHead>Tipo</TableHead><TableHead>Apólice</TableHead><TableHead>Validade</TableHead><TableHead>Status</TableHead><TableHead>Bloqueio</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma apólice.</TableCell></TableRow> : filtered.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.insurer_name || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{i.insurance_type}</Badge></TableCell>
                  <TableCell>{i.policy_number || "—"}</TableCell>
                  <TableCell>{i.end_date ? format(new Date(i.end_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant={i.status === "ativa" ? "default" : i.status === "vencida" ? "destructive" : "secondary"}>{i.status}</Badge></TableCell>
                  <TableCell>{i.key_delivery_blocked && i.status !== "ativa" ? <Badge variant="destructive">Bloqueado</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Apólice" : "Nova Apólice"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tipo</Label><Select value={form.insurance_type} onValueChange={(v) => setForm({ ...form, insurance_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="incendio">Incêndio</SelectItem><SelectItem value="responsabilidade_civil">Responsabilidade Civil</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="vencida">Vencida</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Seguradora</Label><Input value={form.insurer_name} onChange={(e) => setForm({ ...form, insurer_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Nº Apólice</Label><Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prêmio (R$)</Label><Input type="number" value={form.premium_amount} onChange={(e) => setForm({ ...form, premium_amount: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.key_delivery_blocked} onCheckedChange={(c) => setForm({ ...form, key_delivery_blocked: c })} /><Label>Bloquear entrega de chaves se inativo</Label></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
