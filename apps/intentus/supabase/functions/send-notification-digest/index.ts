// send-notification-digest v2 — Smart Email Digest com ranking por urgência
// Roda via pg_cron diário (07:00 BRT = 10:00 UTC) ou chamada manual
// V2: Priority ordering, urgency ranking, group_key collapsing,
//     snoozed filtering, quiet hours respect, priority badges no HTML
// Envia via Resend API

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS whitelist (self-contained) ──────────────────────
const ALLOWED_ORIGINS_RAW = Deno.env.get("ALLOWED_ORIGINS") || "";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW.split(",").map((s) => s.trim()).filter(Boolean);
const DEV_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

const PROD_ORIGINS_FALLBACK = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) return true;
  if (PROD_ORIGINS_FALLBACK.includes(origin)) return true;
  if (DEV_ORIGIN_REGEX.test(origin)) return true;
  if (PREVIEW_REGEX.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowedOrigin = isOriginAllowed(origin) ? origin! : (ALLOWED_ORIGINS[0] || "https://app.intentusrealestate.com.br");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Tipos ────────────────────────────────────────────────

type Priority = "critical" | "high" | "normal" | "low";

interface NotifRow {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  message: string;
  category: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  priority: Priority | null;
  urgency_score: number | null;
  group_key: string | null;
  snoozed_until: string | null;
}

interface GroupedNotif {
  title: string;
  message: string;
  created_at: string;
  category: string;
  reference_type?: string;
  reference_id?: string;
  priority: Priority;
  urgency_score: number;
  group_key: string | null;
  is_grouped: boolean;
  group_count: number;
}

// ── Constantes ───────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  sistema: "Sistema",
  contrato: "Contratos",
  cobranca: "Cobrança",
  aprovacao: "Aprovações",
  vencimento: "Vencimentos",
  alerta: "Alertas",
  ia: "Inteligência Artificial",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  sistema: "⚙️",
  contrato: "📄",
  cobranca: "💰",
  aprovacao: "✅",
  vencimento: "⏰",
  alerta: "⚠️",
  ia: "🧠",
};

// Ordem de prioridade para sorting (menor = mais urgente)
const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// Cores de prioridade para o email HTML
const PRIORITY_COLORS: Record<Priority, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5", label: "CRÍTICO" },
  high: { bg: "#fff7ed", text: "#ea580c", border: "#fdba74", label: "ALTO" },
  normal: { bg: "#eff6ff", text: "#2563eb", border: "#93c5fd", label: "NORMAL" },
  low: { bg: "#f0fdf4", text: "#16a34a", border: "#86efac", label: "BAIXO" },
};

// Categorias priorizadas (ordenadas por importância)
const CATEGORY_PRIORITY_ORDER: string[] = [
  "alerta",
  "vencimento",
  "aprovacao",
  "cobranca",
  "contrato",
  "ia",
  "sistema",
];

// ── Helpers ──────────────────────────────────────────────

function normalizePriority(p: string | null): Priority {
  if (p === "critical" || p === "high" || p === "normal" || p === "low") return p;
  return "normal";
}

/**
 * Checa se o horário atual está dentro do período de quiet hours.
 * quiet_hours_start/end são strings "HH:MM" no timezone America/Sao_Paulo.
 */
function isInQuietHours(start: string | null, end: string | null, enabled: boolean | null): boolean {
  if (!enabled || !start || !end) return false;

  // Hora atual em BRT (America/Sao_Paulo)
  const nowBrt = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const nowDate = new Date(nowBrt);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  // Quiet hours pode cruzar meia-noite (ex: 22:00 - 07:00)
  if (startMin <= endMin) {
    return nowMinutes >= startMin && nowMinutes < endMin;
  } else {
    return nowMinutes >= startMin || nowMinutes < endMin;
  }
}

/**
 * Agrupa notificações por group_key, mantendo a de maior urgency_score.
 * Notificações sem group_key passam individuais.
 */
function collapseByGroupKey(notifs: NotifRow[]): GroupedNotif[] {
  const groups = new Map<string, NotifRow[]>();
  const ungrouped: NotifRow[] = [];

  for (const n of notifs) {
    if (n.group_key) {
      const existing = groups.get(n.group_key) || [];
      existing.push(n);
      groups.set(n.group_key, existing);
    } else {
      ungrouped.push(n);
    }
  }

  const result: GroupedNotif[] = [];

  // Grupos colapsados — usa o item de maior urgency como representante
  for (const [_key, items] of groups) {
    // Ordenar por urgency_score desc
    items.sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0));
    const representative = items[0];

    result.push({
      title: items.length > 1
        ? `${representative.title} (+${items.length - 1} similar${items.length > 2 ? "es" : ""})`
        : representative.title,
      message: representative.message,
      created_at: representative.created_at,
      category: representative.category || "sistema",
      reference_type: representative.reference_type ?? undefined,
      reference_id: representative.reference_id ?? undefined,
      priority: normalizePriority(representative.priority),
      urgency_score: representative.urgency_score ?? 50,
      group_key: representative.group_key,
      is_grouped: items.length > 1,
      group_count: items.length,
    });
  }

  // Notificações individuais
  for (const n of ungrouped) {
    result.push({
      title: n.title,
      message: n.message,
      created_at: n.created_at,
      category: n.category || "sistema",
      reference_type: n.reference_type ?? undefined,
      reference_id: n.reference_id ?? undefined,
      priority: normalizePriority(n.priority),
      urgency_score: n.urgency_score ?? 50,
      group_key: null,
      is_grouped: false,
      group_count: 1,
    });
  }

  return result;
}

/**
 * Ordena notificações: priority desc (critical first), depois urgency_score desc.
 */
function sortByUrgency(notifs: GroupedNotif[]): GroupedNotif[] {
  return [...notifs].sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.urgency_score - a.urgency_score;
  });
}

// ── Gerar HTML do email v2 ───────────────────────────────

function generateEmailHtmlV2(
  userName: string,
  groupedByCategory: Record<string, GroupedNotif[]>,
  appUrl: string,
  criticalCount: number,
  highCount: number,
): string {
  const totalCount = Object.values(groupedByCategory).reduce(
    (sum, arr) => sum + arr.reduce((s, n) => s + n.group_count, 0), 0,
  );

  // Ordenar categorias por prioridade
  const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
    const aIdx = CATEGORY_PRIORITY_ORDER.indexOf(a);
    const bIdx = CATEGORY_PRIORITY_ORDER.indexOf(b);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  // Banner de urgência se há critical/high
  let urgencyBannerHtml = "";
  if (criticalCount > 0 || highCount > 0) {
    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`<strong style="color: #dc2626;">${criticalCount} crítica${criticalCount > 1 ? "s" : ""}</strong>`);
    if (highCount > 0) parts.push(`<strong style="color: #ea580c;">${highCount} alta${highCount > 1 ? "s" : ""}</strong>`);
    urgencyBannerHtml = `
      <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <div style="font-size: 14px; color: #991b1b;">
          ⚡ Atenção: Você tem ${parts.join(" e ")} prioridade${criticalCount + highCount > 1 ? "s" : ""} que requer${criticalCount + highCount === 1 ? "" : "em"} ação imediata.
        </div>
      </div>`;
  }

  let sectionsHtml = "";
  for (const category of sortedCategories) {
    const notifications = groupedByCategory[category];
    if (!notifications.length) continue;

    const emoji = CATEGORY_EMOJIS[category] || "📌";
    const label = CATEGORY_LABELS[category] || category;
    const catNotifCount = notifications.reduce((s, n) => s + n.group_count, 0);

    // Notificações já vêm ordenadas por urgência
    let itemsHtml = "";
    for (const n of notifications) {
      const time = new Date(n.created_at).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Priority badge
      const pColor = PRIORITY_COLORS[n.priority];
      const priorityBadgeHtml = n.priority !== "normal"
        ? ` <span style="display: inline-block; background: ${pColor.bg}; color: ${pColor.text}; border: 1px solid ${pColor.border}; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle;">${pColor.label}</span>`
        : "";

      // Group badge
      const groupBadgeHtml = n.is_grouped
        ? ` <span style="display: inline-block; background: #f3f4f6; color: #6b7280; font-size: 10px; padding: 1px 6px; border-radius: 4px; margin-left: 4px; vertical-align: middle;">+${n.group_count - 1}</span>`
        : "";

      // Link direto
      let linkHtml = "";
      if (n.reference_type === "contract" && n.reference_id) {
        linkHtml = ` <a href="${appUrl}/contratos/${n.reference_id}" style="color: #e2a93b; text-decoration: none; font-size: 13px;">Ver contrato →</a>`;
      } else if (n.reference_type === "compliance" && n.reference_id) {
        linkHtml = ` <a href="${appUrl}/contratos/compliance" style="color: #e2a93b; text-decoration: none; font-size: 13px;">Ver compliance →</a>`;
      } else if (n.reference_type === "obligation" && n.reference_id) {
        linkHtml = ` <a href="${appUrl}/contratos/${n.reference_id}" style="color: #e2a93b; text-decoration: none; font-size: 13px;">Ver obrigações →</a>`;
      }

      // Left border color por prioridade
      const leftBorderColor = n.priority === "critical" ? "#dc2626"
        : n.priority === "high" ? "#ea580c"
        : "transparent";
      const leftBorderStyle = n.priority === "critical" || n.priority === "high"
        ? `border-left: 3px solid ${leftBorderColor};`
        : "";

      itemsHtml += `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; ${leftBorderStyle}">
            <div style="font-weight: 600; color: #1a1a2e; font-size: 14px; margin-bottom: 4px;">
              ${n.title}${priorityBadgeHtml}${groupBadgeHtml}
            </div>
            <div style="color: #666; font-size: 13px; line-height: 1.4;">${n.message}</div>
            <div style="margin-top: 6px; font-size: 12px; color: #999;">${time}${linkHtml}</div>
          </td>
        </tr>`;
    }

    // Contar prioridades nesta categoria
    const catCritical = notifications.filter((n) => n.priority === "critical").length;
    const catHigh = notifications.filter((n) => n.priority === "high").length;
    let catPriorityHint = "";
    if (catCritical > 0) catPriorityHint = ` · <span style="color: #dc2626;">${catCritical} crítica${catCritical > 1 ? "s" : ""}</span>`;
    else if (catHigh > 0) catPriorityHint = ` · <span style="color: #ea580c;">${catHigh} alta${catHigh > 1 ? "s" : ""}</span>`;

    sectionsHtml += `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; color: #1a1a2e; margin: 0 0 8px 0; padding: 8px 16px; background: #f8f8fc; border-radius: 8px 8px 0 0;">
          ${emoji} ${label} (${catNotifCount})${catPriorityHint}
        </h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e8e8f0; border-radius: 0 0 8px 8px; border-top: none;">
          ${itemsHtml}
        </table>
      </div>`;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f8;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
      <h1 style="color: #e2a93b; font-size: 24px; margin: 0 0 4px 0;">Intentus CLM</h1>
      <p style="color: #a0a0c0; font-size: 14px; margin: 0;">Resumo inteligente de notificações</p>
    </div>

    <!-- Body -->
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <p style="color: #333; font-size: 15px; margin: 0 0 16px 0;">
        Olá, <strong>${userName}</strong>! Você tem <strong>${totalCount} notificação${totalCount > 1 ? "ões" : ""}</strong> não lida${totalCount > 1 ? "s" : ""}, ordenadas por prioridade.
      </p>

      ${urgencyBannerHtml}

      ${sectionsHtml}

      <!-- CTA -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/contratos" style="display: inline-block; background: #e2a93b; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Abrir Intentus CLM
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
      <p style="margin: 0 0 4px 0;">Intentus Real Estate — Gestão Inteligente de Contratos</p>
      <p style="margin: 0;">
        <a href="${appUrl}/contratos/configuracoes" style="color: #999; text-decoration: underline;">Configurar preferências de notificação</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── MAIN HANDLER ──────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const appUrl = Deno.env.get("APP_URL") || "https://app.intentus.com.br";

  if (!resendApiKey) {
    console.warn("[send-notification-digest] RESEND_API_KEY not set — skipping");
    return jsonResponse(req, { success: true, skipped: true, reason: "no_resend_key" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log("[send-notification-digest] Starting smart digest v2...");
  const start = Date.now();

  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Buscar notificações não-lidas das últimas 24h
    //    V2: Inclui priority, urgency_score, group_key, snoozed_until
    const { data: unreadNotifs } = await supabase
      .from("notifications")
      .select("id, user_id, tenant_id, title, message, category, reference_type, reference_id, created_at, priority, urgency_score, group_key, snoozed_until")
      .eq("read", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (!unreadNotifs?.length) {
      console.log("[send-notification-digest] No unread notifications — nothing to send");
      return jsonResponse(req, { success: true, emails_sent: 0, reason: "no_unread" });
    }

    // 2. Filtrar snoozed — excluir notificações com snoozed_until > now
    const nowIso = now.toISOString();
    const activeNotifs = (unreadNotifs as NotifRow[]).filter((n) => {
      if (!n.snoozed_until) return true;
      return n.snoozed_until <= nowIso;
    });

    if (!activeNotifs.length) {
      console.log("[send-notification-digest] All notifications are snoozed — nothing to send");
      return jsonResponse(req, { success: true, emails_sent: 0, reason: "all_snoozed", total_snoozed: unreadNotifs.length });
    }

    // 3. Agrupar por user_id
    const byUser = new Map<string, NotifRow[]>();
    for (const n of activeNotifs) {
      const existing = byUser.get(n.user_id) || [];
      existing.push(n);
      byUser.set(n.user_id, existing);
    }

    // 4. Para cada usuário, verificar preferências e enviar
    const { Resend } = await import("npm:resend@2.0.0");
    const resend = new Resend(resendApiKey);
    let emailsSent = 0;
    let emailsSkipped = 0;
    let emailsQuietHours = 0;

    for (const [userId, notifications] of byUser) {
      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name, tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile?.email) {
        emailsSkipped++;
        continue;
      }

      // Buscar preferências completas (V2: inclui quiet hours)
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("category, email_enabled, frequency, quiet_hours_start, quiet_hours_end, quiet_hours_enabled")
        .eq("tenant_id", profile.tenant_id);

      // Verificar quiet hours globais (usa a primeira preferência que tem quiet hours habilitado)
      const quietPref = (prefs || []).find((p: any) => p.quiet_hours_enabled);
      if (quietPref && isInQuietHours(quietPref.quiet_hours_start, quietPref.quiet_hours_end, quietPref.quiet_hours_enabled)) {
        // Em quiet hours — só enviar se tem notificações CRITICAL
        const hasCritical = notifications.some((n) => n.priority === "critical");
        if (!hasCritical) {
          emailsQuietHours++;
          console.log(`[send-notification-digest] Skipping ${profile.email} — quiet hours (no critical)`);
          continue;
        }
        console.log(`[send-notification-digest] User ${profile.email} in quiet hours but has CRITICAL — sending anyway`);
      }

      // Criar mapa de preferências
      const prefMap: Record<string, { email_enabled: boolean; frequency: string }> = {};
      for (const p of prefs || []) {
        prefMap[(p as any).category] = {
          email_enabled: (p as any).email_enabled,
          frequency: (p as any).frequency,
        };
      }

      // Filtrar por preferências (V2: critical SEMPRE passa, ignora frequency)
      const allowedNotifs = notifications.filter((n) => {
        // Critical sempre é enviado, independente de preferências
        if (n.priority === "critical") return true;

        const pref = prefMap[n.category];
        if (!pref) return true; // Sem preferência = default habilitado
        if (!pref.email_enabled) return false;
        if (pref.frequency === "weekly") return false;
        return true;
      });

      if (!allowedNotifs.length) {
        emailsSkipped++;
        continue;
      }

      // V2: Colapsar por group_key
      const collapsed = collapseByGroupKey(allowedNotifs);

      // V2: Ordenar por urgência
      const sorted = sortByUrgency(collapsed);

      // Agrupar por categoria (mantendo ordem de urgência dentro de cada grupo)
      const groupedByCategory: Record<string, GroupedNotif[]> = {};
      for (const n of sorted) {
        const cat = n.category || "sistema";
        if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
        groupedByCategory[cat].push(n);
      }

      // Contar prioridades para banner
      const criticalCount = sorted.filter((n) => n.priority === "critical").length;
      const highCount = sorted.filter((n) => n.priority === "high").length;

      // Gerar e enviar email
      const userName = profile.full_name || profile.email.split("@")[0];
      const html = generateEmailHtmlV2(userName, groupedByCategory, appUrl, criticalCount, highCount);
      const totalCount = sorted.reduce((s, n) => s + n.group_count, 0);

      // Subject dinâmico baseado em prioridade
      let subjectPrefix = "📬";
      if (criticalCount > 0) subjectPrefix = "🚨";
      else if (highCount > 0) subjectPrefix = "⚠️";

      try {
        await resend.emails.send({
          from: "Intentus CLM <noreply@intentus.com.br>",
          to: profile.email,
          subject: `${subjectPrefix} ${totalCount} notificação${totalCount > 1 ? "ões" : ""} não lida${totalCount > 1 ? "s" : ""}${criticalCount > 0 ? ` (${criticalCount} crítica${criticalCount > 1 ? "s" : ""})` : ""} — Intentus CLM`,
          html,
        });
        emailsSent++;
        console.log(`[send-notification-digest] Email sent to ${profile.email} (${totalCount} notifs, ${criticalCount} critical, ${highCount} high)`);
      } catch (emailErr) {
        console.error(`[send-notification-digest] Failed to send to ${profile.email}:`, emailErr);
        emailsSkipped++;
      }
    }

    const duration = Date.now() - start;
    console.log(
      `[send-notification-digest] Done in ${duration}ms — ${emailsSent} sent, ${emailsSkipped} skipped, ${emailsQuietHours} quiet hours`,
    );

    return jsonResponse(req, {
      success: true,
      version: "v2",
      emails_sent: emailsSent,
      emails_skipped: emailsSkipped,
      emails_quiet_hours: emailsQuietHours,
      total_unread_notifications: unreadNotifs.length,
      active_notifications: activeNotifs.length,
      snoozed_filtered: unreadNotifs.length - activeNotifs.length,
      unique_users: byUser.size,
      duration_ms: duration,
    });
  } catch (error) {
    console.error("[send-notification-digest] Error:", error);
    return jsonResponse(req, { error: "Internal error", detail: String(error) }, 500);
  }
});
