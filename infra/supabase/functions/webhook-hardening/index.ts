// webhook-hardening/index.ts
// SC-10 — HMAC + rate-limit + idempotência + forward para target interno.
import { getAdmin } from "../_shared/supabase-admin.ts";
import { errors, ok } from "../_shared/errors.ts";
import { startTimer, writeAuditLog } from "../_shared/audit.ts";
import { hitLimit } from "../_shared/rate-limit.ts";
import { sha256Body, verifyHMAC } from "./hmac.ts";

Deno.serve(async (req) => {
  const timer = startTimer();
  const supabase = getAdmin();
  const url = new URL(req.url);
  const provider = url.pathname.split("/").filter(Boolean).pop() ?? "";
  if (!provider) return errors.badRequest("provider required in path");
  if (req.method !== "POST") return errors.methodNotAllowed();

  // 0. Load provider config
  const { data: target, error: targetErr } = await supabase.from("webhook_targets")
    .select("provider, target_url, secret_key, signature_header, hmac_algo, rate_limit_rpm, is_active")
    .eq("provider", provider).maybeSingle();
  if (targetErr || !target) {
    await writeAuditLog(supabase, {
      agent_id: "webhook-hardening", tool_name: "webhook-hardening", action: "forward",
      success: false, severity: "warning", article_ref: "SC-10", decision: "block",
      reason: "provider_not_configured", metadata: { provider },
    });
    return errors.notFound(`provider not configured: ${provider}`);
  }
  if (!target.is_active) return errors.forbidden("provider_disabled", `provider disabled: ${provider}`);

  const body = await req.text();

  // 1. HMAC
  if (target.secret_key) {
    const sigHeader = req.headers.get(target.signature_header)
      ?? req.headers.get("x-signature")
      ?? req.headers.get("x-hub-signature-256");
    const algo = (target.hmac_algo ?? "sha256") as "sha256" | "sha1" | "sha512";
    const hmac = await verifyHMAC(supabase, provider, body, sigHeader, algo, target.secret_key);
    if (!hmac.valid) {
      await writeAuditLog(supabase, {
        agent_id: "webhook-hardening", tool_name: "webhook-hardening", action: "forward",
        success: false, severity: "warning", article_ref: "SC-10", decision: "block",
        reason: hmac.reason ?? "invalid_signature", metadata: { provider },
      });
      return errors.unauthorized("invalid signature");
    }
  }

  // 2. Rate limit por provider + IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rlKey = `webhook:${provider}:${ip}`;
  const rl = await hitLimit(supabase, rlKey, "rpm", target.rate_limit_rpm ?? 100);
  if (!rl.ok) {
    return errors.rateLimited("rpm exceeded", { retry_after_s: rl.retryAfter });
  }

  // 3. Idempotência
  const bodyHash = await sha256Body(body);
  const { data: existing } = await supabase.from("webhook_idempotency")
    .select("body_hash, status, target_status").match({ provider, body_hash: bodyHash }).maybeSingle();
  if (existing) {
    return ok({ forwarded: false, status: "duplicate_ignored", original_status: existing.target_status });
  }

  // 4. Forward
  let targetStatus = 0;
  let forwardError: string | null = null;
  try {
    const resp = await fetch(target.target_url, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        "x-webhook-provider": provider,
        "x-webhook-body-hash": bodyHash,
      },
      body,
    });
    targetStatus = resp.status;
    await resp.body?.cancel();
  } catch (e) {
    forwardError = (e as Error).message;
    targetStatus = 0;
  }

  // 5. Record idempotency (upsert — dois racing peers no mesmo body resolvem em 1 linha)
  await supabase.from("webhook_idempotency").upsert({
    provider, body_hash: bodyHash,
    status: forwardError ? "processed" : targetStatus < 500 ? "forwarded" : "processed",
    target_status: targetStatus || null,
  }, { onConflict: "provider,body_hash", ignoreDuplicates: true });

  // 6. Audit
  await writeAuditLog(supabase, {
    agent_id: "webhook-hardening", tool_name: "webhook-hardening", action: "forward",
    success: !forwardError && targetStatus >= 200 && targetStatus < 400,
    severity: forwardError ? "error" : "info",
    article_ref: "SC-10", decision: "allow", duration_ms: timer(),
    metadata: { provider, ip, target_url: target.target_url, target_status: targetStatus, error: forwardError },
  });

  if (forwardError) return errors.badGateway("forward failed", forwardError);
  return ok({ forwarded: true, target_status: targetStatus, body_hash: bodyHash });
});
