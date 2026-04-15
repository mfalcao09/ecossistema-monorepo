import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Search, Plus, Pencil, Trash2, MoreHorizontal, Network, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function LegalCorporateEntities() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ company_name: "", cnpj: "", status: "ativa", notes: "" });
  const [detailOpen, setDetailOpen] = useState<any>(null);
  const [sigForm, setSigForm] = useState({ name: "", cpf: "", role: "socio", can_sign: false, signing_rules: "" });
  const qc = useQueryClient();

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["legal-corporate-entities"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_corporate_entities").select("*").order("company_name"); if (error) throw error; return data; },
  });

  const { data: signatories = [] } = useQuery({
    queryKey: ["legal-corporate-signatories", detailOpen?.id],
    enabled: !!detailOpen,
    queryFn: async () => { const { data, error } = await supabase.from("legal_corporate_signatories").select("*").eq("entity_id", detailOpen.id).order("name"); if (error) throw error; return data; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      if (editing) { const { error } = await supabase.from("legal_corporate_entities").update(form).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("legal_corporate_entities").insert({ ...form, tenant_id, created_by: user.id }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-corporate-entities"] }); toast.success("Entidade salva!"); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSignatory = useMutation({
    mutationFn: async () => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("legal_corporate_signatories").insert({ ...sigForm, entity_id: detailOpen.id, tenant_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-corporate-signatories", detailOpen?.id] }); toast.success("Signatário adicionado!"); setSigForm({ name: "", cpf: "", role: "socio", can_sign: false, signing_rules: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("legal_corporate_entities").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["legal-corporate-entities"] }); toast.success("Removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ company_name: "", cnpj: "", status: "ativa", notes: "" }); setFormOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ company_name: t.company_name, cnpj: t.cnpj || "", status: t.status, notes: t.notes || "" }); setFormOpen(true); };

  const filtered = entities.filter((i: any) => i.company_name.toLowerCase().includes(search.toLowerCase()) || (i.cnpj || "").includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Mapeamento Societário</h1><p className="text-muted-foreground">Holdings, SPEs e fundos — organograma de assinaturas e monitoramento de CNPJ.</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Entidade</Button>
      </div>

      <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>

      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma entidade.</TableCell></TableRow> : filtered.map((i: any) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => setDetailOpen(i)}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><Network className="h-4 w-4 text-muted-foreground" />{i.company_name}</div></TableCell>
                  <TableCell>{i.cnpj || "—"}</TableCell>
                  <TableCell><Badge variant={i.status === "ativa" ? "default" : "destructive"}>{i.status}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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

      {/* Detail Dialog with Signatories */}
      <Dialog open={!!detailOpen} onOpenChange={(o) => { if (!o) setDetailOpen(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{detailOpen?.company_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Signatários</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>Papel</TableHead><TableHead>Assina?</TableHead></TableRow></TableHeader>
                <TableBody>
                  {signatories.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Nenhum signatário.</TableCell></TableRow> : signatories.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.cpf || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{s.role}</Badge></TableCell>
                      <TableCell>{s.can_sign ? "Sim" : "Não"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border rounded-md p-4 space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" />Adicionar Signatário</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nome" value={sigForm.name} onChange={(e) => setSigForm({ ...sigForm, name: e.target.value })} />
                <Input placeholder="CPF" value={sigForm.cpf} onChange={(e) => setSigForm({ ...sigForm, cpf: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={sigForm.role} onValueChange={(v) => setSigForm({ ...sigForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="administrador">Administrador</SelectItem><SelectItem value="socio">Sócio</SelectItem><SelectItem value="procurador">Procurador</SelectItem></SelectContent></Select>
                <div className="flex items-center gap-2"><Switch checked={sigForm.can_sign} onCheckedChange={(c) => setSigForm({ ...sigForm, can_sign: c })} /><Label>Pode assinar</Label></div>
              </div>
              <Input placeholder="Regras de assinatura" value={sigForm.signing_rules} onChange={(e) => setSigForm({ ...sigForm, signing_rules: e.target.value })} />
              <Button size="sm" disabled={addSignatory.isPending || !sigForm.name.trim()} onClick={() => addSignatory.mutate()}>Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entity Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Entidade" : "Nova Entidade"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Razão Social</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="inativa">Inativa</SelectItem><SelectItem value="baixada">Baixada</SelectItem><SelectItem value="suspensa">Suspensa</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button disabled={save.isPending || !form.company_name.trim()} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
