import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, MoreHorizontal, Plus, Pencil, Trash2, MessageCircle, Power } from "lucide-react";
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

const CHAT_MODULES = [
  { key: "chat_conversas", label: "Conversas e Mensagens" },
  { key: "chat_arquivos", label: "Gestão de Arquivos" },
  { key: "chat_contatos", label: "Gestão de Contatos" },
  { key: "chat_tags", label: "Tags" },
  { key: "chat_campanhas", label: "Campanhas / Disparos" },
  { key: "chat_integracoes", label: "Agentes IA, Webhooks, APIs" },
  { key: "chat_filas", label: "Filas / Setores" },
  { key: "chat_canais", label: "Conexão de Canais" },
] as const;

interface ChatPlan {
  id: string;
  name: string;
  stripe_price_id: string | null;
  price_monthly: number;
  max_users: number;
  max_connections: number;
  included_users: number;
  additional_user_cost: number;
  extra_whatsapp_cost: number;
  extra_social_cost: number;
  asaas_cost: number;
  implementation_fee: number;
  
  activation_fee_wpp: number;
  activation_fee_social: number;
  has_crm: boolean;
  max_funnels: number;
  chatbot_service_limit: number;
  chatbot_automation_limit: number;
  has_webhook: boolean;
  ai_automation_cost: number;
  channels_description: string | null;
  features: string[];
  modules: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
}

const defaultForm = {
  name: "",
  stripe_price_id: "",
  price_monthly: "",
  max_users: "3",
  max_connections: "1",
  included_users: "3",
  additional_user_cost: "0",
  extra_whatsapp_cost: "0",
  extra_social_cost: "0",
  asaas_cost: "0",
  implementation_fee: "0",
  
  activation_fee_wpp: "0",
  activation_fee_social: "0",
  has_crm: false,
  max_funnels: "0",
  chatbot_service_limit: "0",
  chatbot_automation_limit: "0",
  has_webhook: false,
  ai_automation_cost: "0",
  channels_description: "",
  active: true,
  sort_order: "0",
  modules: [] as string[],
};

type FormState = typeof defaultForm;

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h4 className="font-semibold text-sm">{title}</h4>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function NumericField({ label, value, onChange, prefix }: { label: string; value: string; onChange: (v: string) => void; prefix?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}{prefix ? ` (${prefix})` : ""}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function SuperAdminChatPlans() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChatPlan | null>(null);
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const qc = useQueryClient();

  // Product enabled toggle via addon_products table
  const { data: addonProduct } = useQuery({
    queryKey: ["addon-product-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_products")
        .select("id, enabled")
        .eq("slug", "atendimento_whatsapp")
        .maybeSingle();
      if (error) return null;
      return data as { id: string; enabled: boolean } | null;
    },
  });

  const whatsappEnabled = addonProduct?.enabled ?? false;

  const toggleProduct = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!addonProduct?.id) throw new Error("Produto não encontrado");
      const { error } = await supabase
        .from("addon_products")
        .update({ enabled })
        .eq("id", addonProduct.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addon-product-whatsapp"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-product-enabled"] });
      qc.invalidateQueries({ queryKey: ["addon-products-enabled"] });
      toast.success(whatsappEnabled ? "Produto desativado" : "Produto ativado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["superadmin-chat-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_plans")
        .select("*")
        .order("sort_order")
        .order("price_monthly");
      if (error) throw error;
      return data as unknown as ChatPlan[];
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        stripe_price_id: form.stripe_price_id.trim() || null,
        price_monthly: parseFloat(form.price_monthly) || 0,
        max_users: parseInt(form.max_users) || 3,
        max_connections: parseInt(form.max_connections) || 1,
        included_users: parseInt(form.included_users) || 3,
        additional_user_cost: parseFloat(form.additional_user_cost) || 0,
        extra_whatsapp_cost: parseFloat(form.extra_whatsapp_cost) || 0,
        extra_social_cost: parseFloat(form.extra_social_cost) || 0,
        asaas_cost: parseFloat(form.asaas_cost) || 0,
        implementation_fee: parseFloat(form.implementation_fee) || 0,
        
        activation_fee_wpp: parseFloat(form.activation_fee_wpp) || 0,
        activation_fee_social: parseFloat(form.activation_fee_social) || 0,
        has_crm: form.has_crm,
        max_funnels: parseInt(form.max_funnels) || 0,
        chatbot_service_limit: parseInt(form.chatbot_service_limit) || 0,
        chatbot_automation_limit: parseInt(form.chatbot_automation_limit) || 0,
        has_webhook: form.has_webhook,
        ai_automation_cost: parseFloat(form.ai_automation_cost) || 0,
        channels_description: form.channels_description.trim() || null,
        active: form.active,
        sort_order: parseInt(form.sort_order) || 0,
        modules: form.modules,
      };
      if (editing) {
        const { error } = await supabase.from("chat_plans").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chat_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-chat-plans"] });
      toast.success(editing ? "Plano atualizado!" : "Plano criado!");
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-chat-plans"] });
      toast.success("Plano excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setFormOpen(true);
  };

  const openEdit = (plan: ChatPlan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      stripe_price_id: plan.stripe_price_id || "",
      price_monthly: plan.price_monthly.toString(),
      max_users: plan.max_users.toString(),
      max_connections: plan.max_connections.toString(),
      included_users: (plan.included_users ?? 3).toString(),
      additional_user_cost: (plan.additional_user_cost ?? 0).toString(),
      extra_whatsapp_cost: (plan.extra_whatsapp_cost ?? 0).toString(),
      extra_social_cost: (plan.extra_social_cost ?? 0).toString(),
      asaas_cost: (plan.asaas_cost ?? 0).toString(),
      implementation_fee: (plan.implementation_fee ?? 0).toString(),
      
      activation_fee_wpp: (plan.activation_fee_wpp ?? 0).toString(),
      activation_fee_social: (plan.activation_fee_social ?? 0).toString(),
      has_crm: plan.has_crm ?? false,
      max_funnels: (plan.max_funnels ?? 0).toString(),
      chatbot_service_limit: (plan.chatbot_service_limit ?? 0).toString(),
      chatbot_automation_limit: (plan.chatbot_automation_limit ?? 0).toString(),
      has_webhook: plan.has_webhook ?? false,
      ai_automation_cost: (plan.ai_automation_cost ?? 0).toString(),
      channels_description: plan.channels_description || "",
      active: plan.active,
      sort_order: plan.sort_order.toString(),
      modules: Array.isArray(plan.modules) ? plan.modules : [],
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const filtered = plans.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Planos Atendimento WhatsApp</h1>
          </div>
          <p className="text-muted-foreground">Gerencie os planos de assinatura do produto de atendimento.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Plano</Button>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <Power className={`h-4 w-4 ${whatsappEnabled ? "text-green-600" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium whitespace-nowrap">Ativar Produto</span>
            <Switch
              checked={whatsappEnabled}
              onCheckedChange={(c) => toggleProduct.mutate(c)}
              disabled={toggleProduct.isPending}
            />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar plano..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{plans.length} planos</Badge>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço Mensal</TableHead>
                <TableHead>Licenças</TableHead>
                <TableHead>Conexões</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead>Sub-módulos</TableHead>
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
                    <TableCell>{plan.included_users ?? plan.max_users} usuários</TableCell>
                    <TableCell>{plan.max_connections} canais</TableCell>
                    <TableCell className="text-xs">{plan.channels_description || "—"}</TableCell>
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

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Plano WhatsApp" : "Novo Plano WhatsApp"}</DialogTitle>
            <DialogDescription>{editing ? "Atualize as informações do plano." : "Preencha os dados do novo plano."}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 py-2 pr-4">
              {/* Section 1 - Dados Básicos */}
              <div className="space-y-4">
                <SectionTitle title="Dados Básicos" />
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: INTER" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <NumericField label="Preço Mensal" prefix="R$" value={form.price_monthly} onChange={(v) => setField("price_monthly", v)} />
                  <div className="space-y-2">
                    <Label>Stripe Price ID</Label>
                    <Input value={form.stripe_price_id} onChange={(e) => setField("stripe_price_id", e.target.value)} placeholder="price_..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <NumericField label="Ordem de exibição" value={form.sort_order} onChange={(v) => setField("sort_order", v)} />
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={form.active} onCheckedChange={(c) => setField("active", c)} />
                    <Label>Ativo</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section 2 - Limites */}
              <div className="space-y-4">
                <SectionTitle title="Limites" description="Usuários e conexões inclusos no plano." />
                <div className="grid grid-cols-3 gap-4">
                  <NumericField label="Usuários Inclusos" value={form.included_users} onChange={(v) => setField("included_users", v)} />
                  <NumericField label="Max Conexões" value={form.max_connections} onChange={(v) => setField("max_connections", v)} />
                  <div className="space-y-2">
                    <Label>Descrição dos Canais</Label>
                    <Input value={form.channels_description} onChange={(e) => setField("channels_description", e.target.value)} placeholder="1 WPP + 1 IG + 1 FB" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section 3 - Custos Adicionais */}
              <div className="space-y-4">
                <SectionTitle title="Custos Adicionais" description="Valores cobrados por recurso extra." />
                <div className="grid grid-cols-2 gap-4">
                  <NumericField label="Usuário adicional" prefix="R$" value={form.additional_user_cost} onChange={(v) => setField("additional_user_cost", v)} />
                  <NumericField label="WhatsApp adicional" prefix="R$" value={form.extra_whatsapp_cost} onChange={(v) => setField("extra_whatsapp_cost", v)} />
                  <NumericField label="IG/FB adicional" prefix="R$" value={form.extra_social_cost} onChange={(v) => setField("extra_social_cost", v)} />
                  <NumericField label="Pagamentos ASAAS" prefix="R$" value={form.asaas_cost} onChange={(v) => setField("asaas_cost", v)} />
                </div>
              </div>

              <Separator />

              {/* Section 4 - Taxas */}
              <div className="space-y-4">
                <SectionTitle title="Taxas" description="Taxas de implantação e ativação. Upgrade = mensalidade destino − mensalidade atual." />
                <div className="grid grid-cols-2 gap-4">
                  <NumericField label="Implantação" prefix="R$" value={form.implementation_fee} onChange={(v) => setField("implementation_fee", v)} />
                  <NumericField label="Ativação WhatsApp" prefix="R$" value={form.activation_fee_wpp} onChange={(v) => setField("activation_fee_wpp", v)} />
                  <NumericField label="Ativação IG/FB" prefix="R$" value={form.activation_fee_social} onChange={(v) => setField("activation_fee_social", v)} />
                </div>
              </div>

              <Separator />

              {/* Section 5 - Funcionalidades */}
              <div className="space-y-4">
                <SectionTitle title="Funcionalidades" description="Recursos e limites de chatbot inclusos." />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.has_crm} onCheckedChange={(c) => setField("has_crm", c)} />
                    <Label>CRM incluso</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.has_webhook} onCheckedChange={(c) => setField("has_webhook", c)} />
                    <Label>Webhook incluso</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <NumericField label="Funis" value={form.max_funnels} onChange={(v) => setField("max_funnels", v)} />
                  <NumericField label="Chatbots Atendimento" value={form.chatbot_service_limit} onChange={(v) => setField("chatbot_service_limit", v)} />
                  <NumericField label="Chatbots Automação" value={form.chatbot_automation_limit} onChange={(v) => setField("chatbot_automation_limit", v)} />
                  <NumericField label="IA Automação custo" prefix="R$" value={form.ai_automation_cost} onChange={(v) => setField("ai_automation_cost", v)} />
                </div>
              </div>

              <Separator />

              {/* Section 6 - Sub-módulos */}
              <div className="space-y-4">
                <SectionTitle title="Sub-módulos Inclusos" description="Selecione quais funcionalidades estarão disponíveis neste plano." />
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={() => setField("modules", CHAT_MODULES.map((m) => m.key))}>
                    Selecionar todos
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setField("modules", [])}>
                    Limpar
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CHAT_MODULES.map((mod) => (
                    <label key={mod.key} className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors">
                      <Checkbox
                        checked={form.modules.includes(mod.key)}
                        onCheckedChange={(checked) => {
                          setField(
                            "modules",
                            checked
                              ? [...form.modules, mod.key]
                              : form.modules.filter((k) => k !== mod.key),
                          );
                        }}
                      />
                      <span className="text-sm">{mod.label}</span>
                    </label>
                  ))}
                </div>
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
