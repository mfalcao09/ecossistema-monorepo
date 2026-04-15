import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Search, Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
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

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  conforme: { label: "Conforme", variant: "default" },
  pendente: { label: "Pendente", variant: "outline" },
  vencido: { label: "Vencido", variant: "destructive" },
  nao_aplicavel: { label: "N/A", variant: "secondary" },
};

export default function LegalCompliance() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ item_type: "outro", description: "", expiry_date: "", status: "pendente", notes: "" });
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal-compliance"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_compliance_items").select("*").order("expiry_date"); if (error) throw error; return data; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      if (editing) { const { error } = await supabase.from("legal_compliance_items").update({ ...form, expiry_date: form.expiry_date || null }).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("legal_compliance_items").insert({ ...form, expiry_date: form.expiry_date || null, tenant_id, created_by: user.id }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-compliance"] }); toast.success("Item salvo!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_compliance_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-compliance"] }); toast.success("Removido!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ item_type: "outro", description: "", expiry_date: "", status: "pendente", notes: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ item_type: t.item_type, description: t.description, expiry_date: t.expiry_date || "", status: t.status, notes: t.notes || "" }); setFormOpen(true); };

  const filtered = items.filter((i: any) => i.description.toLowerCase().includes(search.toLowerCase()));
  const conformes = items.filter((i: any) => i.status === "conforme").length;
  const pendentes = items.filter((i: any) => i.status === "pendente").length;
  const vencidos = items.filter((i: any) => i.status === "vencido").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Compliance</h1><p className="text-muted-foreground">Controle de documentação obrigatória e certificados.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Item</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{conformes}</div><p className="text-xs text-muted-foreground">Conformes</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{pendentes}</div><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{vencidos}</div><p className="text-xs text-muted-foreground">Vencidos</p></CardContent></Card>
      </div>
      <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Validade</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum item.</TableCell></TableRow> : filtered.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.description}</TableCell>
                  <TableCell><Badge variant="outline">{i.item_type}</Badge></TableCell>
                  <TableCell>{i.expiry_date ? format(new Date(i.expiry_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_MAP[i.status]?.variant || "secondary"}>{STATUS_MAP[i.status]?.label || i.status}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Item" : "Novo Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tipo</Label><Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alvara">Alvará</SelectItem><SelectItem value="avcb">AVCB</SelectItem><SelectItem value="habite_se">Habite-se</SelectItem><SelectItem value="certidao_negativa">Certidão Negativa</SelectItem><SelectItem value="matricula">Matrícula</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="conforme">Conforme</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="vencido">Vencido</SelectItem><SelectItem value="nao_aplicavel">N/A</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Validade</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button disabled={save.isPending || !form.description.trim()} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
