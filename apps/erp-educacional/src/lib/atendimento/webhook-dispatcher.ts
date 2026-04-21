/**
 * Webhook Outbound Dispatcher (S8a)
 *
 * Enfileira e entrega webhooks para URLs subscritas em webhook_outbound_urls.
 * Estratégia:
 *   1. `dispatchEvent(eventType, payload)` → enfileira em webhook_attempts
 *      para cada outbound URL que subscreveu o evento (attempt=0, próxima
 *      tentativa = NOW). A 1ª tentativa é síncrona (best-effort).
 *   2. Tentativas subsequentes são executadas pelo worker cron
 *      (/api/atendimento/webhooks/worker) que escaneia webhook_attempts
 *      pendentes e aplica backoff exponencial conforme retry_policy.
 *
 * Backoff default: [5s, 15s, 30s, 60s, 120s] (5 tentativas).
 *
 * Assinatura HMAC-SHA256: se `secret` está setado na outbound_url, envia
 * header `x-signature: sha256=<hex>` calculado sobre o body JSON.
 */

import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type RetryPolicy = {
  max: number;
  backoff_s: number[];
};

type WebhookOutbound = {
  id: string;
  url: string;
  secret: string | null;
  events: string[];
  retry_policy: RetryPolicy | null;
  headers_extra: Record<string, string> | null;
  active: boolean;
};

type AttemptRow = {
  id: string;
  outbound_id: string;
  event_type: string;
  payload: unknown;
  attempt: number;
};

const DEFAULT_POLICY: RetryPolicy = { max: 5, backoff_s: [5, 15, 30, 60, 120] };

function signPayload(body: string, secret: string | null): string | null {
  if (!secret) return null;
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function sendOnce(
  outbound: WebhookOutbound,
  eventType: string,
  payload: unknown,
): Promise<{ ok: boolean; statusCode: number | null; response: string; headers: Record<string, string>; error?: string }> {
  try {
    const body = JSON.stringify({ event: eventType, data: payload, ts: new Date().toISOString() });
    const signature = signPayload(body, outbound.secret);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "erp-fic-atendimento/1.0",
      ...(outbound.headers_extra ?? {}),
    };
    if (signature) headers["x-signature"] = signature;

    // Timeout defensivo — 10s (AbortController)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(outbound.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      const text = await res.text().catch(() => "");
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      return { ok: res.ok, statusCode: res.status, response: text.slice(0, 2000), headers: respHeaders };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return {
      ok: false,
      statusCode: null,
      response: "",
      headers: {},
      error: (err as Error).message,
    };
  }
}

/**
 * Enfileira entregas para TODAS as URLs que subscreveram o evento.
 * A primeira tentativa é executada sincronamente (best-effort); falhas
 * ficam com next_retry_at preenchido e são processadas pelo worker.
 */
export async function dispatchEvent(
  eventType: string,
  payload: unknown,
  supabaseOpt?: SupabaseClient,
): Promise<{ dispatched: number; succeeded: number }> {
  const supabase = supabaseOpt ?? createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outs, error } = await (supabase as any)
    .from("webhook_outbound_urls")
    .select("id, url, secret, events, retry_policy, headers_extra, active")
    .eq("active", true)
    .contains("events", [eventType]);

  if (error || !outs || outs.length === 0) {
    if (error) console.error("[DISPATCHER] fetch error", error);
    return { dispatched: 0, succeeded: 0 };
  }

  let succeeded = 0;

  for (const out of outs as WebhookOutbound[]) {
    try {
      const result = await sendOnce(out, eventType, payload);
      const now = Date.now();
      const policy = out.retry_policy ?? DEFAULT_POLICY;

      if (result.ok) {
        succeeded++;
        await supabase
          .from("webhook_attempts")
          .insert({
            outbound_id: out.id,
            event_type: eventType,
            payload,
            status_code: result.statusCode,
            response_body: result.response,
            response_headers: result.headers,
            attempt: 0,
            next_retry_at: null,
            delivered_at: new Date().toISOString(),
          });
        await supabase
          .from("webhook_outbound_urls")
          .update({ last_delivery_at: new Date().toISOString() })
          .eq("id", out.id);
      } else {
        // Programa próxima tentativa
        const backoffMs = (policy.backoff_s[0] ?? 5) * 1000;
        await supabase
          .from("webhook_attempts")
          .insert({
            outbound_id: out.id,
            event_type: eventType,
            payload,
            status_code: result.statusCode,
            response_body: result.response,
            response_headers: result.headers,
            attempt: 0,
            next_retry_at: new Date(now + backoffMs).toISOString(),
            error: result.error ?? null,
          });
      }
    } catch (err) {
      console.error(`[DISPATCHER] outbound ${out.id} crashed`, err);
    }
  }

  return { dispatched: outs.length, succeeded };
}

/**
 * Worker — processa tentativas com next_retry_at <= NOW.
 * Deve ser invocado por cron (1min) via /api/atendimento/webhooks/worker.
 */
export async function processRetryQueue(
  supabaseOpt?: SupabaseClient,
  limit: number = 50,
): Promise<{ processed: number; succeeded: number; failed: number; exhausted: number }> {
  const supabase = supabaseOpt ?? createAdminClient();

  const nowIso = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pending, error } = await (supabase as any)
    .from("webhook_attempts")
    .select("id, outbound_id, event_type, payload, attempt")
    .is("delivered_at", null)
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (error || !pending) {
    if (error) console.error("[DISPATCHER WORKER] fetch error", error);
    return { processed: 0, succeeded: 0, failed: 0, exhausted: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  let exhausted = 0;

  for (const att of pending as AttemptRow[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: out } = await (supabase as any)
      .from("webhook_outbound_urls")
      .select("id, url, secret, events, retry_policy, headers_extra, active")
      .eq("id", att.outbound_id)
      .maybeSingle();

    if (!out || !out.active) {
      // Outbound foi desativado: marca como exhausted
      await supabase
        .from("webhook_attempts")
        .update({ next_retry_at: null, error: "outbound inactive" })
        .eq("id", att.id);
      exhausted++;
      continue;
    }

    const result = await sendOnce(out as WebhookOutbound, att.event_type, att.payload);
    const nextAttempt = att.attempt + 1;
    const policy: RetryPolicy = (out as WebhookOutbound).retry_policy ?? DEFAULT_POLICY;

    if (result.ok) {
      await supabase
        .from("webhook_attempts")
        .update({
          status_code: result.statusCode,
          response_body: result.response,
          response_headers: result.headers,
          attempt: nextAttempt,
          next_retry_at: null,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", att.id);
      await supabase
        .from("webhook_outbound_urls")
        .update({ last_delivery_at: new Date().toISOString() })
        .eq("id", out.id);
      succeeded++;
    } else if (nextAttempt >= policy.max) {
      await supabase
        .from("webhook_attempts")
        .update({
          status_code: result.statusCode,
          response_body: result.response,
          response_headers: result.headers,
          attempt: nextAttempt,
          next_retry_at: null,
          error: `exhausted after ${nextAttempt} attempts: ${result.error ?? ""}`,
        })
        .eq("id", att.id);
      exhausted++;
    } else {
      const backoff = (policy.backoff_s[nextAttempt] ?? policy.backoff_s[policy.backoff_s.length - 1] ?? 120) * 1000;
      await supabase
        .from("webhook_attempts")
        .update({
          status_code: result.statusCode,
          response_body: result.response,
          response_headers: result.headers,
          attempt: nextAttempt,
          next_retry_at: new Date(Date.now() + backoff).toISOString(),
          error: result.error ?? null,
        })
        .eq("id", att.id);
      failed++;
    }
  }

  return { processed: pending.length, succeeded, failed, exhausted };
}
