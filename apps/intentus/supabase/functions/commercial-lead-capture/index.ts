/**
 * commercial-lead-capture v1
 * Webhook público multi-canal para captação de leads com IA.
 *
 * 5 actions:
 *   - capture:        Recebe lead de qualquer canal (público, sem auth)
 *   - get_dashboard:  Dashboard de captação por canal (auth required)
 *   - get_configs:    Configurações de canais (auth required)
 *   - save_config:    Salva configuração de canal (auth required)
 *   - get_log:        Log de capturas recentes (auth required)
 *
 * Channels: site, landing_page, whatsapp, email_form, portal, indicacao,
 *           telefone, api, webhook, chat_widget
 *
 * Features: deduplicação por email/phone, IA classificação (Gemini), auto-scoring,
 *           auto-assign, spam detection, capture logging.
 *
 * Self-contained: inline CORS (public for capture, whitelist for admin).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ────────────────────────────────────────────────────────────────────
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function getCorsHeaders(req: Request, isPublic = false) {
  if (isPublic) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, x-api-key, x-channel",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  const origin = req.headers.get("origin") ?? "";
  let allowOrigin = "";
  if (PROD_ORIGINS.includes(origin)) allowOrigin = origin;
  else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) allowOrigin = origin;
  else if (/^https:\/\/intentus-plataform-.+\.vercel\.app$/.test(origin)) allowOrigin = origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin || PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function resolveAuth(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");
  return { user, tenantId: profile.tenant_id, admin };
}

function sanitize(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}

function isValidPhone(p: string): boolean {
  return /^[\d\s\-\(\)\+]+$/.test(p) && p.length <= 20;
}

// ─── Spam detection (rule-based) ─────────────────────────────────────────────
function isLikelySpam(name: string, email: string, message: string): boolean {
  const spamPatterns = [
    /\b(viagra|casino|lottery|winner|prize|click here|buy now)\b/i,
    /\b(http|https):\/\/[^\s]+\.(ru|cn|tk)\b/i,
    /<script|<iframe|javascript:/i,
  ];
  const text = `${name} ${email} ${message}`;
  return spamPatterns.some((p) => p.test(text));
}

// ─── Dedup check ─────────────────────────────────────────────────────────────
async function findDuplicate(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  email: string | null,
  phone: string | null,
): Promise<string | null> {
  if (email) {
    const { data } = await admin
      .from("leads")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .limit(1);
    if (data && data.length > 0) return data[0].id;
  }
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length >= 10) {
      const { data } = await admin
        .from("leads")
        .select("id, phone")
        .eq("tenant_id", tenantId)
        .limit(100);
      const match = data?.find(
        (l: any) => l.phone && l.phone.replace(/\D/g, "") === cleanPhone,
      );
      if (match) return match.id;
    }
  }
  return null;
}

// ─── AI classification ───────────────────────────────────────────────────────
async function classifyLeadWithAI(
  name: string, email: string, phone: string, message: string, channel: string,
): Promise<{ interest_type: string | null; preferred_region: string | null; quality: string }> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return { interest_type: null, preferred_region: null, quality: "unknown" };

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 256,
        messages: [
          {
            role: "system",
            content: `Classifique este lead imobiliário. Retorne JSON: {"interest_type":"compra|aluguel|investimento|comercial|outro|null","preferred_region":"região mencionada ou null","quality":"hot|warm|cold"}. Analise nome, mensagem e canal de origem.`,
          },
          {
            role: "user",
            content: `Nome: ${name}\nEmail: ${email}\nTelefone: ${phone}\nMensagem: ${message}\nCanal: ${channel}`,
          },
        ],
      }),
    });
    if (!resp.ok) return { interest_type: null, preferred_region: null, quality: "unknown" };
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { interest_type: null, preferred_region: null, quality: "unknown" };
    return JSON.parse(content);
  } catch {
    return { interest_type: null, preferred_region: null, quality: "unknown" };
  }
}

// ─── ACTION: capture (PUBLIC — no auth required) ─────────────────────────────
async function handleCapture(req: Request, body: Record<string, unknown>) {
  const admin = getAdmin();

  // Resolve tenant via slug or domain
  const slug = sanitize(body.tenant_slug, 100) || sanitize(body.slug, 100);
  const domain = sanitize(body.domain, 200);
  if (!slug && !domain) {
    return { error: "tenant_slug ou domain é obrigatório", status: 400 };
  }

  let tenantQuery = admin.from("tenants").select("id").eq("active", true);
  if (domain) tenantQuery = tenantQuery.eq("custom_domain", domain);
  else tenantQuery = tenantQuery.eq("slug", slug);

  const { data: tenant } = await tenantQuery.single();
  if (!tenant) return { error: "Empresa não encontrada", status: 404 };
  const tenantId = tenant.id;

  // Parse input
  const name = sanitize(body.name, 200);
  if (!name) return { error: "Campo 'name' é obrigatório", status: 400 };

  const email = sanitize(body.email, 255);
  if (email && !isValidEmail(email)) return { error: "Email inválido", status: 400 };

  const phone = sanitize(body.phone, 20);
  if (phone && !isValidPhone(phone)) return { error: "Telefone inválido", status: 400 };

  if (!email && !phone) return { error: "Email ou telefone é obrigatório", status: 400 };

  const message = sanitize(body.message, 2000);
  const channel = sanitize(body.channel, 30) || "site";
  const propertyId = sanitize(body.property_id, 36) || null;
  const interestType = sanitize(body.interest_type, 50) || null;
  const budgetMin = typeof body.budget_min === "number" ? body.budget_min : null;
  const budgetMax = typeof body.budget_max === "number" ? body.budget_max : null;
  const preferredRegion = sanitize(body.preferred_region, 200) || null;
  const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  // Spam check
  if (isLikelySpam(name, email, message)) {
    await admin.from("lead_capture_log" as any).insert({
      tenant_id: tenantId,
      channel,
      raw_payload: body,
      source_ip: sourceIp,
      processing_status: "spam",
    });
    // Return success to not reveal spam detection
    return { data: { success: true, message: "Interesse registrado" } };
  }

  // Dedup check
  const duplicateId = await findDuplicate(admin, tenantId, email || null, phone || null);
  if (duplicateId) {
    // Update existing lead with new info (merge)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (message) updates.notes = message;
    if (!email) { /* keep existing */ } else updates.email = email;
    if (!phone) { /* keep existing */ } else updates.phone = phone;
    if (interestType) updates.interest_type = interestType;
    if (preferredRegion) updates.preferred_region = preferredRegion;
    updates.last_contact_at = new Date().toISOString();

    await admin.from("leads").update(updates).eq("id", duplicateId).eq("tenant_id", tenantId);

    await admin.from("lead_capture_log" as any).insert({
      tenant_id: tenantId,
      channel,
      lead_id: duplicateId,
      raw_payload: body,
      source_ip: sourceIp,
      is_duplicate: true,
      duplicate_of: duplicateId,
      processing_status: "duplicate",
    });

    return { data: { success: true, message: "Interesse atualizado", lead_id: duplicateId, is_duplicate: true } };
  }

  // AI classification (fire-and-forget friendly)
  let aiClassification = { interest_type: interestType, preferred_region: preferredRegion, quality: "unknown" as string };
  try {
    aiClassification = await classifyLeadWithAI(name, email, phone, message, channel);
  } catch { /* ignore AI errors */ }

  // Create lead
  const { data: newLead, error: insertErr } = await admin
    .from("leads")
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      notes: message || null,
      property_id: propertyId,
      interest_type: aiClassification.interest_type || interestType || null,
      preferred_region: aiClassification.preferred_region || preferredRegion || null,
      source: channel === "landing_page" ? "site" : channel === "chat_widget" ? "site" : channel === "email_form" ? "site" : channel as any,
      status: "novo",
      capture_channel: channel,
      budget_min: budgetMin,
      budget_max: budgetMax,
      tenant_id: tenantId,
      created_by: null as any,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("Lead insert error:", insertErr);
    await admin.from("lead_capture_log" as any).insert({
      tenant_id: tenantId, channel, raw_payload: body, source_ip: sourceIp,
      processing_status: "error", error_message: insertErr.message,
    });
    return { error: "Erro ao registrar interesse", status: 500 };
  }

  // Log success
  await admin.from("lead_capture_log" as any).insert({
    tenant_id: tenantId, channel, lead_id: newLead.id, raw_payload: body,
    source_ip: sourceIp, processing_status: "success",
  });

  return {
    data: {
      success: true,
      message: "Interesse registrado com sucesso",
      lead_id: newLead.id,
      ai_classification: aiClassification,
    },
  };
}

// ─── ACTION: get_dashboard (AUTH) ────────────────────────────────────────────
async function handleGetDashboard(admin: ReturnType<typeof createClient>, tenantId: string) {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  // Capture logs last 30 days
  const { data: logs } = await admin
    .from("lead_capture_log" as any)
    .select("channel, processing_status, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", d30)
    .order("created_at", { ascending: false })
    .limit(1000);

  const allLogs = (logs || []) as { channel: string; processing_status: string; created_at: string }[];

  // Channel breakdown
  const channelStats: Record<string, { total: number; success: number; duplicate: number; spam: number; error: number; last_7d: number }> = {};

  for (const log of allLogs) {
    if (!channelStats[log.channel]) {
      channelStats[log.channel] = { total: 0, success: 0, duplicate: 0, spam: 0, error: 0, last_7d: 0 };
    }
    const s = channelStats[log.channel];
    s.total++;
    if (log.processing_status === "success") s.success++;
    else if (log.processing_status === "duplicate") s.duplicate++;
    else if (log.processing_status === "spam") s.spam++;
    else if (log.processing_status === "error") s.error++;
    if (log.created_at >= d7) s.last_7d++;
  }

  // Summary KPIs
  const total30d = allLogs.length;
  const total7d = allLogs.filter((l) => l.created_at >= d7).length;
  const successCount = allLogs.filter((l) => l.processing_status === "success").length;
  const dupCount = allLogs.filter((l) => l.processing_status === "duplicate").length;
  const spamCount = allLogs.filter((l) => l.processing_status === "spam").length;
  const conversionRate = total30d > 0 ? Math.round((successCount / total30d) * 100) : 0;

  // Top channels by volume
  const topChannels = Object.entries(channelStats)
    .map(([channel, stats]) => ({ channel, ...stats }))
    .sort((a, b) => b.total - a.total);

  // Configs
  const { data: configs } = await admin
    .from("lead_capture_configs" as any)
    .select("channel, is_enabled, auto_assign, auto_score, auto_respond")
    .eq("tenant_id", tenantId);

  return {
    data: {
      kpis: { total_30d: total30d, total_7d: total7d, new_leads: successCount, duplicates: dupCount, spam_blocked: spamCount, conversion_rate: conversionRate },
      channel_stats: topChannels,
      active_channels: ((configs || []) as any[]).filter((c: any) => c.is_enabled).length,
      total_channels: (configs || []).length,
    },
  };
}

// ─── ACTION: get_configs (AUTH) ──────────────────────────────────────────────
async function handleGetConfigs(admin: ReturnType<typeof createClient>, tenantId: string) {
  const { data, error } = await admin
    .from("lead_capture_configs" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("channel", { ascending: true });
  if (error) throw error;
  return { data: data || [] };
}

// ─── ACTION: save_config (AUTH) ──────────────────────────────────────────────
async function handleSaveConfig(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const channel = sanitize(body.channel as string, 30);
  if (!channel) return { error: "channel é obrigatório", status: 400 };

  const { error } = await (admin.from("lead_capture_configs" as any) as any).upsert(
    {
      tenant_id: tenantId,
      channel,
      is_enabled: body.is_enabled ?? true,
      auto_assign: body.auto_assign ?? false,
      auto_score: body.auto_score ?? false,
      auto_respond: body.auto_respond ?? false,
      webhook_secret: body.webhook_secret ?? null,
      config: body.config ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,channel" },
  );
  if (error) throw error;
  return { data: { success: true } };
}

// ─── ACTION: get_log (AUTH) ──────────────────────────────────────────────────
async function handleGetLog(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const channel = sanitize(body.channel as string, 30) || null;
  const limit = Math.min(100, Math.max(1, Number(body.limit) || 50));

  let query = admin
    .from("lead_capture_log" as any)
    .select("id, channel, lead_id, processing_status, error_message, is_duplicate, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (channel) query = query.eq("channel", channel);

  const { data, error } = await query;
  if (error) throw error;
  return { data: data || [] };
}

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = (body.action as string) || "capture";

  // PUBLIC endpoint: capture (no auth needed)
  if (action === "capture") {
    const cors = getCorsHeaders(req, true);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      const result = await handleCapture(req, body);
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(result.data), {
        status: 201,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("capture error:", err);
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
  }

  // ADMIN endpoints: require auth
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { tenantId, admin } = await resolveAuth(req);
    let result: { data?: unknown; error?: string; status?: number };

    switch (action) {
      case "get_dashboard":
        result = await handleGetDashboard(admin, tenantId);
        break;
      case "get_configs":
        result = await handleGetConfigs(admin, tenantId);
        break;
      case "save_config":
        result = await handleSaveConfig(admin, tenantId, body);
        break;
      case "get_log":
        result = await handleGetLog(admin, tenantId, body);
        break;
      default:
        result = { error: `Unknown action: ${action}`, status: 400 };
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status || 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(result.data), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("commercial-lead-capture error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
