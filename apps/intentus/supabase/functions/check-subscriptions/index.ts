import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: only cron (anon key) or service role
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (token !== anonKey && token !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const now = new Date().toISOString();
    let expired = 0;
    let invoicesMarked = 0;
    let tenantsDeactivated = 0;

    // 1. Expire active subscriptions past their expires_at (exclude 'permanente')
    const { data: expiredSubs, error: expErr } = await supabase
      .from("tenant_subscriptions")
      .update({ status: "expirado", blocked_at: now, blocked_reason: "Assinatura expirada automaticamente" })
      .eq("status", "ativo")
      .lt("expires_at", now)
      .neq("status", "permanente")
      .select("id, tenant_id");

    if (expErr) console.error("Error expiring subs:", expErr);
    expired = expiredSubs?.length || 0;
    console.log(`Expired ${expired} subscriptions`);

    // 2. Deactivate tenants whose subscriptions just expired
    if (expiredSubs && expiredSubs.length > 0) {
      const tenantIds = expiredSubs.map((s: any) => s.tenant_id);
      const { data: deactivated, error: deactErr } = await supabase
        .from("tenants")
        .update({ active: false })
        .in("id", tenantIds)
        .neq("id", "00000000-0000-0000-0000-000000000001")
        .select("id");

      if (deactErr) console.error("Error deactivating tenants:", deactErr);
      tenantsDeactivated = deactivated?.length || 0;
      console.log(`Deactivated ${tenantsDeactivated} tenants`);
    }

    // 3. Mark overdue invoices as 'vencida'
    const { data: overdueInvoices, error: ovErr } = await supabase
      .from("tenant_invoices")
      .update({ status: "vencida" })
      .eq("status", "aberta")
      .lt("due_date", now.split("T")[0])
      .select("id");

    if (ovErr) console.error("Error marking overdue invoices:", ovErr);
    invoicesMarked = overdueInvoices?.length || 0;
    console.log(`Marked ${invoicesMarked} invoices as vencida`);

    // 4. Create notifications for expired tenants
    if (expiredSubs && expiredSubs.length > 0) {
      // Fetch plan info for each expired sub to determine if trial
      const subIds = expiredSubs.map((s: any) => s.id);
      const { data: subsWithPlans } = await supabase
        .from("tenant_subscriptions")
        .select("id, tenant_id, plan_id, plans:plan_id(price_monthly)")
        .in("id", subIds);

      const subPlanMap = new Map<string, number>();
      for (const s of (subsWithPlans || [])) {
        subPlanMap.set(s.id, Number((s.plans as any)?.price_monthly ?? 1));
      }

      for (const sub of expiredSubs) {
        const isTrial = (subPlanMap.get(sub.id) || 1) === 0;
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("tenant_id", sub.tenant_id)
          .in("role", ["admin", "gerente"]);

        if (admins) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: isTrial ? "Período de Teste Expirado" : "Assinatura Expirada",
              message: isTrial
                ? "Seu período de teste expirou. Acesse Meu Plano para escolher um plano e continuar usando a plataforma."
                : "Sua assinatura expirou e a empresa foi inativada. Acesse Administração > Faturas para regularizar.",
              category: "sistema",
              reference_type: "subscription",
              reference_id: sub.id,
              tenant_id: sub.tenant_id,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      message: "Subscription check completed",
      expired,
      tenants_deactivated: tenantsDeactivated,
      invoices_marked: invoicesMarked,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("check-subscriptions error:", error);
    return new Response(JSON.stringify({ error: "Erro ao verificar assinaturas" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
