import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

/**
 * Generate intermediation fee (1st rent) as own revenue when a lease contract is activated.
 */
export async function generateIntermediationFee(
  contractId: string,
  monthlyValue: number,
  startDate: string,
  userId: string
) {
  const { data: contract } = await supabase
    .from("contracts")
    .select("intermediation_fee_generated")
    .eq("id", contractId)
    .single();

  if (contract?.intermediation_fee_generated) return null;

  const tenant_id = await getAuthTenantId();
  const { error } = await supabase.from("contract_installments").insert({
    contract_id: contractId,
    installment_number: 0,
    amount: monthlyValue,
    due_date: startDate,
    status: "pendente",
    created_by: userId,
    notes: "Taxa de intermediação (1º aluguel)",
    revenue_type: "propria",
    tenant_id,
  });

  if (error) throw error;

  await supabase
    .from("contracts")
    .update({ intermediation_fee_generated: true })
    .eq("id", contractId);

  return true;
}

/**
 * Process installment payment via server-side Edge Function.
 * Falls back to client-side logic if the function is unavailable.
 */
export async function processInstallmentPayment(
  installmentId: string,
  _contractId: string,
  paidAmount: number,
  _userId: string
) {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const resp = await fetch(
      `https://${projectId}.supabase.co/functions/v1/process-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ installment_id: installmentId, paid_amount: paidAmount }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Erro no servidor" }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const result = await resp.json();
    return { transfer: result.transfer, ir: result.ir ? { ir_value: 1 } : null };
  } catch (error: any) {
    console.error("process-payment edge function error:", error);
    throw error;
  }
}

/**
 * Determine if commission requires NF or RPA based on person type
 */
export function getRequiredDocType(personType: string | null): { docRequired: boolean; docType: "nf" | "rpa" | null } {
  if (!personType) return { docRequired: false, docType: null };
  if (personType === "juridica") return { docRequired: true, docType: "nf" };
  if (personType === "fisica") return { docRequired: true, docType: "rpa" };
  return { docRequired: false, docType: null };
}
