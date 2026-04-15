import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authorization: only service role or cron should trigger this
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // Allow anon key (from cron) or service role key; reject everything else
  if (token !== anonKey && token !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // 1. Fetch active collection rules ordered by days_after_due
    const { data: rules, error: rulesErr } = await supabase
      .from("collection_rules")
      .select("*")
      .eq("active", true)
      .order("days_after_due", { ascending: true });

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No active rules", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 0. Auto-mark all overdue installments as "atrasado"
    const { data: overdueCount } = await supabase.rpc("mark_overdue_installments");
    console.log(`Marked ${overdueCount ?? 0} installments as atrasado`);

    const today = new Date();
    let totalProcessed = 0;

    for (const rule of rules) {
      // Calculate the target due date: today - days_after_due
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - rule.days_after_due);
      const targetStr = targetDate.toISOString().split("T")[0];

      // 2. Find overdue installments that match this rule's timing
      // Status must be "pendente" or "atrasado" and due_date = targetStr
      const { data: installments, error: instErr } = await supabase
        .from("contract_installments")
        .select("id, contract_id, amount, due_date, status")
        .eq("due_date", targetStr)
        .in("status", ["pendente", "atrasado"]);

      if (instErr) {
        console.error("Error fetching installments:", instErr);
        continue;
      }

      if (!installments || installments.length === 0) continue;

      for (const inst of installments) {
        // Check if this event was already generated for this installment + rule
        const { data: existing } = await supabase
          .from("collection_events")
          .select("id")
          .eq("installment_id", inst.id)
          .eq("rule_id", rule.id);

        if (existing && existing.length > 0) continue; // Already processed

        // Mark installment as "atrasado" if still "pendente"
        if (inst.status === "pendente") {
          await supabase
            .from("contract_installments")
            .update({ status: "atrasado" })
            .eq("id", inst.id);
        }

        // 3. Create the collection event
        const { error: eventErr } = await supabase.from("collection_events").insert({
          installment_id: inst.id,
          rule_id: rule.id,
          action_type: rule.action_type,
          status: "enviado",
          notes: `Gerado automaticamente pela régua: ${rule.name} (D+${rule.days_after_due})`,
        });

        if (eventErr) {
          console.error("Error creating event:", eventErr);
          continue;
        }

        // 4. If rule blocks owner transfer, mark existing pending transfers
        if (rule.block_owner_transfer) {
          const { data: transfers } = await supabase
            .from("owner_transfers")
            .select("id")
            .eq("contract_id", inst.contract_id)
            .eq("status", "pendente");

          if (transfers && transfers.length > 0) {
            for (const t of transfers) {
              await supabase.from("owner_transfers").update({
                blocked: true,
                blocked_reason: `Bloqueado pela régua: ${rule.name} — Parcela vencida há ${rule.days_after_due} dias`,
              }).eq("id", t.id);
            }
          }
        }

        // 5. If notify_webhook, send to n8n
        if (rule.notify_webhook) {
          const webhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
          if (webhookSecret) {
            try {
              // Get contract + tenant info for the webhook payload
              const { data: contract } = await supabase
                .from("contracts")
                .select(`
                  id, property_id, monthly_value,
                  contract_parties ( person_id, role, people:person_id ( name, phone ) )
                `)
                .eq("id", inst.contract_id)
                .single();

              const tenant = contract?.contract_parties?.find(
                (p: any) => p.role === "locatario"
              );

              await fetch(webhookSecret, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "collection_triggered",
                  rule_name: rule.name,
                  action_type: rule.action_type,
                  days_after_due: rule.days_after_due,
                  installment_id: inst.id,
                  contract_id: inst.contract_id,
                  amount: inst.amount,
                  due_date: inst.due_date,
                  tenant_name: tenant?.people?.name || null,
                  tenant_phone: (tenant?.people as any)?.phone || null,
                  message_template: rule.message_template,
                }),
              });
            } catch (webhookErr) {
              console.error("Webhook error:", webhookErr);
            }
          }
        }

        // 6. Create notification for the financial team
        // Fetch tenant_id from the installment's contract
        const { data: instContract } = await supabase
          .from("contracts")
          .select("tenant_id")
          .eq("id", inst.contract_id)
          .single();

        const notifTenantId = instContract?.tenant_id;

        if (notifTenantId) {
          // Get admin/gerente/financeiro users for this tenant to notify
          const { data: notifUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("tenant_id", notifTenantId)
            .in("role", ["admin", "gerente", "financeiro"]);

          if (notifUsers && notifUsers.length > 0) {
            for (const nu of notifUsers) {
              await supabase.from("notifications").insert({
                user_id: nu.user_id,
                type: "cobranca",
                title: `Cobrança: ${rule.name}`,
                message: `Parcela de R$ ${Number(inst.amount).toFixed(2)} vencida há ${rule.days_after_due} dias. Ação: ${rule.action_type}`,
                metadata: { installment_id: inst.id, rule_id: rule.id, contract_id: inst.contract_id },
                tenant_id: notifTenantId,
              });
            }
          }
        }

        totalProcessed++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Collection run completed", processed: totalProcessed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Collection run error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar régua de cobrança" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
