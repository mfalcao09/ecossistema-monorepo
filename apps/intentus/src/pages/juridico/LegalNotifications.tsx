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
  rascunho: { label: "Rascunho", variant: "secondary" },
  enviada: { label: "Enviada", variant: "outline" },
  entregue: { label: "Entregue", variant: "default" },
  nao_entregue: { label: "Não Entregue", variant: "destructive" },
  prazo_expirado: { label: "Prazo Expirado", variant: "destructive" },
};

export default function LegalNotifications() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ subject: "", notification_type: "outro", body: "", delivery_method: "ar", status: "rascunho", tracking_code: "", legal_deadline: "", notes: "" });
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("legal_notifications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const payload = { ...form, legal_deadline: form.legal_deadline || null, tenant_id, created_by: user.id };
      if (editing) {
        const { error } = await supabase.from("legal_notifications").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_notifications").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-notifications"] }); toast.success("Notificação salva!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_notifications").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-notifications"] }); toast.success("Removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ subject: "", notification_type: "outro", body: "", delivery_method: "ar", status: "rascunho", tracking_code: "", legal_deadline: "", notes: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ subject: t.subject, notification_type: t.notification_type, body: t.body || "", delivery_method: t.delivery_method, status: t.status, tracking_code: t.tracking_code || "", legal_deadline: t.legal_deadline || "", notes: t.notes || "" }); setFormOpen(true); };

  const filtered = items.filter((i: any) => i.subject.toLowerCase().includes(search.toLowerCase()));
  const enviadas = items.filter((i: any) => i.status === "enviada").length;
  const aguardando = items.filter((i: any) => i.status === "enviada" && !i.delivery_confirmed_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Notificações Extrajudiciais</h1><p className="text-muted-foreground">Registro e acompanhamento de notificações legais.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Notificação</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{items.length}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{enviadas}</div><p className="text-xs text-muted-foreground">Enviadas</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{aguardando}</div><p className="text-xs text-muted-foreground">Aguardando Entrega</p></CardContent></Card>
      </div>

      <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>

      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Assunto</TableHead><TableHead>Tipo</TableHead><TableHead>Método</TableHead><TableHead>Prazo Legal</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma notificação encontrada.</TableCell></TableRow> : filtered.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.subject}</TableCell>
                  <TableCell><Badge variant="outline">{i.notification_type}</Badge></TableCell>
                  <TableCell>{i.delivery_method.toUpperCase()}</TableCell>
                  <TableCell>{i.legal_deadline ? format(new Date(i.legal_deadline), "dd/MM/yyyy") : "—"}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Notificação" : "Nova Notificação"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Assunto</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tipo</Label><Select value={form.notification_type} onValueChange={(v) => setForm({ ...form, notification_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="despejo">Despejo</SelectItem><SelectItem value="cobranca">Cobrança</SelectItem><SelectItem value="infracao">Infração</SelectItem><SelectItem value="rescisao">Rescisão</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Método de Envio</Label><Select value={form.delivery_method} onValueChange={(v) => setForm({ ...form, delivery_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ar">AR</SelectItem><SelectItem value="cartorio">Cartório</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="pessoal">Pessoal</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="enviada">Enviada</SelectItem><SelectItem value="entregue">Entregue</SelectItem><SelectItem value="nao_entregue">Não Entregue</SelectItem><SelectItem value="prazo_expirado">Prazo Expirado</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Prazo Legal</Label><Input type="date" value={form.legal_deadline} onChange={(e) => setForm({ ...form, legal_deadline: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Código de Rastreio</Label><Input value={form.tracking_code} onChange={(e) => setForm({ ...form, tracking_code: e.target.value })} /></div>
            <div className="space-y-2"><Label>Corpo</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button disabled={save.isPending || !form.subject.trim()} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
