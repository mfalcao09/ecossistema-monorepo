import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MODULE_HIERARCHY, expandModules } from "@/hooks/useTenantModules";
import { Package, Check, ShoppingCart, X, Loader2, MessageCircle, Sparkles, ExternalLink, Crown } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ChatPlansDialog } from "@/components/chat/ChatPlansDialog";
import { toast } from "sonner";

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
}

export default function AddonModules() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [chatPlansOpen, setChatPlansOpen] = useState(false);
  const [subscribeDialog, setSubscribeDialog] = useState<AddonProduct | null>(null);
  const [cancelDialog, setCancelDialog] = useState<AddonProduct | null>(null);
  

  // All enabled addon products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["addon-products-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_products")
        .select("*")
        .eq("enabled", true)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as AddonProduct[];
    },
    staleTime: 5 * 60_000,
  });

  // Current tenant's addon subscriptions
  const { data: myAddons = [] } = useQuery({
    queryKey: ["my-addon-subscriptions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_addon_subscriptions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
  });

  // Current tenant plan for eligibility checks
  const { data: currentPlan } = useQuery({
    queryKey: ["my-current-plan", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, plans:plan_id(name, price_monthly, modules)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // WhatsApp subscription
  const { data: chatSubscription } = useQuery({
    queryKey: ["my-chat-subscription", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_subscriptions")
        .select("*, chat_plans:chat_plan_id(*)")
        .eq("tenant_id", tenantId!)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const planName = (currentPlan?.plans as any)?.name?.toLowerCase() || "";
  const planModules = ((currentPlan?.plans as any)?.modules as string[]) || [];
  const expandedPlanModules = useMemo(() => expandModules(planModules), [planModules]);

  // Check if an addon is already active (subscribed, not included in plan)
  const isAddonActive = (moduleKey: string | null) => {
    if (!moduleKey) return false;
    return myAddons.some((a: any) => a.module_key === moduleKey);
  };

  // Check plan eligibility
  const PLAN_RANK: Record<string, number> = { basico: 1, profissional: 2, enterprise: 3 };
  const isEligible = (minPlan: string) => {
    const currentRank = PLAN_RANK[planName] || (planName.includes("profissional") ? 2 : planName.includes("enterprise") ? 3 : 1);
    const requiredRank = PLAN_RANK[minPlan] || 1;
    return currentRank >= requiredRank;
  };

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (product: AddonProduct) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase
        .from("tenant_addon_subscriptions")
        .insert({
          tenant_id: tenantId,
          addon_product_id: product.id,
          module_key: product.module_key || product.slug,
          name: product.name,
          price_monthly: product.price_monthly,
          status: "ativo",
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-addon-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["tenant-modules"] });
      toast.success("Módulo ativado com sucesso! Será incluído na próxima fatura.");
      setSubscribeDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (product: AddonProduct) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase
        .from("tenant_addon_subscriptions")
        .update({ status: "cancelado", cancelled_at: new Date().toISOString() } as any)
        .eq("tenant_id", tenantId)
        .eq("module_key", product.module_key || product.slug);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-addon-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["tenant-modules"] });
      toast.success("Módulo cancelado.");
      setCancelDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Group products by category
  const grouped = products.reduce<Record<string, AddonProduct[]>>((acc, p) => {
    const cat = p.category || "geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" /> Módulos Extras
        </h1>
        <p className="text-muted-foreground">
          Amplie as capacidades do seu sistema com módulos adicionais.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : products.length === 0 || sortedCategories.every((cat) => grouped[cat].every((p) => p.module_key && expandedPlanModules.has(p.module_key))) ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Crown className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold">Você já tem o melhor do sistema!</p>
            <p className="text-muted-foreground text-center max-w-md">
              Todos os módulos disponíveis já estão inclusos no seu plano atual. Aproveite ao máximo todas as funcionalidades.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedCategories.map((category) => {
            const categoryProducts = grouped[category]
              .filter((p) => !(p.module_key && expandedPlanModules.has(p.module_key)));
            if (categoryProducts.length === 0) return null;
            return (
              <div key={category}>
                <h2 className="text-lg font-semibold mb-3">{CATEGORY_LABELS[category] || category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryProducts.map((product) => {
                    const IconComp = getIcon(product.icon);
                    const isWhatsapp = product.slug === "atendimento_whatsapp";
                    const hasWhatsappSub = isWhatsapp && !!chatSubscription;
                    const chatPlan = hasWhatsappSub ? (chatSubscription?.chat_plans as any) : null;
                    const active = isWhatsapp ? hasWhatsappSub : isAddonActive(product.module_key);
                    const eligible = isEligible(product.min_plan);
                    const includedInPlan = product.module_key ? expandedPlanModules.has(product.module_key) : false;

                    return (
                      <Card key={product.id} className="relative overflow-hidden">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-primary/10 p-2.5">
                              <IconComp className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm">{product.name}</h3>
                                {active && (
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <Check className="h-3 w-3" /> Ativo
                                  </Badge>
                                )}
                                {includedInPlan && !active && (
                                  <Badge variant="secondary" className="text-xs">Incluso no plano</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{product.description}</p>
                            </div>
                          </div>

                          {/* WhatsApp active subscription details */}
                          {hasWhatsappSub && chatPlan && (
                            <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{chatPlan.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {chatPlan.included_users ?? chatPlan.max_users} usuários · {chatPlan.max_connections} conexões
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary text-sm">{fmt(Number(chatPlan.price_monthly))}</p>
                                <p className="text-xs text-muted-foreground">/mês</p>
                              </div>
                            </div>
                          )}

                          {/* Price display for non-whatsapp */}
                          {!isWhatsapp && product.price_monthly > 0 && (
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-bold text-primary">{fmt(product.price_monthly)}</span>
                              <span className="text-xs text-muted-foreground">/mês</span>
                            </div>
                          )}

                          {/* Eligibility warning */}
                          {!eligible && !active && (
                            <p className="text-xs text-amber-600">
                              Disponível a partir do plano {product.min_plan.charAt(0).toUpperCase() + product.min_plan.slice(1)}.
                            </p>
                          )}

                          <div className="flex justify-end gap-2">
                            {isWhatsapp ? (
                              <Button
                                variant={hasWhatsappSub ? "outline" : "default"}
                                size="sm"
                                className="gap-1"
                                onClick={() => setChatPlansOpen(true)}
                              >
                                {hasWhatsappSub ? (
                                  <><Sparkles className="h-3.5 w-3.5" /> Gerenciar</>
                                ) : (
                                  <><ExternalLink className="h-3.5 w-3.5" /> Ver planos</>
                                )}
                              </Button>
                            ) : includedInPlan ? (
                              <Badge variant="outline" className="text-xs">Incluso no seu plano</Badge>
                            ) : active ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-destructive hover:text-destructive"
                                onClick={() => setCancelDialog(product)}
                              >
                                <X className="h-3.5 w-3.5" /> Cancelar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="gap-1"
                                disabled={!eligible}
                                onClick={() => setSubscribeDialog(product)}
                              >
                                <ShoppingCart className="h-3.5 w-3.5" /> Assinar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscribe Confirmation Dialog */}
      <Dialog open={!!subscribeDialog} onOpenChange={(o) => { if (!o) setSubscribeDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assinar Módulo Extra</DialogTitle>
            <DialogDescription>
              Confirme a assinatura do módulo <strong>{subscribeDialog?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Módulo</span>
                <span className="font-medium text-sm">{subscribeDialog?.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor mensal</span>
                <span className="font-bold text-primary">{fmt(subscribeDialog?.price_monthly || 0)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O valor será adicionado à sua próxima fatura mensal. O módulo será ativado imediatamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscribeDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => subscribeDialog && subscribeMutation.mutate(subscribeDialog)}
              disabled={subscribeMutation.isPending}
              className="gap-1"
            >
              {subscribeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(o) => { if (!o) setCancelDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Módulo Extra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o módulo <strong>{cancelDialog?.name}</strong>?
              O acesso será removido imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelDialog && cancelMutation.mutate(cancelDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* WhatsApp Plans Dialog */}
      <ChatPlansDialog
        open={chatPlansOpen}
        onOpenChange={(open) => {
          setChatPlansOpen(open);
          if (!open) {
            qc.invalidateQueries({ queryKey: ["my-chat-subscription"] });
          }
        }}
        currentChatPlanId={chatSubscription ? (chatSubscription.chat_plans as any)?.id : null}
        isUpgrade={!!chatSubscription}
      />
    </div>
  );
}
