import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// IRRF brackets (2025)
const IR_BRACKETS = [
  { min: 0, max: 2259.20, rate: 0, deduction: 0 },
  { min: 2259.21, max: 2826.65, rate: 7.5, deduction: 169.44 },
  { min: 2826.66, max: 3751.05, rate: 15, deduction: 381.44 },
  { min: 3751.06, max: 4664.68, rate: 22.5, deduction: 662.77 },
  { min: 4664.69, max: Infinity, rate: 27.5, deduction: 896.0 },
];

function calculateIR(grossRent: number) {
  const bracket = IR_BRACKETS.find(b => grossRent >= b.min && grossRent <= b.max) || IR_BRACKETS[IR_BRACKETS.length - 1];
  const irValue = Math.max(0, (grossRent * bracket.rate) / 100 - bracket.deduction);
  return {
    ir_base: grossRent,
    ir_rate: bracket.rate,
    ir_deduction: bracket.deduction,
    ir_value: Math.round(irValue * 100) / 100,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { installment_id, paid_amount } = await req.json();
    if (!installment_id) {
      return new Response(JSON.stringify({ error: "installment_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get installment
    const { data: inst } = await supabase.from("contract_installments").select("*").eq("id", installment_id).single();
    if (!inst) throw new Error("Installment not found");
    if (inst.transfer_generated || inst.revenue_type === "propria") {
      return new Response(JSON.stringify({ result: "skipped", reason: "already_processed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const finalAmount = paid_amount || inst.amount;

    // Mark as paid
    await supabase.from("contract_installments").update({
      status: "pago",
      paid_amount: finalAmount,
      payment_date: new Date().toISOString().split("T")[0],
    }).eq("id", installment_id);

    // Get contract with parties
    const { data: contract } = await supabase
      .from("contracts")
      .select("*, contract_parties ( person_id, role, people:person_id ( id, name, person_type, cpf_cnpj ) )")
      .eq("id", inst.contract_id)
      .single();

    if (!contract || contract.contract_type !== "locacao") {
      return new Response(JSON.stringify({ result: "paid", transfer: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parties = contract.contract_parties || [];
    const owner = parties.find((p: any) => p.role === "proprietario");
    const tenant = parties.find((p: any) => p.role === "locatario");

    if (!owner) {
      return new Response(JSON.stringify({ result: "paid", transfer: false, reason: "no_owner" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminFeePct = contract.admin_fee_percentage || 10;
    const adminFeeVal = Math.round(finalAmount * adminFeePct / 100 * 100) / 100;
    const refMonth = new Date().toISOString().slice(0, 7);
    const day = new Date().getDate();
    const cutOff = day <= 10 ? 10 : day <= 20 ? 20 : 30;

    // IR calculation if tenant=PJ and owner=PF
    let irDeduction = 0;
    const tenantPerson = tenant?.people;
    const ownerPerson = owner?.people;

    if (tenantPerson?.person_type === "juridica" && ownerPerson?.person_type === "fisica") {
      const netForOwner = finalAmount - adminFeeVal;
      const irResult = calculateIR(netForOwner);
      irDeduction = irResult.ir_value;

      if (irResult.ir_value > 0) {
        await supabase.from("ir_withholdings").insert({
          contract_id: inst.contract_id,
          tenant_person_id: tenantPerson.id,
          owner_person_id: ownerPerson.id,
          reference_month: refMonth,
          gross_rent: netForOwner,
          ...irResult,
          status: "pendente",
          created_by: user.id,
          notes: "Gerado automaticamente via process-payment",
        });
      }
    }

    const netAmount = finalAmount - adminFeeVal - irDeduction;

    // Create owner transfer
    await supabase.from("owner_transfers").insert({
      contract_id: inst.contract_id,
      owner_person_id: owner.person_id,
      reference_month: refMonth,
      gross_amount: finalAmount,
      admin_fee_percentage: adminFeePct,
      admin_fee_value: adminFeeVal,
      deductions_total: irDeduction,
      net_amount: Math.max(0, netAmount),
      status: "pendente",
      cut_off_day: cutOff,
      created_by: user.id,
    });

    // Mark transfer generated
    await supabase.from("contract_installments").update({ transfer_generated: true }).eq("id", installment_id);

    return new Response(JSON.stringify({ result: "paid", transfer: true, ir: irDeduction > 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-payment error:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar pagamento" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
