import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-CARD-PAYMENT] ${step}${d}`);
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
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Não autenticado");

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id obrigatório");
    logStep("Verifying card payment", { invoice_id });

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: invoice, error: invError } = await adminClient
      .from("tenant_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();
    if (invError || !invoice) throw new Error("Fatura não encontrada");

    if (invoice.status === "quitada") {
      return new Response(JSON.stringify({ status: "already_paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract PaymentIntent ID from notes
    const piMatch = invoice.notes?.match(/Stripe PI: (pi_[a-zA-Z0-9_]+)/);
    if (!piMatch) {
      return new Response(JSON.stringify({ status: "no_payment_intent", message: "Nenhum PaymentIntent encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const piId = piMatch[1];
    logStep("Found PaymentIntent", { piId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(piId);
    logStep("PaymentIntent status", { status: paymentIntent.status });

    if (paymentIntent.status === "succeeded") {
      const now = new Date().toISOString();
      await adminClient.from("tenant_invoices").update({
        status: "quitada",
        paid_amount: Number(invoice.amount) - Number(invoice.discount || 0),
        paid_at: now,
        payment_method: "cartao",
      }).eq("id", invoice_id);

      logStep("Invoice marked as paid", { invoice_id });

      const tenantId = invoice.tenant_id;
      if (tenantId) {
        const { data: sub } = await adminClient
          .from("tenant_subscriptions")
          .select("id, status, expires_at, plan_id")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          const updateData: any = {};

          // Apply pending upgrade: extract target plan ID directly from notes
          const planIdMatch = invoice.notes?.match(/TargetPlanId:\s*([a-f0-9-]+)/);
          if (planIdMatch) {
            const targetPlanId = planIdMatch[1];
            updateData.plan_id = targetPlanId;
            logStep("Applying upgrade after payment", { plan_id: targetPlanId });
          } else {
            // Fallback: try legacy name-based extraction
            const upgradeMatch = invoice.notes?.match(/Upgrade:.*→\s*(.+?)[\.\n]/);
            if (upgradeMatch) {
              const targetPlanName = upgradeMatch[1].trim();
              const { data: targetPlan } = await adminClient
                .from("plans")
                .select("id")
                .eq("name", targetPlanName)
                .single();
              if (targetPlan) {
                updateData.plan_id = targetPlan.id;
                logStep("Applying upgrade after payment (legacy)", { target_plan: targetPlanName, plan_id: targetPlan.id });
              }
            }
          }

          // Reactivate subscription if expired/blocked
          if (sub.status === "expirado" || sub.status === "bloqueado") {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 30);
            updateData.status = "ativo";
            updateData.expires_at = newExpiry.toISOString();
            updateData.blocked_at = null;
            updateData.blocked_reason = null;
            logStep("Subscription reactivated", { tenant_id: tenantId });
          }

          if (Object.keys(updateData).length > 0) {
            updateData.updated_at = now;
            await adminClient.from("tenant_subscriptions").update(updateData).eq("id", sub.id);
          }

          // Reactivate tenant if it was deactivated
          if (sub.status === "expirado" || sub.status === "bloqueado") {
            await adminClient.from("tenants").update({ active: true }).eq("id", tenantId);
            logStep("Tenant reactivated", { tenant_id: tenantId });
          }
        }
      }

      // Handle chat subscription activation
      if (invoice.notes?.startsWith("ChatPlan:")) {
        await activateChatSubscription(adminClient, invoice, now);
      }

      return new Response(JSON.stringify({ status: "paid", paid_at: now }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "pending", payment_status: paymentIntent.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: "Erro ao verificar pagamento" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function activateChatSubscription(adminClient: any, invoice: any, now: string) {
  const tenantId = invoice.tenant_id;
  if (!tenantId) return;

  const notes = invoice.notes || "";

  if (notes.startsWith("ChatPlan:new:")) {
    // Extract subscription ID from notes
    const subMatch = notes.match(/Subscription:\s*([a-f0-9-]+)/);
    if (subMatch) {
      const subId = subMatch[1];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await adminClient.from("chat_subscriptions").update({
        status: "ativo",
        expires_at: expiresAt.toISOString(),
        updated_at: now,
      }).eq("id", subId);
      console.log(`[VERIFY-CARD-PAYMENT] Chat subscription activated: ${subId}`);
    }
  } else if (notes.startsWith("ChatPlan:upgrade")) {
    // Extract target plan ID from notes
    const targetMatch = notes.match(/Target:\s*([a-f0-9-]+)/);
    if (targetMatch) {
      const targetPlanId = targetMatch[1];
      const { data: sub } = await adminClient
        .from("chat_subscriptions")
        .select("id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub) {
        await adminClient.from("chat_subscriptions").update({
          chat_plan_id: targetPlanId,
          updated_at: now,
        }).eq("id", sub.id);
        console.log(`[VERIFY-CARD-PAYMENT] Chat subscription upgraded to plan: ${targetPlanId}`);
      }
    }
  }
}
