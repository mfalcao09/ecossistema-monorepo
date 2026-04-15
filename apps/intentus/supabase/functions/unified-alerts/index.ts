import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData } = await supabase.auth.getClaims(token);
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ alerts: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const alerts: any[] = [];
    const now = new Date();

    // 1. Contracts expiring with overdue installments = CRITICAL churn risk
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, end_date, monthly_value, contract_type")
      .eq("tenant_id", tenantId)
      .eq("status", "ativo")
      .not("end_date", "is", null)
      .lte("end_date", new Date(now.getTime() + 90 * 86400000).toISOString().split("T")[0]);

    if (contracts && contracts.length > 0) {
      for (const contract of contracts) {
        const { data: overdueInstallments } = await supabase
          .from("contract_installments")
          .select("id, amount")
          .eq("contract_id", contract.id)
          .eq("status", "atrasado")
          .limit(5);

        const { data: renewals } = await supabase
          .from("contract_renewals")
          .select("id")
          .eq("contract_id", contract.id)
          .in("status", ["em_andamento", "formalizada"])
          .limit(1);

        if (overdueInstallments && overdueInstallments.length > 0 && (!renewals || renewals.length === 0)) {
          const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - now.getTime()) / 86400000);
          const overdueTotal = overdueInstallments.reduce((s, i) => s + (i.amount || 0), 0);
          alerts.push({
            id: `churn-${contract.id}`,
            level: "critical",
            category: "relacionamento",
            title: "Risco de Churn Crítico",
            message: `Contrato com ${daysLeft} dias para vencer + R$ ${overdueTotal.toFixed(0)} em atraso + sem renovação iniciada.`,
            action: "Iniciar renovação e entrar em contato",
            reference_type: "contract",
            reference_id: contract.id,
            score: 95,
          });
        } else if (!renewals || renewals.length === 0) {
          const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - now.getTime()) / 86400000);
          alerts.push({
            id: `renew-${contract.id}`,
            level: "warning",
            category: "contratos",
            title: "Contrato Vencendo Sem Renovação",
            message: `Contrato vence em ${daysLeft} dias. Nenhuma renovação em andamento.`,
            action: "Iniciar processo de renovação",
            reference_type: "contract",
            reference_id: contract.id,
            score: 70,
          });
        }
      }
    }

    // 2. Tickets > 72h open + tenant with low NPS + expiring contract = churn signal
    const { data: oldTickets } = await supabase
      .from("support_tickets")
      .select("id, subject, person_id, created_at")
      .eq("tenant_id", tenantId)
      .in("status", ["aberto", "em_atendimento"])
      .lte("created_at", new Date(now.getTime() - 72 * 3600000).toISOString());

    if (oldTickets && oldTickets.length > 0) {
      alerts.push({
        id: `sla-breach-${now.getTime()}`,
        level: "warning",
        category: "atendimento",
        title: "SLA em Risco",
        message: `${oldTickets.length} ticket(s) aberto(s) há mais de 72h sem resolução.`,
        action: "Verificar tickets urgentes",
        reference_type: "ticket",
        reference_id: null,
        score: 65,
      });
    }

    // 3. Hot leads + properties available 60+ days = match opportunity
    const { data: hotLeads } = await supabase
      .from("leads")
      .select("id, name, score")
      .eq("tenant_id", tenantId)
      .gte("score", 70)
      .limit(5);

    const { data: vacantProperties } = await supabase
      .from("properties")
      .select("id, title, rental_price")
      .eq("tenant_id", tenantId)
      .eq("status", "disponivel")
      .lte("updated_at", new Date(now.getTime() - 60 * 86400000).toISOString())
      .limit(5);

    if (hotLeads && hotLeads.length > 0 && vacantProperties && vacantProperties.length > 0) {
      alerts.push({
        id: `match-opportunity-${now.getTime()}`,
        level: "opportunity",
        category: "comercial",
        title: "Oportunidade de Match IA",
        message: `${hotLeads.length} lead(s) quente(s) + ${vacantProperties.length} imóvel(is) vago(s) há 60+ dias. Alta chance de fechamento!`,
        action: "Ver sugestões de match",
        reference_type: "lead",
        reference_id: hotLeads[0]?.id || null,
        score: 80,
      });
    }

    // 4. Pending owner transfers
    const { data: pendingTransfers } = await supabase
      .from("owner_transfers")
      .select("id, net_amount")
      .eq("tenant_id", tenantId)
      .eq("status", "pendente")
      .limit(50);

    if (pendingTransfers && pendingTransfers.length > 0) {
      const totalPending = pendingTransfers.reduce((s, t) => s + (t.net_amount || 0), 0);
      if (totalPending > 1000) {
        alerts.push({
          id: `transfers-${now.getTime()}`,
          level: "info",
          category: "financeiro",
          title: "Repasses Pendentes",
          message: `${pendingTransfers.length} repasse(s) aguardando processamento. Total: R$ ${totalPending.toFixed(2)}.`,
          action: "Processar repasses",
          reference_type: "transfer",
          reference_id: null,
          score: 50,
        });
      }
    }

    // Sort by score descending
    alerts.sort((a, b) => b.score - a.score);

    return new Response(JSON.stringify({ alerts: alerts.slice(0, 10) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("unified-alerts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro", alerts: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
