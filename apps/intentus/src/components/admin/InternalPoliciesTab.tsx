import { useState } from "react";
import { useInternalPolicies } from "@/hooks/useInternalPolicies";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Users, Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function InternalPoliciesTab() {
  const { tenantId } = useAuth();
  const { policies, acceptances, isLoading, createPolicy, updatePolicy, deletePolicy } = useInternalPolicies();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [published, setPublished] = useState(false);
  const [viewPolicyId, setViewPolicyId] = useState<string | null>(null);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users-for-policies", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").eq("tenant_id", tenantId!).eq("active", true);
      return data ?? [];
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setRequiresAcceptance(false);
    setPublished(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (editId) {
      await updatePolicy.mutateAsync({ id: editId, title, content, requires_acceptance: requiresAcceptance, published });
    } else {
      await createPolicy.mutateAsync({ title, content, requires_acceptance: requiresAcceptance, published });
    }
    resetForm();
  };

  const startEdit = (p: any) => {
    setEditId(p.id);
    setTitle(p.title);
    setContent(p.content);
    setRequiresAcceptance(p.requires_acceptance);
    setPublished(p.published);
    setShowForm(true);
  };

  const viewPolicy = policies.find((p) => p.id === viewPolicyId);
  const policyAcceptances = viewPolicyId ? acceptances.filter((a) => a.policy_id === viewPolicyId) : [];
  const getUserName = (userId: string) => allUsers.find((u) => u.user_id === userId)?.name || "Usuário";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie termos de uso e documentos internos.</p>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />Nova Política
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Política" : "Nova Política"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Conteúdo (Markdown)" value={content} onChange={(e) => setContent(e.target.value)} rows={10} />
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={requiresAcceptance} onCheckedChange={setRequiresAcceptance} />
                Exige aceite
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={published} onCheckedChange={setPublished} />
                Publicada
              </label>
            </div>
            <Button onClick={handleSubmit} disabled={createPolicy.isPending || updatePolicy.isPending} className="w-full">
              {editId ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPolicyId} onOpenChange={() => setViewPolicyId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceites: {viewPolicy?.title}</DialogTitle>
          </DialogHeader>
          {policyAcceptances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aceite registrado.</p>
          ) : (
            <div className="space-y-2">
              {policyAcceptances.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm">{getUserName(a.user_id)}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(a.accepted_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : policies.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">Nenhuma política cadastrada.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => {
            const accCount = acceptances.filter((a) => a.policy_id === p.id).length;
            return (
              <Card key={p.id}>
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.title}</span>
                      <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
                      {p.published ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800">Publicada</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Rascunho</Badge>
                      )}
                      {p.requires_acceptance && <Badge variant="outline" className="text-[10px]">Aceite obrigatório</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Criada em {format(new Date(p.created_at), "dd/MM/yy", { locale: ptBR })}
                      {p.requires_acceptance && ` • ${accCount} aceite(s)`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {p.requires_acceptance && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewPolicyId(p.id)}>
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(p)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deletePolicy.mutate(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
