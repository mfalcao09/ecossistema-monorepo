import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Não autenticado");

    // Get tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("Tenant não encontrado");
    const tenantId = profile.tenant_id;

    const { target_plan_id } = await req.json();
    if (!target_plan_id) throw new Error("target_plan_id obrigatório");

    // Get current subscription
    const { data: sub } = await adminClient
      .from("tenant_subscriptions")
      .select("*, plans:plan_id(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!sub) throw new Error("Assinatura não encontrada");

    const currentPlan = sub.plans as any;
    if (!currentPlan) throw new Error("Plano atual não encontrado");

    // Get target plan
    const { data: targetPlan } = await adminClient
      .from("plans")
      .select("*")
      .eq("id", target_plan_id)
      .single();
    if (!targetPlan) throw new Error("Plano alvo não encontrado");
    if (targetPlan.price_monthly <= currentPlan.price_monthly) {
      throw new Error("O plano selecionado deve ser superior ao atual");
    }

    // Calculate days remaining
    const expiresAt = new Date(sub.expires_at);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
    const freeUpgrade = daysRemaining <= 5;

    const upgradeValue = freeUpgrade
      ? 0
      : Math.round((Number(targetPlan.price_monthly) - Number(currentPlan.price_monthly)) * 100) / 100;

    const nextMonthly = Number(targetPlan.price_monthly);

    if (freeUpgrade) {
      // Just update plan, no invoice needed
      await adminClient
        .from("tenant_subscriptions")
        .update({ plan_id: target_plan_id, updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      return new Response(JSON.stringify({
        invoice_id: null,
        amount: 0,
        next_monthly: nextMonthly,
        free_upgrade: true,
        message: "Upgrade aplicado! Próxima fatura já virá com o novo valor.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for existing open upgrade invoice
    const { data: existingInvoice } = await adminClient
      .from("tenant_invoices")
      .select("id, amount, status")
      .eq("tenant_id", tenantId)
      .eq("status", "aberta")
      .like("notes", "Upgrade:%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInvoice) {
      return new Response(JSON.stringify({
        existing_invoice: true,
        invoice_id: existingInvoice.id,
        amount: Number(existingInvoice.amount),
        next_monthly: nextMonthly,
        free_upgrade: false,
        current_plan: currentPlan.name,
        target_plan: targetPlan.name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate upgrade invoice
    const referenceDate = new Date().toISOString().slice(0, 10);
    const dueDate = referenceDate; // Due today

    const items = [
      {
        description: `Upgrade de plano: ${currentPlan.name} → ${targetPlan.name}`,
        quantity: 1,
        amount: upgradeValue,
      },
    ];

    const { data: invoice, error: invErr } = await adminClient
      .from("tenant_invoices")
      .insert({
        tenant_id: tenantId,
        subscription_id: sub.id,
        reference_date: referenceDate,
        due_date: dueDate,
        amount: upgradeValue,
        status: "aberta",
        items: items,
        notes: `Upgrade: ${currentPlan.name} → ${targetPlan.name}. TargetPlanId: ${target_plan_id}. Próxima fatura: R$ ${nextMonthly.toFixed(2)}/mês`,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (invErr) throw new Error("Erro ao gerar fatura de upgrade: " + invErr.message);

    // DO NOT update plan_id here — only after payment is confirmed
    // The verify-card-payment or verify-invoice-payment function will upgrade the plan

    return new Response(JSON.stringify({
      invoice_id: invoice.id,
      amount: upgradeValue,
      next_monthly: nextMonthly,
      free_upgrade: false,
      current_plan: currentPlan.name,
      target_plan: targetPlan.name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[process-upgrade] Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    // Allow business logic errors to pass through
    const safeMsg = /plano|assinatura|fatura/i.test(msg) ? msg : "Erro ao processar upgrade";
    return new Response(JSON.stringify({ error: safeMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
