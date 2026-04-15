import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useSalesMirrorData(developmentId?: string) {
  return useQuery({
    queryKey: ["sales-mirror", developmentId],
    enabled: !!developmentId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const blocksQ = supabase.from("development_blocks").select("*").eq("development_id", developmentId!).order("sort_order");
      const unitsQ = supabase.from("development_units").select("*").eq("development_id", developmentId!).order("unit_identifier");
      const devQ = supabase.from("developments").select("*").eq("id", developmentId!);
      if (tenantId) {
        blocksQ.eq("tenant_id", tenantId);
        unitsQ.eq("tenant_id", tenantId);
        devQ.eq("tenant_id", tenantId);
      }
      const [blocksRes, unitsRes, devRes] = await Promise.all([
        blocksQ,
        unitsQ,
        devQ.single(),
      ]);
      if (blocksRes.error) throw blocksRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (devRes.error) throw devRes.error;

      const units = unitsRes.data ?? [];
      const totalVGV = units.reduce((s, u) => s + (Number(u.valor_tabela) || Number(u.price) || 0), 0);
      const soldVGV = units.filter(u => u.status === "vendido").reduce((s, u) => s + (Number(u.valor_tabela) || Number(u.price) || 0), 0);

      return {
        development: devRes.data,
        blocks: blocksRes.data ?? [],
        units,
        stats: {
          total: units.length,
          disponivel: units.filter(u => u.status === "disponivel").length,
          reservada: units.filter(u => u.status === "reservada").length,
          proposta_em_analise: units.filter(u => u.status === "proposta_em_analise").length,
          vendida: units.filter(u => u.status === "vendido").length,
          bloqueada: units.filter(u => u.status === "bloqueada").length,
          totalVGV,
          soldVGV,
          pctVGV: totalVGV > 0 ? Math.round((soldVGV / totalVGV) * 100) : 0,
        },
      };
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
