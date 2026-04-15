import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DRELine {
  label: string;
  value: number;
  previousValue?: number;
  level: number; // 0=header, 1=item, 2=total
  bold?: boolean;
}

export function useDRE(periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ["dre", periodStart, periodEnd],
    enabled: !!periodStart && !!periodEnd,
    queryFn: async () => {
      // Fetch installments (own revenue)
      const { data: installments } = await supabase
        .from("contract_installments")
        .select("amount, paid_amount, revenue_type, status")
        .gte("due_date", periodStart)
        .lte("due_date", periodEnd)
        .eq("status", "pago");

      // Fetch transfers (admin fees)
      const { data: transfers } = await supabase
        .from("owner_transfers")
        .select("admin_fee_value, status")
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd);

      // Fetch commissions paid
      const { data: commissions } = await supabase
        .from("commission_splits")
        .select("calculated_value, role, status")
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd);

      // Aggregate
      const adminFeeRevenue = (transfers || []).reduce((s, t) => s + Number(t.admin_fee_value || 0), 0);
      const intermediacaoRevenue = (installments || []).filter(i => i.revenue_type === "intermediacao").reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
      const propriaRevenue = (installments || []).filter(i => i.revenue_type === "propria").reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);

      const grossRevenue = adminFeeRevenue + intermediacaoRevenue + propriaRevenue;

      // Simplified tax estimate (ISS 5%, PIS 0.65%, COFINS 3%)
      const taxRate = 0.0865;
      const taxes = grossRevenue * taxRate;
      const netRevenue = grossRevenue - taxes;

      const commissionExpense = (commissions || []).filter(c => c.role !== "house").reduce((s, c) => s + Number(c.calculated_value || 0), 0);
      const operatingResult = netRevenue - commissionExpense;

      const lines: DRELine[] = [
        { label: "(+) Receita Bruta de Serviços", value: grossRevenue, level: 0, bold: true },
        { label: "  Taxa de Administração", value: adminFeeRevenue, level: 1 },
        { label: "  Intermediação", value: intermediacaoRevenue, level: 1 },
        { label: "  Receita Própria", value: propriaRevenue, level: 1 },
        { label: "(-) Impostos sobre Serviços", value: -taxes, level: 0, bold: true },
        { label: "(=) Receita Líquida", value: netRevenue, level: 2, bold: true },
        { label: "(-) Despesas Operacionais", value: -commissionExpense, level: 0, bold: true },
        { label: "  Comissões a Corretores", value: commissionExpense, level: 1 },
        { label: "(=) Resultado Operacional", value: operatingResult, level: 2, bold: true },
      ];

      return { lines, grossRevenue, netRevenue, operatingResult };
    },
  });
}
