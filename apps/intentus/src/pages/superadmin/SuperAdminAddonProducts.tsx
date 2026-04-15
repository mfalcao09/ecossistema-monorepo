import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as LucideIcons from "lucide-react";
import { Package, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

/* ── Types ── */
interface AddonProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  enabled: boolean;
  sort_order: number;
  category: string;
  settings: Record<string, unknown>;
  price_monthly: number;
  min_plan: string;
  module_key: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Hierarchy keys (modules included in Enterprise via *_completo) ── */
const HIERARCHY_KEYS = new Set([
  // Comercial
  "addon_metas_ranking", "addon_exclusividades", "addon_relatorios_comercial",
  // Financeiro
  "addon_comissoes", "addon_repasses", "addon_garantias_contratuais",
  "addon_notas_fiscais", "addon_dre_gerencial", "addon_antecipacao",
  "addon_retencao_ir", "addon_dimob", "addon_relatorios_financeiro",
  "addon_plano_contas", "addon_config_financeiras", "addon_automacoes_financeiro",
  // Relacionamento
  "addon_pesquisa_satisfacao", "addon_regua_comunicacao",
  "addon_automacoes_relacionamento", "addon_manutencao_vistorias",
]);

const isProfessionalExtra = (p: AddonProduct) =>
  !!p.module_key && HIERARCHY_KEYS.has(p.module_key);

/* ── Helpers ── */
function getIcon(iconName: string) {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || Package;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CATEGORY_ORDER = ["comercial", "financeiro", "relacionamento", "contabilidade", "juridico", "administracao", "comunicacao", "empreendimentos"];
const CATEGORY_LABELS: Record<string, string> = {
  comercial: "Comercial",
  financeiro: "Financeiro",
  relacionamento: "Relacionamento",
  contabilidade: "Contabilidade Avançada",
  juridico: "Jurídico",
  administracao: "Administração",
  comunicacao: "Comunicação",
  empreendimentos: "Empreendimentos",
  geral: "Outros",
};

/* ── Form ── */
const defaultForm = {
  name: "",
  slug: "",
  description: "",
  icon: "Package",
  category: "geral",
  sort_order: "0",
  enabled: false,
  price_monthly: "0",
  min_plan: "basico",
  module_key: "",
};
type FormState = typeof defaultForm;

/* ── Compact Card ── */
function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggle,
}: {
  product: AddonProduct;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const IconComp = getIcon(product.icon);
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <IconComp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm leading-tight">{product.name}</h4>
            {product.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {product.price_monthly > 0 && (
              <span className="text-sm font-bold text-primary">{fmt(product.price_monthly)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {product.min_plan}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <Switch
              checked={product.enabled}
              onCheckedChange={onToggle}
              className="scale-90"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Category Section ── */
function CategorySection({
  category,
  products,
  onEdit,
  onDelete,
  onToggle,
}: {
  category: string;
  products: AddonProduct[];
  onEdit: (p: AddonProduct) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{CATEGORY_LABELS[category] || category}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
            onToggle={(enabled) => onToggle(p.id, enabled)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Block Section ── */
function BlockSection({
  title,
  description,
  products,
  onEdit,
  onDelete,
  onToggle,
}: {
  title: string;
  description: string;
  products: AddonProduct[];
  onEdit: (p: AddonProduct) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  if (products.length === 0) return null;

  // Group by category
  const grouped = products.reduce<Record<string, AddonProduct[]>>((acc, p) => {
    const cat = p.category || "geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const sortedCats = Object.keys(grouped).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-5">
        {sortedCats.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            products={grouped[cat]}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function SuperAdminAddonProducts() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AddonProduct | null>(null);
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["superadmin-addon-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_products")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as AddonProduct[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/\s+/g, "_"),
        description: form.description.trim(),
        icon: form.icon.trim() || "Package",
        category: form.category.trim() || "geral",
        sort_order: parseInt(form.sort_order) || 0,
        enabled: form.enabled,
        price_monthly: parseFloat(form.price_monthly) || 0,
        min_plan: form.min_plan.trim() || "basico",
        module_key: form.module_key.trim() || null,
      };
      if (!payload.name || !payload.slug) throw new Error("Nome e slug são obrigatórios");
      if (editing) {
        const { error } = await supabase.from("addon_products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("addon_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-addon-products"] });
      qc.invalidateQueries({ queryKey: ["addon-products-enabled"] });
      toast.success(editing ? "Produto atualizado!" : "Produto criado!");
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("addon_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-addon-products"] });
      qc.invalidateQueries({ queryKey: ["addon-products-enabled"] });
      toast.success("Produto excluído!");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("addon_products").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-addon-products"] });
      qc.invalidateQueries({ queryKey: ["addon-products-enabled"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-product-enabled"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ ...defaultForm }); setFormOpen(true); };
  const openEdit = (p: AddonProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description,
      icon: p.icon,
      category: p.category,
      sort_order: p.sort_order.toString(),
      enabled: p.enabled,
      price_monthly: p.price_monthly?.toString() || "0",
      min_plan: p.min_plan || "basico",
      module_key: p.module_key || "",
    });
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const profProducts = filtered.filter(isProfessionalExtra);
  const addonTotalProducts = filtered.filter((p) => !isProfessionalExtra(p));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Add-on Produtos</h1>
          </div>
          <p className="text-muted-foreground">Gerencie os produtos extras (módulos add-on) disponíveis na plataforma.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{products.length} produtos</Badge>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground text-center py-12">Nenhum produto encontrado.</div>
      ) : (
        <Tabs defaultValue="profissional" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profissional">Plano Profissional ({profProducts.length})</TabsTrigger>
            <TabsTrigger value="addon-total">Add-on Total ({addonTotalProducts.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="profissional">
            <BlockSection
              title="Módulos Extras — Plano Profissional"
              description="Extras para o Profissional, já inclusos no Enterprise."
              products={profProducts}
              onEdit={openEdit}
              onDelete={(id) => setDeleteConfirm(id)}
              onToggle={(id, enabled) => toggleEnabled.mutate({ id, enabled })}
            />
          </TabsContent>
          <TabsContent value="addon-total">
            <BlockSection
              title="Módulos Extras — Add-on Total"
              description="Módulos independentes, não inclusos em nenhum plano."
              products={addonTotalProducts}
              onEdit={openEdit}
              onDelete={(id) => setDeleteConfirm(id)}
              onToggle={(id, enabled) => toggleEnabled.mutate({ id, enabled })}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit / Create Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>{editing ? "Atualize as informações do produto." : "Preencha os dados do novo produto add-on."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Atendimento WhatsApp" />
            </div>
            <div className="space-y-2">
              <Label>Slug (identificador único)</Label>
              <Input value={form.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="Ex: atendimento_whatsapp" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Breve descrição do produto..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone (Lucide)</Label>
                <Input value={form.icon} onChange={(e) => setField("icon", e.target.value)} placeholder="MessageCircle" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setField("category", e.target.value)} placeholder="comunicacao" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço Mensal (R$)</Label>
                <Input type="number" value={form.price_monthly} onChange={(e) => setField("price_monthly", e.target.value)} placeholder="199" />
              </div>
              <div className="space-y-2">
                <Label>Plano Mínimo</Label>
                <Input value={form.min_plan} onChange={(e) => setField("min_plan", e.target.value)} placeholder="basico, profissional ou enterprise" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Module Key</Label>
              <Input value={form.module_key} onChange={(e) => setField("module_key", e.target.value)} placeholder="addon_metas_ranking" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordem de exibição</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setField("sort_order", e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.enabled} onCheckedChange={(c) => setField("enabled", c)} />
                <Label>Habilitado</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
