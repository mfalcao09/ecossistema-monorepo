import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Search, Plus, Pencil, Trash2, MoreHorizontal, KeyRound } from "lucide-react";
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

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ativa: { label: "Ativa", variant: "default" },
  vencida: { label: "Vencida", variant: "destructive" },
  revogada: { label: "Revogada", variant: "secondary" },
};

export default function LegalPowersOfAttorney() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ grantor_name: "", grantee_name: "", type: "particular", purpose: "", notary_office: "", start_date: "", expiry_date: "", status: "ativa", notes: "" });
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal-powers-of-attorney"],
    queryFn: async () => {
      const { data, error } = await supabase.from("legal_powers_of_attorney").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const payload = { ...form, start_date: form.start_date || null, expiry_date: form.expiry_date || null, tenant_id, created_by: user.id };
      if (editing) {
        const { error } = await supabase.from("legal_powers_of_attorney").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_powers_of_attorney").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-powers-of-attorney"] }); toast.success("Procuração salva!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_powers_of_attorney").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-powers-of-attorney"] }); toast.success("Removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ grantor_name: "", grantee_name: "", type: "particular", purpose: "", notary_office: "", start_date: "", expiry_date: "", status: "ativa", notes: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ grantor_name: t.grantor_name, grantee_name: t.grantee_name, type: t.type, purpose: t.purpose || "", notary_office: t.notary_office || "", start_date: t.start_date || "", expiry_date: t.expiry_date || "", status: t.status, notes: t.notes || "" }); setFormOpen(true); };

  const filtered = items.filter((i: any) => i.grantor_name.toLowerCase().includes(search.toLowerCase()) || i.grantee_name.toLowerCase().includes(search.toLowerCase()));

  const ativas = items.filter((i: any) => i.status === "ativa").length;
  const vencidas = items.filter((i: any) => i.status === "vencida").length;
  const vencendo30 = items.filter((i: any) => {
    if (!i.expiry_date || i.status !== "ativa") return false;
    const d = new Date(i.expiry_date);
    const now = new Date();
    return d > now && d <= new Date(now.getTime() + 30 * 86400000);
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Procurações</h1><p className="text-muted-foreground">Controle de procurações vinculadas a pessoas e contratos.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Procuração</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{ativas}</div><p className="text-xs text-muted-foreground">Ativas</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{vencendo30}</div><p className="text-xs text-muted-foreground">Vencendo em 30 dias</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{vencidas}</div><p className="text-xs text-muted-foreground">Vencidas</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      </div>

      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Outorgante</TableHead><TableHead>Outorgado</TableHead><TableHead>Tipo</TableHead><TableHead>Validade</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma procuração encontrada.</TableCell></TableRow> : filtered.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.grantor_name}</TableCell>
                  <TableCell>{i.grantee_name}</TableCell>
                  <TableCell><Badge variant="outline">{i.type === "publica" ? "Pública" : "Particular"}</Badge></TableCell>
                  <TableCell>{i.expiry_date ? format(new Date(i.expiry_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_MAP[i.status]?.variant || "secondary"}>{STATUS_MAP[i.status]?.label || i.status}</Badge></TableCell>
                  <TableCell>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Procuração" : "Nova Procuração"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Outorgante</Label><Input value={form.grantor_name} onChange={(e) => setForm({ ...form, grantor_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Outorgado</Label><Input value={form.grantee_name} onChange={(e) => setForm({ ...form, grantee_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tipo</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="publica">Pública</SelectItem><SelectItem value="particular">Particular</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="vencida">Vencida</SelectItem><SelectItem value="revogada">Revogada</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Finalidade</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Validade</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Cartório</Label><Input value={form.notary_office} onChange={(e) => setForm({ ...form, notary_office: e.target.value })} /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button disabled={save.isPending || !form.grantor_name.trim() || !form.grantee_name.trim()} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
