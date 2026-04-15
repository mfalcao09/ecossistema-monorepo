import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AddonProduct {
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

export function useAddonProducts() {
  const { data, isLoading } = useQuery({
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

  return {
    products: data ?? [],
    isLoading,
    hasProducts: (data?.length ?? 0) > 0,
  };
}
