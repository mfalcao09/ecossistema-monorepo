import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const DEFAULT_FINANCE_SETTINGS = {
  // Geral
  admin_fee_percentage: 10,
  intermediation_fee_percentage: 100,
  transfer_cut_off_day: 20,
  default_currency: "BRL",
  tax_regime: "lucro_presumido",

  // Multa e Juros
  late_penalty_percentage: 2,
  interest_type: "simples",
  daily_interest_rate: 0.033,
  monthly_interest_rate: 1,
  grace_days: 0,
  apply_monetary_correction: false,
  correction_index: "igpm",

  // IRRF / Retencao
  auto_ir_retention: true,
  iss_rate: 5,
  retain_pis: false,
  retain_cofins: false,
  retain_csll: false,
  custom_pis_rate: 0.65,
  custom_cofins_rate: 3,
  custom_irpj_rate: 1.5,
  custom_csll_rate: 1,

  // Cobranca
  defaulter_tolerance_days: 0,
  reminder_days_before: 3,
  notify_on_due_date: true,
  auto_charge_enabled: false,
  auto_charge_days: 5,
  collection_message_template: "",

  // Comissoes
  sales_commission_percentage: 5,
  rental_commission_percentage: 100,
  house_split_percentage: 50,
  broker_split_percentage: 50,
  retain_ir_on_commissions: true,
  commission_payment_day: 5,

  // Repasses
  deduct_ir_from_transfer: true,
  deduct_fire_insurance: false,
  deduct_iptu: false,
  min_transfer_amount: 0,
  group_transfers_by_owner: true,
};

export type FinanceSettings = typeof DEFAULT_FINANCE_SETTINGS;

export function useFinanceSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["finance-settings"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();
      if (!profile?.tenant_id) return DEFAULT_FINANCE_SETTINGS;

      const { data: tenant } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", profile.tenant_id)
        .single();

      const saved = (tenant?.settings as any)?.finance_settings || {};
      return { ...DEFAULT_FINANCE_SETTINGS, ...saved } as FinanceSettings;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: Partial<FinanceSettings>) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();
      if (!profile?.tenant_id) throw new Error("Sem tenant");

      const { data: tenant } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", profile.tenant_id)
        .single();

      const currentSettings = (tenant?.settings as Record<string, any>) || {};
      const merged = {
        ...currentSettings,
        finance_settings: { ...DEFAULT_FINANCE_SETTINGS, ...currentSettings.finance_settings, ...newSettings },
      };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: merged as any })
        .eq("id", profile.tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  return {
    settings: settings || DEFAULT_FINANCE_SETTINGS,
    isLoading,
    saveSettings: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
