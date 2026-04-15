import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";

export default function LegalLGPD() {
  const [tab, setTab] = useState("consents");
  const [formOpen, setFormOpen] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const qc = useQueryClient();

  const { data: consents = [] } = useQuery({ queryKey: ["lgpd-consents"], queryFn: async () => { const { data, error } = await supabase.from("lgpd_consents").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; } });
  const { data: requests = [] } = useQuery({ queryKey: ["lgpd-requests"], queryFn: async () => { const { data, error } = await supabase.from("lgpd_data_requests").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; } });
  const { data: incidents = [] } = useQuery({ queryKey: ["lgpd-incidents"], queryFn: async () => { const { data, error } = await supabase.from("lgpd_incidents").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; } });

  const saveIncident = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("lgpd_incidents").insert({ ...form, tenant_id, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lgpd-incidents"] }); toast.success("Incidente registrado!"); setFormOpen(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRequest = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("lgpd_data_requests").insert({ ...form, tenant_id, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lgpd-requests"] }); toast.success("Solicitação registrada!"); setFormOpen(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingRequests = requests.filter((r: any) => r.status === "recebida" || r.status === "em_analise").length;
  const openIncidents = incidents.filter((i: any) => i.status !== "resolvido").length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">LGPD e Privacidade</h1><p className="text-muted-foreground">Gestão de consentimentos, solicitações de titulares e incidentes.</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{consents.length}</div><p className="text-xs text-muted-foreground">Consentimentos</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{pendingRequests}</div><p className="text-xs text-muted-foreground">Solicitações Pendentes</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{openIncidents}</div><p className="text-xs text-muted-foreground">Incidentes Abertos</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="consents">Consentimentos</TabsTrigger><TabsTrigger value="requests">Solicitações do Titular</TabsTrigger><TabsTrigger value="incidents">Incidentes</TabsTrigger></TabsList>
        <TabsContent value="consents">
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Canal</TableHead><TableHead>Data</TableHead><TableHead>Revogado</TableHead></TableRow></TableHeader>
              <TableBody>
                {consents.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum consentimento.</TableCell></TableRow> : consents.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell><Badge variant="outline">{c.consent_type}</Badge></TableCell>
                    <TableCell>{c.channel}</TableCell>
                    <TableCell>{format(new Date(c.granted_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{c.revoked_at ? format(new Date(c.revoked_at), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="requests" className="space-y-4">
          <Button onClick={() => { setForm({ request_type: "acesso", status: "recebida", response_notes: "" }); setFormOpen("request"); }}><Plus className="h-4 w-4 mr-2" />Nova Solicitação</Button>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Recebida em</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma solicitação.</TableCell></TableRow> : requests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline">{r.request_type}</Badge></TableCell>
                    <TableCell><Badge variant={r.status === "concluida" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>{format(new Date(r.received_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{r.deadline ? format(new Date(r.deadline), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="incidents" className="space-y-4">
          <Button onClick={() => { setForm({ title: "", description: "", severity: "media", status: "detectado", action_plan: "" }); setFormOpen("incident"); }}><Plus className="h-4 w-4 mr-2" />Novo Incidente</Button>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Severidade</TableHead><TableHead>Status</TableHead><TableHead>Detectado em</TableHead></TableRow></TableHeader>
              <TableBody>
                {incidents.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum incidente.</TableCell></TableRow> : incidents.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.title}</TableCell>
                    <TableCell><Badge variant={i.severity === "critica" ? "destructive" : i.severity === "alta" ? "destructive" : "outline"}>{i.severity}</Badge></TableCell>
                    <TableCell><Badge variant={i.status === "resolvido" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                    <TableCell>{format(new Date(i.detected_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Incident form */}
      <Dialog open={formOpen === "incident"} onOpenChange={(o) => { if (!o) setFormOpen(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Incidente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Severidade</Label><Select value={form.severity || "media"} onValueChange={(v) => setForm({ ...form, severity: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Crítica</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Plano de Ação</Label><Textarea value={form.action_plan || ""} onChange={(e) => setForm({ ...form, action_plan: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(null)}>Cancelar</Button><Button disabled={saveIncident.isPending || !form.title?.trim()} onClick={() => saveIncident.mutate()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request form */}
      <Dialog open={formOpen === "request"} onOpenChange={(o) => { if (!o) setFormOpen(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Solicitação do Titular</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Tipo</Label><Select value={form.request_type || "acesso"} onValueChange={(v) => setForm({ ...form, request_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="acesso">Acesso</SelectItem><SelectItem value="exclusao">Exclusão</SelectItem><SelectItem value="anonimizacao">Anonimização</SelectItem><SelectItem value="portabilidade">Portabilidade</SelectItem><SelectItem value="retificacao">Retificação</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.response_notes || ""} onChange={(e) => setForm({ ...form, response_notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFormOpen(null)}>Cancelar</Button><Button disabled={saveRequest.isPending} onClick={() => saveRequest.mutate()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
