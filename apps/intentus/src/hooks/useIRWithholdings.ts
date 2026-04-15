import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export const irStatusLabels: Record<string, string> = {
  registrado: "Registrado",
  cancelado: "Cancelado",
};

const FALLBACK_BRACKETS = [
  { min: 0, max: 2259.20, rate: 0, deduction: 0 },
  { min: 2259.21, max: 2826.65, rate: 7.5, deduction: 169.44 },
  { min: 2826.66, max: 3751.05, rate: 15, deduction: 381.44 },
  { min: 3751.06, max: 4664.68, rate: 22.5, deduction: 662.77 },
  { min: 4664.69, max: Infinity, rate: 27.5, deduction: 896.0 },
];

export type IRBracket = { min: number; max: number; rate: number; deduction: number };

export function useIRBrackets(year?: number) {
  const targetYear = year || new Date().getFullYear();
  return useQuery({
    queryKey: ["ir-brackets", targetYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ir_brackets")
        .select("*")
        .eq("reference_year", targetYear)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        const { data: prev } = await supabase
          .from("ir_brackets")
          .select("*")
          .order("reference_year", { ascending: false })
          .order("sort_order", { ascending: true })
          .limit(10);
        if (prev && prev.length > 0) {
          const maxYear = prev[0].reference_year;
          return prev.filter((b) => b.reference_year === maxYear).map((b) => ({
            min: Number(b.min_value),
            max: Number(b.max_value) >= 999999990 ? Infinity : Number(b.max_value),
            rate: Number(b.rate),
            deduction: Number(b.deduction),
          })) as IRBracket[];
        }
        return FALLBACK_BRACKETS;
      }
      return data.map((b) => ({
        min: Number(b.min_value),
        max: Number(b.max_value) >= 999999990 ? Infinity : Number(b.max_value),
        rate: Number(b.rate),
        deduction: Number(b.deduction),
      })) as IRBracket[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function calculateIR(grossRent: number, brackets?: IRBracket[]) {
  const br = brackets || FALLBACK_BRACKETS;
  const bracket = br.find((b) => grossRent >= b.min && grossRent <= b.max) || br[br.length - 1];
  const irValue = Math.max(0, (grossRent * bracket.rate) / 100 - bracket.deduction);
  return {
    ir_base: grossRent,
    ir_rate: bracket.rate,
    ir_deduction: bracket.deduction,
    ir_value: Math.round(irValue * 100) / 100,
  };
}

export function useIRWithholdings(contractId?: string) {
  return useQuery({
    queryKey: ["ir-withholdings", contractId],
    queryFn: async () => {
      let q = supabase
        .from("ir_withholdings")
        .select("*, contracts:contract_id ( id, monthly_value, properties:property_id ( id, title ) ), tenant:tenant_person_id ( id, name, cpf_cnpj, person_type ), owner:owner_person_id ( id, name, cpf_cnpj, person_type )")
        .order("reference_month", { ascending: false });
      if (contractId) q = q.eq("contract_id", contractId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateIRWithholding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      contract_id: string;
      tenant_person_id: string;
      owner_person_id: string;
      reference_month: string;
      gross_rent: number;
      ir_base: number;
      ir_rate: number;
      ir_deduction: number;
      ir_value: number;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("ir_withholdings").insert({
        ...form,
        status: "registrado",
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ir-withholdings"] });
      toast.success("Retenção de IR registrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
