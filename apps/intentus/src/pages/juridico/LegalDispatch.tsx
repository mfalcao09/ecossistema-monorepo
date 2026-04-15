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

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  solicitado: { label: "Solicitado", variant: "outline" },
  em_andamento: { label: "Em Andamento", variant: "default" },
  aguardando_orgao: { label: "Aguardando Órgão", variant: "secondary" },
  concluido: { label: "Concluído", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function LegalDispatch() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ order_type: "outro", description: "", status: "solicitado", dispatcher_name: "", estimated_cost: "", actual_cost: "", notes: "" });
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal-dispatch"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_dispatch_orders").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const payload = { ...form, estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : 0, actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : 0, tenant_id, created_by: user.id };
      if (editing) { const { error } = await supabase.from("legal_dispatch_orders").update({ ...form, estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : 0, actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : 0 }).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("legal_dispatch_orders").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-dispatch"] }); toast.success("Ordem salva!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_dispatch_orders").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-dispatch"] }); toast.success("Removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ order_type: "outro", description: "", status: "solicitado", dispatcher_name: "", estimated_cost: "", actual_cost: "", notes: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ order_type: t.order_type, description: t.description, status: t.status, dispatcher_name: t.dispatcher_name || "", estimated_cost: t.estimated_cost?.toString() || "", actual_cost: t.actual_cost?.toString() || "", notes: t.notes || "" }); setFormOpen(true); };

  const filtered = items.filter((i: any) => i.description.toLowerCase().includes(search.toLowerCase()));
  const emAndamento = items.filter((i: any) => ["solicitado", "em_andamento", "aguardando_orgao"].includes(i.status)).length;
  const custoTotal = items.reduce((acc: number, i: any) => acc + (i.actual_cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Despacho e Órgãos Públicos</h1><p className="text-muted-foreground">Central de despachante: ITBI, registros, averbações, alvarás e AVCB.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Ordem</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{emAndamento}</div><p className="text-xs text-muted-foreground">Em Andamento</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{fmt(custoTotal)}</div><p className="text-xs text-muted-foreground">Custo Total</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{items.length}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
      </div>
      <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Despachante</TableHead><TableHead>Custo</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma ordem.</TableCell></TableRow> : filtered.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.description}</TableCell>
                  <TableCell><Badge variant="outline">{i.order_type}</Badge></TableCell>
                  <TableCell>{i.dispatcher_name || "—"}</TableCell>
                  <TableCell>{fmt(i.actual_cost || i.estimated_cost || 0)}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Ordem" : "Nova Ordem"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tipo</Label><Select value={form.order_type} onValueChange={(v) => setForm({ ...form, order_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="itbi">ITBI</SelectItem><SelectItem value="registro_imovel">Registro de Imóvel</SelectItem><SelectItem value="averbacao">Averbação</SelectItem><SelectItem value="certidao">Certidão</SelectItem><SelectItem value="alvara">Alvará</SelectItem><SelectItem value="avcb">AVCB</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solicitado">Solicitado</SelectItem><SelectItem value="em_andamento">Em Andamento</SelectItem><SelectItem value="aguardando_orgao">Aguardando Órgão</SelectItem><SelectItem value="concluido">Concluído</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Despachante</Label><Input value={form.dispatcher_name} onChange={(e) => setForm({ ...form, dispatcher_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Custo Estimado (R$)</Label><Input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} /></div>
              <div className="space-y-2"><Label>Custo Real (R$)</Label><Input type="number" value={form.actual_cost} onChange={(e) => setForm({ ...form, actual_cost: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button disabled={save.isPending || !form.description.trim()} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
