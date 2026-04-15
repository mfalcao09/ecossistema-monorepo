import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnifiedAlert {
  id: string;
  level: "critical" | "warning" | "opportunity" | "info";
  category: string;
  title: string;
  message: string;
  action: string;
  reference_type: string | null;
  reference_id: string | null;
  score: number;
}

export function useUnifiedAlerts() {
  return useQuery({
    queryKey: ["unified-alerts"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { alerts: [] as UnifiedAlert[] };

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/unified-alerts`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) return { alerts: [] as UnifiedAlert[] };
      return resp.json() as Promise<{ alerts: UnifiedAlert[] }>;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
