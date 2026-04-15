import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdminView } from "@/hooks/useSuperAdminView";

/**
 * Hierarchy map: a module key grants access to all its children.
 */
export const MODULE_HIERARCHY: Record<string, string[]> = {
  // Comercial
  comercial_completo: [
    "comercial_intermediario", "comercial_basico",
    "addon_metas_ranking", "addon_exclusividades",
    "addon_relatorios_comercial", "automacoes_comercial",
  ],
  comercial_intermediario: [
    "comercial_basico", "agenda_visitas", "disponibilidade", "avaliacoes_mercado",
  ],
  comercial_basico: [
    "dashboard_comercial", "novo_negocio", "negocios_andamento", "pipeline",
  ],

  // Financeiro
  financeiro_completo: [
    "financeiro_intermediario", "financeiro_basico",
    "addon_comissoes", "addon_repasses", "addon_garantias_contratuais",
    "addon_notas_fiscais", "addon_dre_gerencial", "addon_antecipacao",
    "addon_retencao_ir", "addon_dimob", "addon_relatorios_financeiro",
    "addon_plano_contas", "addon_config_financeiras", "addon_automacoes_financeiro",
  ],
  financeiro_intermediario: [
    "financeiro_basico", "contas_bancarias", "centros_custo", "conciliacao_bancaria",
  ],
  financeiro_basico: [
    "receitas", "despesas", "fluxo_caixa", "inadimplencia", "faturas_emitidas",
  ],

  // Relacionamento
  relacionamento_completo: [
    "relacionamento_intermediario", "relacionamento_basico",
    "addon_pesquisa_satisfacao", "addon_regua_comunicacao",
    "addon_automacoes_relacionamento", "addon_manutencao_vistorias",
  ],
  relacionamento_intermediario: [
    "relacionamento_basico", "reajustes", "liberacao_garantias", "seguros_sinistros",
  ],
  relacionamento_basico: [
    "gestao_relacionamento", "central_atendimento",
    "contratos_relacionamento", "rescisoes", "renovacoes",
  ],

  // Jurídico
  juridico_completo: [
    "juridico_intermediario", "modelos_contrato", "procuracoes",
    "processos_judiciais", "compliance", "assinaturas_digitais", "conformidade_tributaria",
  ],
  juridico_intermediario: [
    "analises", "due_diligence", "notificacoes_extrajudiciais",
    "seguros_obrigatorios", "controle_ocupacao",
  ],
};

/**
 * Expand a set of module keys using the hierarchy.
 * E.g. having "comercial_completo" also grants "comercial_intermediario", "comercial_basico", etc.
 */
export function expandModules(keys: string[]): Set<string> {
  const expanded = new Set<string>(keys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(expanded)) {
      const children = MODULE_HIERARCHY[key];
      if (children) {
        for (const child of children) {
          if (!expanded.has(child)) {
            expanded.add(child);
            changed = true;
          }
        }
      }
    }
  }
  return expanded;
}

/**
 * Returns the list of module keys enabled for the current tenant's plan + addon subscriptions.
 * Superadmins and master tenant get all modules (unless impersonating).
 */
export function useTenantModules() {
  const { tenantId, roles } = useAuth();
  const { isImpersonating } = useSuperAdminView();
  const isSuperadmin = roles.includes("superadmin");
  const isMasterTenant = tenantId === "00000000-0000-0000-0000-000000000001";
  const shouldBypass = (isSuperadmin || isMasterTenant) && !isImpersonating;

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-modules", tenantId],
    enabled: !!tenantId && !shouldBypass,
    queryFn: async () => {
      // 1. Get subscription & plan modules
      const { data: sub } = await supabase
        .from("tenant_subscriptions")
        .select("plan_id, status, expires_at, blocked_at, blocked_reason")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) return { modules: [] as string[], subscriptionStatus: "none" as string, blocked: false, extraUsers: 0, extraProperties: 0 };

      const isExpired = sub.status === "expirado" || (sub.expires_at && new Date(sub.expires_at) < new Date());
      const isBlocked = isExpired || !!sub.blocked_at;

      if (!sub.plan_id) return { modules: [], subscriptionStatus: sub.status, blocked: isBlocked, extraUsers: 0, extraProperties: 0 };

      const { data: plan } = await supabase
        .from("plans")
        .select("modules, price_monthly")
        .eq("id", sub.plan_id)
        .single();

      const planModules = plan?.modules && Array.isArray(plan.modules) ? plan.modules as string[] : [];
      const priceMonthly = plan?.price_monthly ?? -1;

      // 2. Get active addon subscriptions
      const { data: addons } = await supabase
        .from("tenant_addon_subscriptions")
        .select("module_key")
        .eq("tenant_id", tenantId!)
        .eq("status", "ativo");

      const addonKeys = (addons ?? []).map((a: any) => a.module_key);

      // 3. Get extra resources
      const { data: extras } = await supabase
        .from("tenant_extra_resources")
        .select("resource_type, quantity")
        .eq("tenant_id", tenantId!)
        .eq("status", "ativo");

      const extraUsers = (extras ?? []).find((e: any) => e.resource_type === "users")?.quantity || 0;
      const extraProperties = (extras ?? []).find((e: any) => e.resource_type === "properties")?.quantity || 0;

      // 4. Merge and expand
      const allKeys = [...planModules, ...addonKeys];

      return { modules: allKeys, subscriptionStatus: sub.status, blocked: isBlocked, extraUsers, extraProperties, isTrial: priceMonthly === 0 };
    },
    staleTime: 60_000,
  });

  if (shouldBypass) {
    return { modules: null, isLoading: false, hasModule: () => true, isBlocked: false, subscriptionStatus: "permanente", extraUsers: 0, extraProperties: 0, isTrial: false };
  }

  const rawModules = data?.modules ?? [];
  const isBlocked = data?.blocked ?? false;
  const subscriptionStatus = data?.subscriptionStatus ?? "none";
  const extraUsers = data?.extraUsers ?? 0;
  const extraProperties = data?.extraProperties ?? 0;
  const isTrial = data?.isTrial ?? false;

  // Expand hierarchy
  const expandedSet = expandModules(rawModules);

  const hasModule = (key: string) => {
    if (!rawModules || rawModules.length === 0) return true;
    return expandedSet.has(key);
  };

  return { modules: rawModules, isLoading, hasModule, isBlocked, subscriptionStatus, extraUsers, extraProperties, isTrial };
}
