import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard", group: "Principal" },
  { key: "imoveis", label: "Imóveis", group: "Cadastros" },
  { key: "pessoas", label: "Pessoas", group: "Cadastros" },
  { key: "contratos", label: "Contratos", group: "Cadastros" },
  { key: "garantias", label: "Garantias Contratuais (Enterprise)", group: "Cadastros" },
  { key: "comercial_basico", label: "Comercial Básico (Dashboard, Negócios, Pipeline)", group: "Comercial" },
  { key: "comercial_intermediario", label: "Comercial Intermediário (Básico + Visitas, Disponibilidade, Avaliações)", group: "Comercial" },
  { key: "comercial_completo", label: "Comercial Completo (Intermediário + Metas, Exclusividades, Automações, Relatórios)", group: "Comercial" },
  { key: "financeiro_basico", label: "Financeiro Básico (Receitas, Despesas, Fluxo de Caixa, Inadimplência, Faturas)", group: "Financeiro" },
  { key: "financeiro_intermediario", label: "Financeiro Intermediário (Básico + Contas Bancárias, Centros de Custo, Conciliação)", group: "Financeiro" },
  { key: "financeiro_completo", label: "Financeiro Completo (Intermediário + Comissões, Repasses, DRE, IR, DIMOB, etc.)", group: "Financeiro" },
  { key: "relacionamento_basico", label: "Relacionamento Básico (Gestão, Atendimento, Contratos, Rescisões, Renovações)", group: "Relacionamento" },
  { key: "relacionamento_intermediario", label: "Relacionamento Intermediário (Básico + Reajustes, Garantias, Seguros)", group: "Relacionamento" },
  { key: "relacionamento_completo", label: "Relacionamento Completo (Intermediário + Satisfação, Comunicação, Automações, Manutenção)", group: "Relacionamento" },
  { key: "juridico_intermediario", label: "Jurídico Intermediário (Análises, Due Diligence, Notificações, Seguros, Ocupação)", group: "Jurídico" },
  { key: "juridico_completo", label: "Jurídico Completo (Intermediário + Modelos, Procurações, Processos, Compliance, Assinaturas)", group: "Jurídico" },
  { key: "empreendimentos", label: "Lançamentos Imobiliários (Add-on)", group: "Lançamentos" },
  { key: "api", label: "API & Integrações", group: "Extras" },
] as const;

const MODULE_GROUPS = [...new Set(ALL_MODULES.map((m) => m.group))];

interface Plan {
  id: string;
  name: string;
  stripe_price_id: string | null;
  max_users: number | null;
  max_properties: number | null;
  price_monthly: number;
  features: string[];
  modules: string[];
  active: boolean;
  created_at: string;
}

export default function SuperAdminPlans() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: "", stripe_price_id: "", max_users: "", max_properties: "", price_monthly: "", active: true, modules: [] as string[] });
  const qc = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("price_monthly");
      if (error) throw error;
      return data as Plan[];
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name.trim(),
        stripe_price_id: form.stripe_price_id.trim() || null,
        max_users: form.max_users ? parseInt(form.max_users) : null,
        max_properties: form.max_properties ? parseInt(form.max_properties) : null,
        price_monthly: parseFloat(form.price_monthly) || 0,
        active: form.active,
        modules: form.modules,
      };
      if (editing) {
        const { error } = await supabase.from("plans").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
      toast.success(editing ? "Plano atualizado!" : "Plano criado!");
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
      toast.success("Plano excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", stripe_price_id: "", max_users: "", max_properties: "", price_monthly: "", active: true, modules: [] });
    setFormOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      stripe_price_id: plan.stripe_price_id || "",
      max_users: plan.max_users?.toString() || "",
      max_properties: plan.max_properties?.toString() || "",
      price_monthly: plan.price_monthly.toString(),
      active: plan.active,
      modules: Array.isArray(plan.modules) ? plan.modules : [],
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const filtered = plans.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
          <p className="text-muted-foreground">Gerencie os planos de assinatura da plataforma.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Plano</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar plano..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{plans.length} planos</Badge>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço Mensal</TableHead>
                <TableHead>Max Usuários</TableHead>
                <TableHead>Max Imóveis</TableHead>
                <TableHead>Stripe Price ID</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum plano encontrado.</TableCell>
                </TableRow>
              ) : (
                filtered.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{fmt(plan.price_monthly)}</TableCell>
                    <TableCell>{plan.max_users ?? "Ilimitado"}</TableCell>
                    <TableCell>{plan.max_properties ?? "Ilimitado"}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{plan.stripe_price_id || "—"}</code></TableCell>
                    <TableCell>
                      <Badge variant="outline">{Array.isArray(plan.modules) ? plan.modules.length : 0} módulos</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.active ? "default" : "secondary"}>{plan.active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(plan)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deletePlan.mutate(plan.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            <DialogDescription>{editing ? "Atualize as informações e módulos do plano." : "Preencha os dados do novo plano."}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 py-2 pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Profissional" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preço Mensal (R$)</Label>
                    <Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Stripe Price ID</Label>
                    <Input value={form.stripe_price_id} onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })} placeholder="price_..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Usuários</Label>
                    <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} placeholder="Vazio = ilimitado" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Imóveis</Label>
                    <Input type="number" value={form.max_properties} onChange={(e) => setForm({ ...form, max_properties: e.target.value })} placeholder="Vazio = ilimitado" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
                  <Label>Ativo</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm">Módulos Inclusos</h4>
                  <p className="text-xs text-muted-foreground">Selecione quais módulos estarão disponíveis neste plano.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ ...form, modules: ALL_MODULES.map((m) => m.key) })}
                  >
                    Selecionar todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ ...form, modules: [] })}
                  >
                    Limpar
                  </Button>
                </div>
                {MODULE_GROUPS.map((group) => (
                  <div key={group} className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{group}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_MODULES.filter((m) => m.group === group).map((mod) => (
                        <label key={mod.key} className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors">
                          <Checkbox
                            checked={form.modules.includes(mod.key)}
                            onCheckedChange={(checked) => {
                              setForm({
                                ...form,
                                modules: checked
                                  ? [...form.modules, mod.key]
                                  : form.modules.filter((k) => k !== mod.key),
                              });
                            }}
                          />
                          <span className="text-sm">{mod.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button disabled={savePlan.isPending || !form.name.trim()} onClick={() => savePlan.mutate()}>
              {savePlan.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
