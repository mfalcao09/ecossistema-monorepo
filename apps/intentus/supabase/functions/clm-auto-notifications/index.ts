// clm-auto-notifications v2 — Smart Notifications com urgência, prioridade e 10 triggers
// Roda via pg_cron diário (08:00) ou chamada manual
// 10 triggers: 4 originais + 6 novos (compliance, obrigações, deals, pagamentos, renovações, IA insights)
// IA: Gemini 2.0 Flash via OpenRouter para mensagens contextuais
// v2: priority scoring, urgency_score (0-100), group_key, role-based personalization

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS whitelist ──────────────────────────────────────────
const ALLOWED_ORIGINS_RAW = Deno.env.get("ALLOWED_ORIGINS") || "";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW
  ? ALLOWED_ORIGINS_RAW.split(",").map((o) => o.trim())
  : [];

const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];

function getCorsHeaders(origin?: string | null): Record<string, string> {
  let allowedOrigin = "";
  if (origin) {
    if (PROD_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    } else if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    } else if (
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https:\/\/intentus-plataform-.+\.vercel\.app$/.test(origin)
    ) {
      allowedOrigin = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowedOrigin || PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(data: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

// ── Types ────────────────────────────────────────────────────
type Priority = "critical" | "high" | "normal" | "low";

interface NotificationParams {
  user_id: string;
  tenant_id: string;
  title: string;
  message: string;
  category: string;
  priority: Priority;
  urgency_score: number;
  group_key?: string;
  reference_type?: string;
  reference_id?: string;
}

// ── Priority / Urgency helpers ───────────────────────────────

function computeUrgencyFromDays(daysLeft: number, thresholds: number[]): number {
  // thresholds = [critical, high, normal] e.g. [3, 7, 15]
  if (daysLeft <= thresholds[0]) return 95;
  if (daysLeft <= thresholds[1]) return 75;
  if (daysLeft <= thresholds[2]) return 55;
  return 35;
}

function priorityFromUrgency(urgency: number): Priority {
  if (urgency >= 90) return "critical";
  if (urgency >= 70) return "high";
  if (urgency >= 50) return "normal";
  return "low";
}

// ── IA: Gerar mensagem contextual via Gemini ──────────────────
async function generateAIMessage(
  triggerType: string,
  context: Record<string, unknown>,
  openrouterKey: string | undefined,
): Promise<string | null> {
  if (!openrouterKey) return null;

  const prompt = `Você é o assistente de notificações do CLM Intentus.
Gere uma notificação curta (máx 2 frases) e acionável para o seguinte evento:

Evento: ${triggerType}
Contexto: ${JSON.stringify(context, null, 2)}

A notificação deve ser:
- Profissional mas amigável
- Específica (mencionar nomes, valores e datas quando disponíveis)
- Com call-to-action claro
- Em português brasileiro`;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://app.intentus.com.br",
        "X-Title": "Intentus CLM Notifications",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// ── Criar notificação no banco (v2 — com priority, urgency, group_key) ──
async function createNotification(
  supabase: ReturnType<typeof createClient>,
  params: NotificationParams,
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.user_id,
    tenant_id: params.tenant_id,
    title: params.title,
    message: params.message,
    category: params.category,
    priority: params.priority,
    urgency_score: params.urgency_score,
    group_key: params.group_key || null,
    reference_type: params.reference_type || null,
    reference_id: params.reference_id || null,
    read: false,
  });
  if (error) console.error("Failed to create notification:", error.message);
}

// ── Deduplicação ─────────────────────────────────────────────
async function wasNotifiedRecently(
  supabase: ReturnType<typeof createClient>,
  referenceId: string,
  category: string,
  daysAgo: number,
): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - daysAgo);

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("reference_id", referenceId)
    .eq("category", category)
    .gte("created_at", since.toISOString());

  return (count || 0) > 0;
}

// ── Buscar users do tenant (com role opcional) ───────────────
async function getTenantUsers(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  roles?: string[],
): Promise<string[]> {
  if (roles && roles.length > 0) {
    // Buscar users com roles específicos
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .in("role", roles);
    return [...new Set((data || []).map((p: any) => p.user_id))];
  }
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("tenant_id", tenantId);
  return (data || []).map((p: any) => p.user_id);
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 1: Vencimentos próximos (30/15/7/3 dias)
// ═════════════════════════════════════════════════════════════
async function triggerExpiringContracts(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, end_date, monthly_value, tenant_id,
      properties ( title, neighborhood, city ),
      contract_parties ( people_id, role, people ( name ) )
    `)
    .eq("status", "ativo")
    .not("end_date", "is", null)
    .gte("end_date", new Date().toISOString().split("T")[0])
    .lte(
      "end_date",
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    );

  if (!contracts?.length) return 0;

  for (const c of contracts) {
    if (await wasNotifiedRecently(supabase, c.id, "vencimento", 3)) continue;

    const daysLeft = Math.ceil(
      (new Date(c.end_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    // Notificar em 30, 15, 7 ou 3 dias
    if (![30, 15, 7, 3].some((d) => daysLeft <= d && daysLeft > d - 3)) continue;

    const urgency = computeUrgencyFromDays(daysLeft, [3, 7, 15]);
    const priority = priorityFromUrgency(urgency);

    const property = (c as any).properties;
    const parties = (c as any).contract_parties || [];
    const locatario = parties.find((p: any) => p.role === "locatario")?.people?.name || "—";

    const context = {
      tipo: "Vencimento próximo",
      contrato: c.contract_number || c.id.slice(0, 8),
      imovel: property?.title || "—",
      bairro: property?.neighborhood,
      cidade: property?.city,
      locatario,
      valor_mensal: c.monthly_value,
      dias_restantes: daysLeft,
      data_vencimento: c.end_date,
    };

    const aiMessage = await generateAIMessage("vencimento_proximo", context, openrouterKey);
    const fallbackMessage = `O contrato ${context.contrato} de ${context.imovel} com ${locatario} vence em ${daysLeft} dias (${c.end_date}). Considere iniciar a renovação.`;

    // Role-based: admin + gerente recebem todos, corretor só os seus
    const users = await getTenantUsers(supabase, c.tenant_id, ["admin", "gerente", "superadmin"]);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: c.tenant_id,
        title: `⏰ Contrato vence em ${daysLeft} dias`,
        message: aiMessage || fallbackMessage,
        category: "vencimento",
        priority,
        urgency_score: urgency,
        group_key: `vencimento-${c.id}`,
        reference_type: "contract",
        reference_id: c.id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 2: Contratos sem ação (rascunho parado 7+ dias)
// ═════════════════════════════════════════════════════════════
async function triggerStaleContracts(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const staleSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, contract_number, updated_at, tenant_id, properties ( title )")
    .eq("status", "rascunho")
    .lt("updated_at", staleSince);

  if (!contracts?.length) return 0;

  for (const c of contracts) {
    if (await wasNotifiedRecently(supabase, c.id, "alerta", 7)) continue;

    const daysSinceUpdate = Math.ceil(
      (Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24),
    );

    const urgency = daysSinceUpdate > 30 ? 70 : daysSinceUpdate > 14 ? 55 : 40;
    const priority = priorityFromUrgency(urgency);

    const property = (c as any).properties;
    const context = {
      tipo: "Contrato parado",
      contrato: c.contract_number || c.id.slice(0, 8),
      imovel: property?.title || "—",
      dias_parado: daysSinceUpdate,
    };

    const aiMessage = await generateAIMessage("contrato_parado", context, openrouterKey);
    const fallbackMessage = `O contrato "${context.contrato}" (${context.imovel}) está em rascunho há ${daysSinceUpdate} dias. Deseja retomar a edição?`;

    const users = await getTenantUsers(supabase, c.tenant_id);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: c.tenant_id,
        title: `📝 Contrato parado há ${daysSinceUpdate} dias`,
        message: aiMessage || fallbackMessage,
        category: "alerta",
        priority,
        urgency_score: urgency,
        group_key: `stale-${c.id}`,
        reference_type: "contract",
        reference_id: c.id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 3: Reajustes pendentes
// ═════════════════════════════════════════════════════════════
async function triggerPendingAdjustments(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const today = new Date().toISOString().split("T")[0];

  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, adjustment_index, adjustment_date, monthly_value, tenant_id,
      properties ( title )
    `)
    .eq("status", "ativo")
    .not("adjustment_date", "is", null)
    .lte("adjustment_date", today);

  if (!contracts?.length) return 0;

  for (const c of contracts) {
    const { count: adjCount } = await supabase
      .from("contract_adjustments")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", c.id)
      .eq("adjustment_date", c.adjustment_date);

    if ((adjCount || 0) > 0) continue;
    if (await wasNotifiedRecently(supabase, c.id, "contrato", 7)) continue;

    const daysOverdue = Math.ceil(
      (Date.now() - new Date(c.adjustment_date!).getTime()) / (1000 * 60 * 60 * 24),
    );
    const urgency = daysOverdue > 30 ? 85 : daysOverdue > 14 ? 70 : 55;
    const priority = priorityFromUrgency(urgency);

    const property = (c as any).properties;
    const context = {
      tipo: "Reajuste pendente",
      contrato: c.contract_number || c.id.slice(0, 8),
      imovel: property?.title || "—",
      indice: c.adjustment_index || "IGPM",
      data_reajuste: c.adjustment_date,
      valor_atual: c.monthly_value,
      dias_atraso: daysOverdue,
    };

    const aiMessage = await generateAIMessage("reajuste_pendente", context, openrouterKey);
    const fallbackMessage = `O contrato "${context.contrato}" (${context.imovel}) tem reajuste pendente pelo ${context.indice} desde ${c.adjustment_date}. Valor atual: R$ ${c.monthly_value?.toLocaleString("pt-BR")}.`;

    const users = await getTenantUsers(supabase, c.tenant_id, ["admin", "gerente", "financeiro"]);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: c.tenant_id,
        title: `📊 Reajuste pendente — ${context.indice}`,
        message: aiMessage || fallbackMessage,
        category: "contrato",
        priority,
        urgency_score: urgency,
        group_key: `adjustment-${c.id}`,
        reference_type: "contract",
        reference_id: c.id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 4: Aprovações aguardando (pendentes há 2+ dias)
// ═════════════════════════════════════════════════════════════
async function triggerPendingApprovals(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const staleSince = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: approvals } = await supabase
    .from("contract_approvals")
    .select(`
      id, contract_id, approver_id, step_name, created_at, tenant_id,
      contracts ( contract_number, properties ( title ) )
    `)
    .eq("status", "pendente")
    .lt("created_at", staleSince);

  if (!approvals?.length) return 0;

  for (const a of approvals) {
    if (await wasNotifiedRecently(supabase, a.id, "aprovacao", 2)) continue;

    const daysPending = Math.ceil(
      (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24),
    );

    const urgency = daysPending > 7 ? 90 : daysPending > 4 ? 75 : 60;
    const priority = priorityFromUrgency(urgency);

    const contract = (a as any).contracts;
    const context = {
      tipo: "Aprovação pendente",
      contrato: contract?.contract_number || a.contract_id.slice(0, 8),
      imovel: contract?.properties?.title || "—",
      etapa: a.step_name,
      dias_pendente: daysPending,
    };

    const aiMessage = await generateAIMessage("aprovacao_pendente", context, openrouterKey);
    const fallbackMessage = `Aprovação pendente há ${daysPending} dias para o contrato "${context.contrato}" (${context.imovel}) — etapa: ${a.step_name}.`;

    // Notificar o aprovador específico
    await createNotification(supabase, {
      user_id: a.approver_id,
      tenant_id: a.tenant_id,
      title: `🔔 Aprovação pendente há ${daysPending} dias`,
      message: aiMessage || fallbackMessage,
      category: "aprovacao",
      priority,
      urgency_score: urgency,
      group_key: `approval-${a.contract_id}`,
      reference_type: "approval",
      reference_id: a.id,
    });
    count++;
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 5 (NEW): Violações de compliance não resolvidas
// ═════════════════════════════════════════════════════════════
async function triggerComplianceViolations(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const { data: violations } = await supabase
    .from("compliance_violations")
    .select(`
      id, contract_id, rule_id, rule_name, severity, description, tenant_id, created_at,
      contracts ( contract_number, properties ( title ) )
    `)
    .in("status", ["open", "acknowledged"])
    .in("severity", ["critical", "high"])
    .order("severity", { ascending: true });

  if (!violations?.length) return 0;

  for (const v of violations) {
    if (await wasNotifiedRecently(supabase, v.id, "alerta", 3)) continue;

    const daysOpen = Math.ceil(
      (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24),
    );

    const urgency = v.severity === "critical" ? 95 : daysOpen > 7 ? 80 : 65;
    const priority = priorityFromUrgency(urgency);

    const contract = (v as any).contracts;
    const context = {
      tipo: "Violação de compliance",
      contrato: contract?.contract_number || v.contract_id?.slice(0, 8) || "—",
      imovel: contract?.properties?.title || "—",
      regra: v.rule_name,
      severidade: v.severity,
      descricao: v.description,
      dias_aberta: daysOpen,
    };

    const aiMessage = await generateAIMessage("compliance_violation", context, openrouterKey);
    const fallbackMessage = `Violação de compliance "${v.rule_name}" (${v.severity}) no contrato "${context.contrato}" — ${v.description}. Resolva para manter conformidade.`;

    // Role-based: admin, gerente, juridico para compliance
    const users = await getTenantUsers(supabase, v.tenant_id, ["admin", "gerente", "juridico", "superadmin"]);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: v.tenant_id,
        title: `🛡️ Compliance: ${v.rule_name} (${v.severity})`,
        message: aiMessage || fallbackMessage,
        category: "alerta",
        priority,
        urgency_score: urgency,
        group_key: `compliance-${v.contract_id}`,
        reference_type: "contract",
        reference_id: v.contract_id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 6 (NEW): Obrigações vencidas (overdue)
// ═════════════════════════════════════════════════════════════
async function triggerOverdueObligations(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const today = new Date().toISOString().split("T")[0];

  const { data: obligations } = await supabase
    .from("contract_obligations")
    .select(`
      id, contract_id, title, due_date, obligation_type, tenant_id,
      contracts ( contract_number, properties ( title ) )
    `)
    .eq("status", "pending")
    .lt("due_date", today)
    .limit(100);

  if (!obligations?.length) return 0;

  for (const o of obligations) {
    if (await wasNotifiedRecently(supabase, o.id, "alerta", 3)) continue;

    const daysOverdue = Math.ceil(
      (Date.now() - new Date(o.due_date).getTime()) / (1000 * 60 * 60 * 24),
    );

    const urgency = daysOverdue > 14 ? 90 : daysOverdue > 7 ? 75 : 60;
    const priority = priorityFromUrgency(urgency);

    const contract = (o as any).contracts;
    const context = {
      tipo: "Obrigação vencida",
      obrigacao: o.title,
      contrato: contract?.contract_number || o.contract_id?.slice(0, 8) || "—",
      imovel: contract?.properties?.title || "—",
      tipo_obrigacao: o.obligation_type,
      data_vencimento: o.due_date,
      dias_atraso: daysOverdue,
    };

    const aiMessage = await generateAIMessage("obrigacao_vencida", context, openrouterKey);
    const fallbackMessage = `A obrigação "${o.title}" do contrato "${context.contrato}" venceu há ${daysOverdue} dias (${o.due_date}). Ação imediata necessária.`;

    const users = await getTenantUsers(supabase, o.tenant_id, ["admin", "gerente", "superadmin"]);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: o.tenant_id,
        title: `⚠️ Obrigação vencida há ${daysOverdue} dias`,
        message: aiMessage || fallbackMessage,
        category: "alerta",
        priority,
        urgency_score: urgency,
        group_key: `obligation-overdue-${o.contract_id}`,
        reference_type: "contract",
        reference_id: o.contract_id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 7 (NEW): Obrigações próximas (upcoming 7 dias)
// ═════════════════════════════════════════════════════════════
async function triggerUpcomingObligations(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: obligations } = await supabase
    .from("contract_obligations")
    .select(`
      id, contract_id, title, due_date, obligation_type, tenant_id,
      contracts ( contract_number, properties ( title ) )
    `)
    .eq("status", "pending")
    .gte("due_date", today)
    .lte("due_date", in7days)
    .limit(100);

  if (!obligations?.length) return 0;

  for (const o of obligations) {
    if (await wasNotifiedRecently(supabase, o.id, "contrato", 3)) continue;

    const daysLeft = Math.ceil(
      (new Date(o.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    const urgency = daysLeft <= 2 ? 75 : daysLeft <= 5 ? 55 : 40;
    const priority = priorityFromUrgency(urgency);

    const contract = (o as any).contracts;
    const context = {
      tipo: "Obrigação próxima",
      obrigacao: o.title,
      contrato: contract?.contract_number || o.contract_id?.slice(0, 8) || "—",
      imovel: contract?.properties?.title || "—",
      data_vencimento: o.due_date,
      dias_restantes: daysLeft,
    };

    const aiMessage = await generateAIMessage("obrigacao_proxima", context, openrouterKey);
    const fallbackMessage = `A obrigação "${o.title}" do contrato "${context.contrato}" vence em ${daysLeft} dia${daysLeft > 1 ? "s" : ""} (${o.due_date}).`;

    const users = await getTenantUsers(supabase, o.tenant_id);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: o.tenant_id,
        title: `📋 Obrigação vence em ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`,
        message: aiMessage || fallbackMessage,
        category: "contrato",
        priority,
        urgency_score: urgency,
        group_key: `obligation-upcoming-${o.contract_id}`,
        reference_type: "contract",
        reference_id: o.contract_id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 8 (NEW): Pagamentos atrasados (parcelas overdue)
// ═════════════════════════════════════════════════════════════
async function triggerOverduePayments(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const today = new Date().toISOString().split("T")[0];

  const { data: installments } = await supabase
    .from("contract_installments")
    .select(`
      id, contract_id, due_date, amount, installment_number, tenant_id,
      contracts ( contract_number, properties ( title ), contract_parties ( role, people ( name ) ) )
    `)
    .eq("status", "pending")
    .lt("due_date", today)
    .limit(100);

  if (!installments?.length) return 0;

  for (const inst of installments) {
    if (await wasNotifiedRecently(supabase, inst.id, "cobranca", 3)) continue;

    const daysOverdue = Math.ceil(
      (Date.now() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24),
    );

    const urgency = daysOverdue > 30 ? 95 : daysOverdue > 15 ? 80 : daysOverdue > 7 ? 65 : 50;
    const priority = priorityFromUrgency(urgency);

    const contract = (inst as any).contracts;
    const locatario = contract?.contract_parties?.find((p: any) => p.role === "locatario")?.people?.name || "—";

    const context = {
      tipo: "Pagamento atrasado",
      contrato: contract?.contract_number || inst.contract_id?.slice(0, 8) || "—",
      imovel: contract?.properties?.title || "—",
      locatario,
      parcela: inst.installment_number,
      valor: inst.amount,
      data_vencimento: inst.due_date,
      dias_atraso: daysOverdue,
    };

    const aiMessage = await generateAIMessage("pagamento_atrasado", context, openrouterKey);
    const fallbackMessage = `Parcela #${inst.installment_number} de R$ ${inst.amount?.toLocaleString("pt-BR")} do contrato "${context.contrato}" está atrasada há ${daysOverdue} dias. Locatário: ${locatario}.`;

    // Role-based: financeiro + admin + gerente
    const users = await getTenantUsers(supabase, inst.tenant_id, ["admin", "gerente", "financeiro", "superadmin"]);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: inst.tenant_id,
        title: `💰 Parcela atrasada há ${daysOverdue} dias`,
        message: aiMessage || fallbackMessage,
        category: "cobranca",
        priority,
        urgency_score: urgency,
        group_key: `payment-overdue-${inst.contract_id}`,
        reference_type: "installment",
        reference_id: inst.id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 9 (NEW): Renovações próximas (contratos que podem ser renovados)
// ═════════════════════════════════════════════════════════════
async function triggerUpcomingRenewals(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  // Contratos ativos vencendo em 60-90 dias (janela de renovação)
  const in60days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const in90days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, end_date, monthly_value, contract_type, tenant_id,
      properties ( title, neighborhood, city )
    `)
    .eq("status", "ativo")
    .not("end_date", "is", null)
    .gte("end_date", in60days)
    .lte("end_date", in90days);

  if (!contracts?.length) return 0;

  for (const c of contracts) {
    if (await wasNotifiedRecently(supabase, c.id, "contrato", 14)) continue;

    const daysLeft = Math.ceil(
      (new Date(c.end_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    const property = (c as any).properties;
    const context = {
      tipo: "Janela de renovação",
      contrato: c.contract_number || c.id.slice(0, 8),
      imovel: property?.title || "—",
      bairro: property?.neighborhood,
      cidade: property?.city,
      tipo_contrato: c.contract_type,
      valor_mensal: c.monthly_value,
      dias_restantes: daysLeft,
      data_vencimento: c.end_date,
    };

    const aiMessage = await generateAIMessage("renovacao_proxima", context, openrouterKey);
    const fallbackMessage = `O contrato "${context.contrato}" (${context.imovel}) vence em ${daysLeft} dias. É um bom momento para iniciar a negociação de renovação.`;

    const users = await getTenantUsers(supabase, c.tenant_id, ["admin", "gerente", "superadmin"]);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: c.tenant_id,
        title: `🔄 Janela de renovação — ${daysLeft} dias`,
        message: aiMessage || fallbackMessage,
        category: "contrato",
        priority: "normal",
        urgency_score: 45,
        group_key: `renewal-${c.id}`,
        reference_type: "renewal",
        reference_id: c.id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// TRIGGER 10 (NEW): Deal status changes (deals parados 5+ dias)
// ═════════════════════════════════════════════════════════════
async function triggerStaleDealRequests(
  supabase: ReturnType<typeof createClient>,
  openrouterKey: string | undefined,
): Promise<number> {
  let count = 0;

  const staleSince = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: deals } = await supabase
    .from("deal_requests")
    .select("id, title, status, updated_at, tenant_id, proposed_value")
    .not("status", "in", '("concluido","cancelado","distratado")')
    .lt("updated_at", staleSince)
    .limit(50);

  if (!deals?.length) return 0;

  for (const d of deals) {
    if (await wasNotifiedRecently(supabase, d.id, "alerta", 5)) continue;

    const daysSinceUpdate = Math.ceil(
      (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24),
    );

    const urgency = daysSinceUpdate > 14 ? 70 : daysSinceUpdate > 7 ? 55 : 40;
    const priority = priorityFromUrgency(urgency);

    const context = {
      tipo: "Deal parado",
      deal: d.title || d.id.slice(0, 8),
      status_atual: d.status,
      dias_parado: daysSinceUpdate,
      valor_proposto: d.proposed_value,
    };

    const aiMessage = await generateAIMessage("deal_parado", context, openrouterKey);
    const fallbackMessage = `O deal "${context.deal}" está parado há ${daysSinceUpdate} dias no status "${d.status}". Retome a negociação para não perder a oportunidade.`;

    const users = await getTenantUsers(supabase, d.tenant_id, ["admin", "gerente", "corretor", "superadmin"]);
    for (const userId of users) {
      await createNotification(supabase, {
        user_id: userId,
        tenant_id: d.tenant_id,
        title: `📊 Deal parado há ${daysSinceUpdate} dias`,
        message: aiMessage || fallbackMessage,
        category: "alerta",
        priority,
        urgency_score: urgency,
        group_key: `deal-stale-${d.id}`,
        reference_type: "contract",
        reference_id: d.id,
      });
      count++;
    }
  }

  return count;
}

// ═════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log("[clm-auto-notifications-v2] Starting smart notification triggers...");
  const start = Date.now();

  try {
    // Run all 10 triggers in parallel
    const [
      expiringCount,
      staleCount,
      adjustmentCount,
      approvalCount,
      complianceCount,
      overdueObligationsCount,
      upcomingObligationsCount,
      overduePaymentsCount,
      renewalCount,
      dealStaleCount,
    ] = await Promise.all([
      triggerExpiringContracts(supabase, openrouterKey),
      triggerStaleContracts(supabase, openrouterKey),
      triggerPendingAdjustments(supabase, openrouterKey),
      triggerPendingApprovals(supabase, openrouterKey),
      triggerComplianceViolations(supabase, openrouterKey),
      triggerOverdueObligations(supabase, openrouterKey),
      triggerUpcomingObligations(supabase, openrouterKey),
      triggerOverduePayments(supabase, openrouterKey),
      triggerUpcomingRenewals(supabase, openrouterKey),
      triggerStaleDealRequests(supabase, openrouterKey),
    ]);

    const totalCount =
      expiringCount + staleCount + adjustmentCount + approvalCount +
      complianceCount + overdueObligationsCount + upcomingObligationsCount +
      overduePaymentsCount + renewalCount + dealStaleCount;

    const duration = Date.now() - start;

    console.log(
      `[clm-auto-notifications-v2] Done in ${duration}ms — ` +
        `${totalCount} notifications created ` +
        `(vencimentos: ${expiringCount}, parados: ${staleCount}, ` +
        `reajustes: ${adjustmentCount}, aprovações: ${approvalCount}, ` +
        `compliance: ${complianceCount}, obrig.vencidas: ${overdueObligationsCount}, ` +
        `obrig.próximas: ${upcomingObligationsCount}, pgtos.atrasados: ${overduePaymentsCount}, ` +
        `renovações: ${renewalCount}, deals: ${dealStaleCount})`,
    );

    return jsonResponse({
      success: true,
      version: "v2",
      notifications_created: totalCount,
      breakdown: {
        expiring_contracts: expiringCount,
        stale_contracts: staleCount,
        pending_adjustments: adjustmentCount,
        pending_approvals: approvalCount,
        compliance_violations: complianceCount,
        overdue_obligations: overdueObligationsCount,
        upcoming_obligations: upcomingObligationsCount,
        overdue_payments: overduePaymentsCount,
        upcoming_renewals: renewalCount,
        stale_deals: dealStaleCount,
      },
      duration_ms: duration,
      ai_enabled: !!openrouterKey,
    }, 200, origin);
  } catch (error) {
    console.error("[clm-auto-notifications-v2] Error:", error);
    return jsonResponse({ error: "Internal error" }, 500, origin);
  }
});
