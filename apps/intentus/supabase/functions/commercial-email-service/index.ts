/**
 * commercial-email-service v1
 * Email CRM integrado — envio via SMTP (genérico/Gmail/Outlook) ou Resend.
 *
 * 5 actions:
 *   - send_email:     Envia email via conta configurada (SMTP ou Resend)
 *   - get_accounts:   Lista contas de email do tenant
 *   - save_account:   Cria/atualiza conta de email (upsert)
 *   - delete_account: Remove conta de email
 *   - get_messages:   Lista emails enviados (por lead/deal/geral)
 *
 * Providers: smtp (genérico), gmail_smtp, outlook_smtp, resend
 * Self-contained: inline CORS, auth/tenant.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.10";

// ─── CORS ────────────────────────────────────────────────────────────────────
const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  let a = "";
  if (PROD_ORIGINS.includes(origin)) a = origin;
  else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) a = origin;
  else if (/^https:\/\/intentus-plataform-.+\.vercel\.app$/.test(origin)) a = origin;
  return { "Access-Control-Allow-Origin": a || PROD_ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
}

// ─── Auth ────────────────────────────────────────────────────────────────────
async function resolveAuth(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  const uc = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = createClient(url, service);
  const { data: profile } = await admin.from("profiles").select("tenant_id, name").eq("user_id", user.id).single();
  if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");
  return { userId: user.id, tenantId: profile.tenant_id, userName: profile.name || "Usuário", admin };
}

function sanitize(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

// ─── Send via SMTP ───────────────────────────────────────────────────────────
async function sendViaSMTP(account: any, email: { to: string; cc?: string; bcc?: string; subject: string; body_text?: string; body_html?: string }) {
  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port || 465,
    secure: account.smtp_secure ?? true,
    auth: {
      user: account.smtp_user,
      pass: account.smtp_password,
    },
  });

  const mailOptions: any = {
    from: `"${account.display_name}" <${account.email_address}>`,
    to: email.to,
    subject: email.subject,
  };

  if (email.cc) mailOptions.cc = email.cc;
  if (email.bcc) mailOptions.bcc = email.bcc;
  if (email.body_html) mailOptions.html = email.body_html;
  if (email.body_text) mailOptions.text = email.body_text;
  if (!email.body_html && !email.body_text) mailOptions.text = "";

  await new Promise<void>((resolve, reject) => {
    transport.sendMail(mailOptions, (error: any) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

// ─── Send via Resend ─────────────────────────────────────────────────────────
async function sendViaResend(account: any, email: { to: string; cc?: string; bcc?: string; subject: string; body_text?: string; body_html?: string }) {
  const apiKey = account.resend_api_key || Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("Resend API key não configurada");

  const payload: any = {
    from: `${account.display_name} <${account.email_address}>`,
    to: email.to.split(",").map((e: string) => e.trim()),
    subject: email.subject,
  };
  if (email.cc) payload.cc = email.cc.split(",").map((e: string) => e.trim());
  if (email.bcc) payload.bcc = email.bcc.split(",").map((e: string) => e.trim());
  if (email.body_html) payload.html = email.body_html;
  else payload.text = email.body_text || "";

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend error: ${resp.status} - ${err}`);
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function handleSendEmail(admin: any, userId: string, tenantId: string, body: any) {
  const accountId = sanitize(body.account_id, 36);
  const to = sanitize(body.to, 500);
  const subject = sanitize(body.subject, 500);
  const bodyText = sanitize(body.body_text, 10000);
  const bodyHtml = sanitize(body.body_html, 50000);
  const cc = sanitize(body.cc, 500) || null;
  const bcc = sanitize(body.bcc, 500) || null;
  const leadId = sanitize(body.lead_id, 36) || null;
  const dealId = sanitize(body.deal_id, 36) || null;
  const personId = sanitize(body.person_id, 36) || null;

  if (!to || !subject) return { error: "to e subject são obrigatórios", status: 400 };

  // Get account
  let account: any;
  if (accountId) {
    const { data } = await admin.from("crm_email_accounts").select("*").eq("id", accountId).eq("tenant_id", tenantId).single();
    account = data;
  } else {
    // Use default account
    const { data } = await admin.from("crm_email_accounts").select("*").eq("tenant_id", tenantId).eq("user_id", userId).eq("is_default", true).eq("is_active", true).maybeSingle();
    account = data;
    if (!account) {
      const { data: any_account } = await admin.from("crm_email_accounts").select("*").eq("tenant_id", tenantId).eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle();
      account = any_account;
    }
  }

  if (!account) return { error: "Nenhuma conta de email configurada. Configure em Configurações > Email.", status: 400 };

  // Save message as "sending"
  const { data: msg, error: msgErr } = await admin.from("crm_email_messages").insert({
    tenant_id: tenantId,
    account_id: account.id,
    direction: "sent",
    from_email: account.email_address,
    to_email: to,
    cc, bcc, subject,
    body_text: bodyText || null,
    body_html: bodyHtml || null,
    lead_id: leadId, deal_id: dealId, person_id: personId,
    status: "sending",
  }).select("id").single();
  if (msgErr) throw msgErr;

  // Send
  try {
    const emailData = { to, cc: cc || undefined, bcc: bcc || undefined, subject, body_text: bodyText, body_html: bodyHtml };

    if (account.provider === "resend") {
      await sendViaResend(account, emailData);
    } else {
      // smtp, gmail_smtp, outlook_smtp — all use SMTP
      await sendViaSMTP(account, emailData);
    }

    // Update status
    await admin.from("crm_email_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", msg.id);
    await admin.from("crm_email_accounts").update({ last_used_at: new Date().toISOString() }).eq("id", account.id);

    return { data: { success: true, message_id: msg.id } };
  } catch (err: any) {
    await admin.from("crm_email_messages").update({ status: "failed", error_message: err.message?.slice(0, 500) }).eq("id", msg.id);
    return { error: `Falha ao enviar: ${err.message}`, status: 500 };
  }
}

async function handleGetAccounts(admin: any, userId: string, tenantId: string) {
  const { data, error } = await admin
    .from("crm_email_accounts")
    .select("id, provider, display_name, email_address, smtp_host, smtp_port, is_default, is_active, last_used_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("is_default", { ascending: false });
  if (error) throw error;
  return { data: data || [] };
}

async function handleSaveAccount(admin: any, userId: string, tenantId: string, body: any) {
  const id = sanitize(body.id, 36) || undefined;
  const provider = sanitize(body.provider, 20);
  const displayName = sanitize(body.display_name, 200);
  const emailAddress = sanitize(body.email_address, 255);

  if (!provider || !displayName || !emailAddress) return { error: "provider, display_name e email_address são obrigatórios", status: 400 };

  const record: any = {
    tenant_id: tenantId,
    user_id: userId,
    provider,
    display_name: displayName,
    email_address: emailAddress,
    is_default: body.is_default ?? false,
    is_active: body.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (["smtp", "gmail_smtp", "outlook_smtp"].includes(provider)) {
    record.smtp_host = sanitize(body.smtp_host, 200);
    record.smtp_port = Number(body.smtp_port) || 465;
    record.smtp_secure = body.smtp_secure ?? true;
    record.smtp_user = sanitize(body.smtp_user, 200);
    record.smtp_password = sanitize(body.smtp_password, 500);
  }

  if (provider === "resend") {
    record.resend_api_key = sanitize(body.resend_api_key, 200);
  }

  // Preset configs for known providers
  if (provider === "gmail_smtp" && !record.smtp_host) {
    record.smtp_host = "smtp.gmail.com";
    record.smtp_port = 465;
    record.smtp_secure = true;
  }
  if (provider === "outlook_smtp" && !record.smtp_host) {
    record.smtp_host = "smtp-mail.outlook.com";
    record.smtp_port = 587;
    record.smtp_secure = false;
  }

  if (id) {
    const { error } = await admin.from("crm_email_accounts").update(record).eq("id", id).eq("tenant_id", tenantId);
    if (error) throw error;
  } else {
    const { error } = await admin.from("crm_email_accounts").insert(record);
    if (error) throw error;
  }

  // If is_default, unset others
  if (record.is_default) {
    await admin.from("crm_email_accounts").update({ is_default: false }).eq("tenant_id", tenantId).eq("user_id", userId).neq("email_address", emailAddress);
  }

  return { data: { success: true } };
}

async function handleDeleteAccount(admin: any, tenantId: string, body: any) {
  const id = sanitize(body.id, 36);
  if (!id) return { error: "id é obrigatório", status: 400 };
  const { error } = await admin.from("crm_email_accounts").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) throw error;
  return { data: { success: true } };
}

async function handleGetMessages(admin: any, tenantId: string, body: any) {
  const leadId = sanitize(body.lead_id, 36) || null;
  const dealId = sanitize(body.deal_id, 36) || null;
  const limit = Math.min(100, Math.max(1, Number(body.limit) || 30));

  let query = admin
    .from("crm_email_messages")
    .select("id, direction, from_email, to_email, subject, body_text, status, sent_at, lead_id, deal_id, person_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (leadId) query = query.eq("lead_id", leadId);
  if (dealId) query = query.eq("deal_id", dealId);

  const { data, error } = await query;
  if (error) throw error;
  return { data: data || [] };
}

// ─── Main ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { userId, tenantId, admin } = await resolveAuth(req);
    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "get_accounts";

    let result: { data?: unknown; error?: string; status?: number };

    switch (action) {
      case "send_email": result = await handleSendEmail(admin, userId, tenantId, body); break;
      case "get_accounts": result = await handleGetAccounts(admin, userId, tenantId); break;
      case "save_account": result = await handleSaveAccount(admin, userId, tenantId, body); break;
      case "delete_account": result = await handleDeleteAccount(admin, tenantId, body); break;
      case "get_messages": result = await handleGetMessages(admin, tenantId, body); break;
      default: result = { error: `Unknown action: ${action}`, status: 400 };
    }

    if (result.error) return new Response(JSON.stringify({ error: result.error }), { status: result.status || 400, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(result.data), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("email-service error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
