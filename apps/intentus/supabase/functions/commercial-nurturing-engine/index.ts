/**
 * commercial-nurturing-engine — Edge Function para Campanhas de Nurturing Multi-Canal.
 * Actions: create_campaign, get_campaigns, get_campaign_detail, update_campaign,
 *          add_contacts, update_contact_step, generate_content, get_dashboard,
 *          pause_campaign, resume_campaign
 * v1: Multi-channel nurturing (WhatsApp, Email, SMS, Telefone), AI content via Gemini.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── CORS ────────────────────────────────────────────────────────────────────

const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (DEV_REGEX.test(origin)) return true;
  if (PREVIEW_REGEX.test(origin)) return true;
  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (extra) for (const o of extra.split(",")) if (o.trim() === origin) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  tenantId: string;
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

  return { supabase, userId: user.id, tenantId: profile.tenant_id };
}

// ─── Gemini Helper ───────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta do modelo.";
}

// ─── Pulse Helper ────────────────────────────────────────────────────────────

async function emitPulse(
  sb: ReturnType<typeof createClient>, tenantId: string, userId: string,
  eventType: string, title: string, description: string, metadata: Record<string, unknown> = {},
) {
  try {
    await sb.from("pulse_events").insert({
      tenant_id: tenantId, user_id: userId, event_type: eventType,
      title, description, priority: "medium", metadata,
    });
  } catch (_) { /* non-blocking */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface NurturingStep {
  step_order: number;
  channel: "whatsapp" | "email" | "sms" | "telefone";
  delay_hours: number;
  subject?: string;
  message_template: string;
  is_active: boolean;
}

interface CampaignContact {
  lead_id: string;
  lead_name: string;
  current_step: number;
  status: "active" | "completed" | "opted_out" | "converted";
  last_interaction?: string;
  enrolled_at: string;
}

interface NurturingCampaign {
  name: string;
  description?: string;
  goal: string;
  target_segment: string;
  channels: string[];
  steps: NurturingStep[];
  contacts: CampaignContact[];
  metrics: {
    total_contacts: number;
    active_contacts: number;
    completed: number;
    opted_out: number;
    converted: number;
    open_rate: number;
    response_rate: number;
  };
  status: "draft" | "active" | "paused" | "completed";
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { supabase, userId, tenantId } = await resolveAuth(req);
    const { action, ...params } = await req.json();
    let result: unknown = null;

    switch (action) {
      // ── Create Nurturing Campaign ───────────────────────────────
      case "create_campaign": {
        const { name, description, goal, target_segment, channels, steps } = params;
        if (!name) throw new Error("Nome da campanha é obrigatório");
        if (!steps || steps.length === 0) throw new Error("Pelo menos 1 step é obrigatório");

        const campaignData: NurturingCampaign = {
          name,
          description: description || "",
          goal: goal || "engajamento",
          target_segment: target_segment || "todos",
          channels: channels || ["whatsapp"],
          steps: (steps as NurturingStep[]).map((s, i) => ({
            step_order: i + 1,
            channel: s.channel || "whatsapp",
            delay_hours: s.delay_hours || 24,
            subject: s.subject || "",
            message_template: s.message_template || "",
            is_active: s.is_active !== false,
          })),
          contacts: [],
          metrics: {
            total_contacts: 0, active_contacts: 0, completed: 0,
            opted_out: 0, converted: 0, open_rate: 0, response_rate: 0,
          },
          status: "draft",
        };

        const { data: campaign, error } = await supabase.from("commercial_automation_logs").insert({
          tenant_id: tenantId,
          automation_name: "nurturing_campaign",
          trigger_event: "manual_create",
          action_type: "create_nurturing",
          action_details: campaignData,
          status: "draft",
          entity_type: "nurturing",
          entity_id: crypto.randomUUID(),
        }).select("id, action_details, status, created_at").maybeSingle();
        if (error) throw error;

        await emitPulse(supabase, tenantId, userId, "nurturing_created",
          "Campanha de nurturing criada",
          `Nova campanha: ${name} (${(channels || ["whatsapp"]).join(", ")})`,
          { campaign_id: campaign?.id },
        );

        result = { success: true, campaign };
        break;
      }

      // ── Get Campaigns List ──────────────────────────────────────
      case "get_campaigns": {
        const { status: filterStatus } = params;
        let query = supabase.from("commercial_automation_logs")
          .select("id, action_details, status, created_at, updated_at")
          .eq("tenant_id", tenantId)
          .eq("automation_name", "nurturing_campaign")
          .order("created_at", { ascending: false })
          .limit(50);

        if (filterStatus) query = query.eq("status", filterStatus);

        const { data: campaigns, error } = await query;
        if (error) throw error;

        result = { campaigns: campaigns || [] };
        break;
      }

      // ── Get Campaign Detail ─────────────────────────────────────
      case "get_campaign_detail": {
        const { campaign_id } = params;
        if (!campaign_id) throw new Error("campaign_id obrigatório");

        const { data: campaign, error } = await supabase.from("commercial_automation_logs")
          .select("id, action_details, status, created_at, updated_at")
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (error) throw error;
        if (!campaign) throw new Error("Campanha não encontrada");

        result = campaign;
        break;
      }

      // ── Update Campaign ─────────────────────────────────────────
      case "update_campaign": {
        const { campaign_id, updates } = params;
        if (!campaign_id) throw new Error("campaign_id obrigatório");

        const { data: existing, error: fetchErr } = await supabase.from("commercial_automation_logs")
          .select("id, action_details, status")
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!existing) throw new Error("Campanha não encontrada");

        const details = existing.action_details as Record<string, unknown>;
        if (updates.name) details.name = updates.name;
        if (updates.description !== undefined) details.description = updates.description;
        if (updates.goal) details.goal = updates.goal;
        if (updates.target_segment) details.target_segment = updates.target_segment;
        if (updates.channels) details.channels = updates.channels;
        if (updates.steps) {
          details.steps = (updates.steps as NurturingStep[]).map((s, i) => ({
            step_order: i + 1,
            channel: s.channel || "whatsapp",
            delay_hours: s.delay_hours || 24,
            subject: s.subject || "",
            message_template: s.message_template || "",
            is_active: s.is_active !== false,
          }));
        }

        await supabase.from("commercial_automation_logs")
          .update({ action_details: details })
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId);

        result = { success: true };
        break;
      }

      // ── Add Contacts to Campaign ────────────────────────────────
      case "add_contacts": {
        const { campaign_id, lead_ids, segment_filter } = params;
        if (!campaign_id) throw new Error("campaign_id obrigatório");

        const { data: existing, error: fetchErr } = await supabase.from("commercial_automation_logs")
          .select("id, action_details")
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!existing) throw new Error("Campanha não encontrada");

        const details = existing.action_details as Record<string, unknown>;
        const currentContacts = (details.contacts || []) as CampaignContact[];
        const existingLeadIds = new Set(currentContacts.map(c => c.lead_id));

        let leadsToAdd: Array<{ id: string; name: string }> = [];

        if (lead_ids && lead_ids.length > 0) {
          // Manual selection
          const { data: leads } = await supabase
            .from("leads")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .in("id", lead_ids);
          leadsToAdd = leads || [];
        } else if (segment_filter) {
          // Segment-based: filter by status, source, region
          let query = supabase
            .from("leads")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .eq("is_deleted", false)
            .limit(200);

          if (segment_filter.status) query = query.eq("status", segment_filter.status);
          if (segment_filter.source) query = query.eq("source", segment_filter.source);
          if (segment_filter.region) query = query.eq("preferred_region", segment_filter.region);
          if (segment_filter.min_score) query = query.gte("lead_score", segment_filter.min_score);

          const { data: leads } = await query;
          leadsToAdd = leads || [];
        }

        let added = 0;
        const now = new Date().toISOString();
        for (const lead of leadsToAdd) {
          if (!existingLeadIds.has(lead.id)) {
            currentContacts.push({
              lead_id: lead.id,
              lead_name: lead.name || "Sem nome",
              current_step: 0,
              status: "active",
              enrolled_at: now,
            });
            added++;
          }
        }

        details.contacts = currentContacts;
        const metrics = details.metrics as Record<string, number>;
        metrics.total_contacts = currentContacts.length;
        metrics.active_contacts = currentContacts.filter((c: CampaignContact) => c.status === "active").length;

        await supabase.from("commercial_automation_logs")
          .update({ action_details: details })
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId);

        result = { success: true, added, total: currentContacts.length };
        break;
      }

      // ── Update Contact Step ─────────────────────────────────────
      case "update_contact_step": {
        const { campaign_id, lead_id, new_step, new_status, interaction } = params;
        if (!campaign_id || !lead_id) throw new Error("campaign_id e lead_id obrigatórios");

        const { data: existing, error: fetchErr } = await supabase.from("commercial_automation_logs")
          .select("id, action_details")
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!existing) throw new Error("Campanha não encontrada");

        const details = existing.action_details as Record<string, unknown>;
        const contacts = (details.contacts || []) as CampaignContact[];
        const contact = contacts.find(c => c.lead_id === lead_id);
        if (!contact) throw new Error("Contato não encontrado na campanha");

        if (new_step !== undefined) contact.current_step = new_step;
        if (new_status) contact.status = new_status;
        if (interaction) contact.last_interaction = new Date().toISOString();

        // Recalculate metrics
        const steps = (details.steps || []) as NurturingStep[];
        const totalSteps = steps.length;
        const metrics = details.metrics as Record<string, number>;
        metrics.active_contacts = contacts.filter(c => c.status === "active").length;
        metrics.completed = contacts.filter(c => c.status === "completed" || c.current_step >= totalSteps).length;
        metrics.opted_out = contacts.filter(c => c.status === "opted_out").length;
        metrics.converted = contacts.filter(c => c.status === "converted").length;

        const withInteraction = contacts.filter(c => c.last_interaction).length;
        metrics.response_rate = contacts.length > 0 ? Math.round((withInteraction / contacts.length) * 100) : 0;
        // Approx open_rate = contacts who advanced at least 1 step
        const advanced = contacts.filter(c => c.current_step > 0).length;
        metrics.open_rate = contacts.length > 0 ? Math.round((advanced / contacts.length) * 100) : 0;

        details.contacts = contacts;
        details.metrics = metrics;

        await supabase.from("commercial_automation_logs")
          .update({ action_details: details })
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId);

        result = { success: true, contact };
        break;
      }

      // ── Pause / Resume Campaign ─────────────────────────────────
      case "pause_campaign":
      case "resume_campaign": {
        const { campaign_id: cid } = params;
        if (!cid) throw new Error("campaign_id obrigatório");

        const newStatus = action === "pause_campaign" ? "paused" : "active";

        const { data: existing } = await supabase.from("commercial_automation_logs")
          .select("id, action_details")
          .eq("id", cid)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (!existing) throw new Error("Campanha não encontrada");

        const det = existing.action_details as Record<string, unknown>;
        det.status = newStatus;

        await supabase.from("commercial_automation_logs")
          .update({ action_details: det, status: newStatus })
          .eq("id", cid)
          .eq("tenant_id", tenantId);

        await emitPulse(supabase, tenantId, userId,
          action === "pause_campaign" ? "nurturing_paused" : "nurturing_resumed",
          `Campanha ${newStatus === "paused" ? "pausada" : "retomada"}`,
          `Campanha "${(det.name as string) || "—"}" foi ${newStatus === "paused" ? "pausada" : "retomada"}.`,
          { campaign_id: cid },
        );

        result = { success: true, status: newStatus };
        break;
      }

      // ── Generate Content (IA) ───────────────────────────────────
      case "generate_content": {
        const { channel, goal, context, tone, step_number } = params;

        const prompt = `
Você é um especialista em marketing imobiliário brasileiro e copywriting para nurturing de leads.
Gere conteúdo para o passo ${step_number || 1} de uma campanha de nurturing.

Canal: ${channel || "whatsapp"}
Objetivo da campanha: ${goal || "manter o lead engajado e avançar no funil"}
${context ? `Contexto adicional: ${context}` : "Empreendimento imobiliário de médio/alto padrão."}
Tom: ${tone || "consultivo e pessoal"}

Retorne APENAS um JSON válido (sem markdown) com esta estrutura:
{
  "subject": "Assunto do email (apenas se canal for email, senão string vazia)",
  "message": "Texto completo da mensagem com {nome} como placeholder. Deve ser natural e não parecer spam.",
  "cta": "Texto do call-to-action principal",
  "timing_tip": "Melhor horário/dia para enviar",
  "personalization_tips": ["dica 1 para personalizar", "dica 2"],
  "ab_variant": "Variação alternativa da mensagem principal (para teste A/B)"
}
        `.trim();

        let aiResponse = "";
        try {
          aiResponse = await callGemini(prompt);
        } catch {
          aiResponse = JSON.stringify({
            subject: channel === "email" ? `{nome}, temos uma novidade para você` : "",
            message: `Olá {nome}! Espero que esteja bem. Lembrei de você e queria compartilhar algumas novidades sobre nossos empreendimentos. Tem um momento para conversarmos?`,
            cta: "Quero saber mais",
            timing_tip: "Terça a Quinta, 10h-12h",
            personalization_tips: ["Use o nome do lead", "Mencione o interesse anterior"],
            ab_variant: `{nome}, vi que você se interessou por nossos imóveis. Posso enviar algumas opções que combinam com o que você procura?`,
          });
        }

        let parsed;
        try { parsed = JSON.parse(aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
        catch { parsed = { subject: "", message: aiResponse, cta: "", timing_tip: "", personalization_tips: [], ab_variant: "" }; }

        result = parsed;
        break;
      }

      // ── Get Dashboard ───────────────────────────────────────────
      case "get_dashboard": {
        const { data: campaigns } = await supabase.from("commercial_automation_logs")
          .select("id, action_details, status, created_at")
          .eq("tenant_id", tenantId)
          .eq("automation_name", "nurturing_campaign")
          .order("created_at", { ascending: false })
          .limit(100);

        const all = campaigns || [];
        let totalContacts = 0, totalActive = 0, totalCompleted = 0;
        let totalOptedOut = 0, totalConverted = 0;
        let sumResponseRate = 0, countWithContacts = 0;

        const byStatus: Record<string, number> = { draft: 0, active: 0, paused: 0, completed: 0 };
        const byChannel: Record<string, number> = {};

        for (const c of all) {
          const d = c.action_details as Record<string, unknown>;
          const metrics = (d.metrics || {}) as Record<string, number>;
          const channels = (d.channels || []) as string[];
          const status = (d.status as string) || c.status || "draft";

          byStatus[status] = (byStatus[status] || 0) + 1;
          for (const ch of channels) { byChannel[ch] = (byChannel[ch] || 0) + 1; }

          totalContacts += metrics.total_contacts || 0;
          totalActive += metrics.active_contacts || 0;
          totalCompleted += metrics.completed || 0;
          totalOptedOut += metrics.opted_out || 0;
          totalConverted += metrics.converted || 0;

          if (metrics.total_contacts > 0) {
            sumResponseRate += metrics.response_rate || 0;
            countWithContacts++;
          }
        }

        const avgResponseRate = countWithContacts > 0 ? Math.round(sumResponseRate / countWithContacts) : 0;
        const conversionRate = totalContacts > 0 ? Math.round((totalConverted / totalContacts) * 100) : 0;

        result = {
          total_campaigns: all.length,
          by_status: byStatus,
          by_channel: Object.entries(byChannel).map(([ch, count]) => ({ channel: ch, count })).sort((a, b) => b.count - a.count),
          contacts: {
            total: totalContacts,
            active: totalActive,
            completed: totalCompleted,
            opted_out: totalOptedOut,
            converted: totalConverted,
          },
          avg_response_rate: avgResponseRate,
          conversion_rate: conversionRate,
        };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[commercial-nurturing-engine]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
