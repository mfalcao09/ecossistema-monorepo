/**
 * Cron: processa steps de funis DS Voice (execução 1x/minuto).
 *
 * Schedule: `* * * * *` em vercel.json.
 * Auth: header `x-cron-secret` (ou Authorization Bearer) com CRON_SECRET.
 * Aceita `?backfill=N` para processar explicitamente até N executions (default: 50).
 *
 * Lógica:
 *   - SELECT executions WHERE status='running' AND next_step_at <= now() LIMIT N
 *   - Para cada execução:
 *       - busca funnel_steps em ordem
 *       - se current_step_order >= total → marca done
 *       - senão: pega step atual → sendDsVoiceStep → avança cursor
 *       - calcula next_step_at = now() + delay do próximo step
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDsVoiceStep } from "@/lib/atendimento/ds-voice-sender";
import { isDsVoiceEnabled } from "@/lib/atendimento/feature-flags";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ExecRow {
  id: string;
  funnel_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  current_step_order: number;
  attempt_count: number;
}

interface StepRow {
  id: string;
  sort_order: number;
  item_type: "message" | "audio" | "media" | "document";
  item_id: string;
  delay_seconds: number;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET;
  if (!secret) return process.env.NODE_ENV === "development"; // dev permite
  const header =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

async function processOne(
  admin: ReturnType<typeof createAdminClient>,
  exec: ExecRow,
): Promise<{ ok: boolean; action: string; error?: string }> {
  // Carrega os steps do funil
  const { data: steps } = await admin
    .from("ds_voice_funnel_steps")
    .select("id, sort_order, item_type, item_id, delay_seconds")
    .eq("funnel_id", exec.funnel_id)
    .order("sort_order", { ascending: true });

  const list = (steps ?? []) as StepRow[];
  if (list.length === 0) {
    await admin
      .from("ds_voice_funnel_executions")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        last_error: "empty_funnel",
      })
      .eq("id", exec.id);
    return { ok: true, action: "marked_done_empty" };
  }

  // current_step_order é o *próximo* step a ser enviado (0-based)
  const idx = exec.current_step_order;
  if (idx >= list.length) {
    await admin
      .from("ds_voice_funnel_executions")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", exec.id);
    return { ok: true, action: "marked_done" };
  }

  const step = list[idx];
  if (!exec.conversation_id || !exec.contact_id) {
    await admin
      .from("ds_voice_funnel_executions")
      .update({
        status: "failed",
        last_error: "missing_conversation_or_contact",
        completed_at: new Date().toISOString(),
      })
      .eq("id", exec.id);
    return { ok: false, action: "failed", error: "missing_conversation" };
  }

  // Busca inbox_id via conversa
  const { data: conv } = await admin
    .from("atendimento_conversations")
    .select("inbox_id")
    .eq("id", exec.conversation_id)
    .maybeSingle();

  const result = await sendDsVoiceStep({
    item_type: step.item_type,
    item_id: step.item_id,
    conversation_id: exec.conversation_id,
    contact_id: exec.contact_id,
    inbox_id: conv?.inbox_id ?? null,
  });

  if (!result.ok) {
    await admin
      .from("ds_voice_funnel_executions")
      .update({
        last_error: result.error ?? "unknown",
        attempt_count: exec.attempt_count + 1,
        // backoff simples: 5min * attempts
        next_step_at: new Date(
          Date.now() + 5 * 60 * 1000 * Math.max(1, exec.attempt_count + 1),
        ).toISOString(),
      })
      .eq("id", exec.id);
    return { ok: false, action: "retry_scheduled", error: result.error };
  }

  // Step enviado → avança cursor
  const nextIdx = idx + 1;
  const nextStep = list[nextIdx];
  if (!nextStep) {
    await admin
      .from("ds_voice_funnel_executions")
      .update({
        current_step_order: nextIdx,
        status: "done",
        completed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", exec.id);
    return { ok: true, action: "sent_last" };
  }

  await admin
    .from("ds_voice_funnel_executions")
    .update({
      current_step_order: nextIdx,
      next_step_at: new Date(
        Date.now() + nextStep.delay_seconds * 1000,
      ).toISOString(),
      last_error: null,
    })
    .eq("id", exec.id);
  return { ok: true, action: "advanced" };
}

async function drain(limit: number): Promise<{
  processed: number;
  done: number;
  failed: number;
  retried: number;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: execs } = await admin
    .from("ds_voice_funnel_executions")
    .select(
      "id, funnel_id, contact_id, conversation_id, current_step_order, attempt_count",
    )
    .eq("status", "running")
    .lte("next_step_at", nowIso)
    .order("next_step_at", { ascending: true })
    .limit(limit);

  let done = 0;
  let failed = 0;
  let retried = 0;
  for (const e of (execs ?? []) as ExecRow[]) {
    const r = await processOne(admin, e);
    if (r.action.startsWith("marked_done") || r.action.startsWith("sent_last"))
      done++;
    else if (r.action === "advanced") {
      /* noop */
    } else if (r.action === "retry_scheduled") retried++;
    else if (r.action === "failed") failed++;
  }

  return { processed: execs?.length ?? 0, done, failed, retried };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  if (!authorized(req)) {
    console.warn("[ds-voice/cron] unauthorized call");
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  if (!isDsVoiceEnabled()) {
    console.log("[ds-voice/cron] skipped — feature flag off");
    return NextResponse.json({ skipped: "feature_flag_off" });
  }

  const limit =
    parseInt(req.nextUrl.searchParams.get("backfill") ?? "50", 10) || 50;

  try {
    const result = await drain(Math.min(Math.max(limit, 1), 500));
    const duration_ms = Date.now() - startedAt;
    console.log(
      "[ds-voice/cron] drained",
      JSON.stringify({ ...result, duration_ms, limit }),
    );
    return NextResponse.json({ ...result, duration_ms });
  } catch (err) {
    console.error("[ds-voice/cron] fatal", err);
    return NextResponse.json(
      {
        erro: err instanceof Error ? err.message : "cron_failed",
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

export const POST = GET;
