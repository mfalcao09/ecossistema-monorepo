import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PROCESS-CHAT-SUB] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user?.email) throw new Error("Não autenticado");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("Tenant não encontrado");
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const { chat_plan_id, target_chat_plan_id, extra_connections = 0, extra_users = 0 } = body;
    const isUpgrade = !!target_chat_plan_id;

    logStep("Request", { tenantId, chat_plan_id, target_chat_plan_id, isUpgrade, extra_connections, extra_users });

    if (isUpgrade) {
      // === UPGRADE ===
      const { data: currentSub } = await adminClient
        .from("chat_subscriptions")
        .select("*, chat_plans(*)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!currentSub) throw new Error("Nenhuma assinatura ativa para upgrade");

      const currentPlan = currentSub.chat_plans as any;
      const currentPrice = Number(currentPlan?.price_monthly || 0);

      const { data: targetPlan, error: tpErr } = await adminClient
        .from("chat_plans")
        .select("*")
        .eq("id", target_chat_plan_id)
        .single();
      if (tpErr || !targetPlan) throw new Error("Plano destino não encontrado");

      const targetPrice = Number(targetPlan.price_monthly);
      if (targetPrice <= currentPrice) throw new Error("Plano destino deve ser superior ao atual");

      const upgradeDiff = Math.round((targetPrice - currentPrice) * 100) / 100;

      // Extra connections costs
      const extraWppCost = Number(targetPlan.extra_whatsapp_cost || 0);
      const activationFeePerExtra = Number(targetPlan.activation_fee_wpp || 0);
      const extraMonthlyCost = extra_connections * extraWppCost;
      const extraActivationCost = extra_connections * activationFeePerExtra;

      // Extra users costs
      const extraUserCost = Number(targetPlan.additional_user_cost || 0);
      const extraUsersMonthlyCost = extra_users * extraUserCost;

      const upgradeAmount = Math.round((upgradeDiff + extraMonthlyCost + extraActivationCost + extraUsersMonthlyCost) * 100) / 100;

      // Check for existing open upgrade invoice
      const { data: existingInv } = await adminClient
        .from("tenant_invoices")
        .select("id, amount")
        .eq("tenant_id", tenantId)
        .in("status", ["aberta", "vencida"])
        .like("notes", "ChatPlan:upgrade%")
        .limit(1)
        .maybeSingle();

      if (existingInv) {
        return new Response(JSON.stringify({
          existing_invoice: true,
          invoice_id: existingInv.id,
          amount: Number(existingInv.amount),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create invoice items
      const items: any[] = [
        { description: `Upgrade: ${currentPlan.name} → ${targetPlan.name} (diferença mensal)`, quantity: 1, amount: upgradeDiff },
      ];

      if (extra_connections > 0 && extraWppCost > 0) {
        items.push({ description: `${extra_connections}x WhatsApp extra (mensal)`, quantity: extra_connections, amount: extraMonthlyCost });
      }
      if (extra_connections > 0 && activationFeePerExtra > 0) {
        items.push({ description: `${extra_connections}x Ativação WhatsApp Extra`, quantity: extra_connections, amount: extraActivationCost });
      }
      if (extra_users > 0 && extraUserCost > 0) {
        items.push({ description: `${extra_users}x Usuário extra (mensal)`, quantity: extra_users, amount: extraUsersMonthlyCost });
      }

      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 3);

      const { data: invoice, error: invErr } = await adminClient
        .from("tenant_invoices")
        .insert({
          tenant_id: tenantId,
          amount: upgradeAmount,
          discount: 0,
          due_date: dueDate.toISOString().split("T")[0],
          reference_date: now.toISOString().split("T")[0],
          status: "aberta",
          notes: `ChatPlan:upgrade:${currentPlan.name} → ${targetPlan.name}. Target: ${targetPlan.id}`,
          items,
          created_by: user.id,
        })
        .select()
        .single();
      if (invErr) throw new Error("Erro ao gerar fatura: " + invErr.message);

      logStep("Upgrade invoice created", { invoice_id: invoice.id, amount: upgradeAmount });

      return new Response(JSON.stringify({
        invoice_id: invoice.id,
        amount: upgradeAmount,
        type: "upgrade",
        target_plan_id: targetPlan.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      // === NEW SUBSCRIPTION ===
      if (!chat_plan_id) throw new Error("chat_plan_id obrigatório");

      // Check if already has active subscription
      const { data: existingSub } = await adminClient
        .from("chat_subscriptions")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .in("status", ["ativo", "trial", "pendente"])
        .limit(1)
        .maybeSingle();

      if (existingSub) throw new Error("Já existe uma assinatura ativa ou pendente");

      // Get plan
      const { data: plan, error: planErr } = await adminClient
        .from("chat_plans")
        .select("*")
        .eq("id", chat_plan_id)
        .single();
      if (planErr || !plan) throw new Error("Plano não encontrado");

      const monthlyPrice = Number(plan.price_monthly);
      const implFee = Number(plan.implementation_fee || 0);

      // Extra connections costs
      const extraWppCost = Number(plan.extra_whatsapp_cost || 0);
      const activationFeePerExtra = Number(plan.activation_fee_wpp || 0);
      const extraMonthlyCost = extra_connections * extraWppCost;
      const extraActivationCost = extra_connections * activationFeePerExtra;

      // Extra users costs
      const extraUserCost = Number(plan.additional_user_cost || 0);
      const extraUsersMonthlyCost = extra_users * extraUserCost;

      const totalAmount = monthlyPrice + implFee + extraMonthlyCost + extraActivationCost + extraUsersMonthlyCost;

      // Check for existing open invoice
      const { data: existingInv } = await adminClient
        .from("tenant_invoices")
        .select("id, amount")
        .eq("tenant_id", tenantId)
        .in("status", ["aberta", "vencida"])
        .like("notes", `ChatPlan:new:${plan.id}%`)
        .limit(1)
        .maybeSingle();

      if (existingInv) {
        return new Response(JSON.stringify({
          existing_invoice: true,
          invoice_id: existingInv.id,
          amount: Number(existingInv.amount),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create subscription with status "pendente"
      const { data: sub, error: subErr } = await adminClient
        .from("chat_subscriptions")
        .insert({
          tenant_id: tenantId,
          chat_plan_id: plan.id,
          status: "pendente",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (subErr) throw new Error("Erro ao criar assinatura: " + subErr.message);

      // Create invoice with itemized details
      const items: any[] = [
        { description: `Plano ${plan.name} - Atendimento WhatsApp (mensal)`, quantity: 1, amount: monthlyPrice },
      ];
      if (implFee > 0) {
        items.push({ description: "Taxa de implantação", quantity: 1, amount: implFee });
      }
      if (extra_connections > 0 && extraWppCost > 0) {
        items.push({ description: `${extra_connections}x WhatsApp extra (mensal)`, quantity: extra_connections, amount: extraMonthlyCost });
      }
      if (extra_connections > 0 && activationFeePerExtra > 0) {
        items.push({ description: `${extra_connections}x Ativação WhatsApp Extra`, quantity: extra_connections, amount: extraActivationCost });
      }
      if (extra_users > 0 && extraUserCost > 0) {
        items.push({ description: `${extra_users}x Usuário extra (mensal)`, quantity: extra_users, amount: extraUsersMonthlyCost });
      }

      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 3);

      const { data: invoice, error: invErr } = await adminClient
        .from("tenant_invoices")
        .insert({
          tenant_id: tenantId,
          amount: totalAmount,
          discount: 0,
          due_date: dueDate.toISOString().split("T")[0],
          reference_date: now.toISOString().split("T")[0],
          status: "aberta",
          notes: `ChatPlan:new:${plan.id}. Subscription: ${sub.id}`,
          items,
          created_by: user.id,
        })
        .select()
        .single();
      if (invErr) throw new Error("Erro ao gerar fatura: " + invErr.message);

      logStep("New subscription + invoice created", {
        subscription_id: sub.id,
        invoice_id: invoice.id,
        amount: totalAmount,
        extra_connections,
      });

      return new Response(JSON.stringify({
        invoice_id: invoice.id,
        subscription_id: sub.id,
        amount: totalAmount,
        type: "new",
        items,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
