/**
 * Outbound queue — defesa #10.
 *
 * Worker drena em background com backoff exponencial. Se instância offline,
 * msgs ficam em `pending` e são tentadas quando reconnecta.
 */
import type { SendMessageRequest } from "@ecossistema/whatsapp-types";
import { supabase } from "./client.js";

const TABLE = "whatsapp_outbound_queue";

export interface QueueRow {
  id: string;
  instance_id: string;
  payload: SendMessageRequest;
  status: "pending" | "processing" | "sent" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  sent_message_id: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export async function enqueueOutbound(
  instanceId: string,
  payload: SendMessageRequest,
  priority = 0,
): Promise<QueueRow> {
  const { data, error } = await supabase()
    .from(TABLE)
    .insert({ instance_id: instanceId, payload, priority })
    .select("*")
    .single();
  if (error) throw new Error(`enqueueOutbound: ${error.message}`);
  return data as QueueRow;
}

/**
 * Pega até N jobs prontos (status=pending, next_attempt_at <= now),
 * marca como `processing` numa transação atômica via update...returning.
 */
export async function claimPendingJobs(
  instanceId: string,
  limit = 10,
): Promise<QueueRow[]> {
  // Seleciona candidatos
  const { data: candidates, error: selErr } = await supabase()
    .from(TABLE)
    .select("id")
    .eq("instance_id", instanceId)
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (selErr) throw new Error(`claimPendingJobs select: ${selErr.message}`);
  if (!candidates?.length) return [];

  const ids = candidates.map((c) => c.id);

  // Atualiza pra processing (melhor que perfeita atomicidade — se 2 workers rodando, um ganha)
  const { data, error } = await supabase()
    .from(TABLE)
    .update({ status: "processing" })
    .in("id", ids)
    .eq("status", "pending") // guard — não rouba se outro worker já pegou
    .select("*");
  if (error) throw new Error(`claimPendingJobs update: ${error.message}`);
  return (data ?? []) as QueueRow[];
}

export async function markJobSent(
  jobId: string,
  sentMessageId: string | null,
): Promise<void> {
  const { error } = await supabase()
    .from(TABLE)
    .update({ status: "sent", sent_message_id: sentMessageId })
    .eq("id", jobId);
  if (error) throw new Error(`markJobSent: ${error.message}`);
}

/** Marca como failed com backoff; se atingiu max_attempts, vira dead. */
export async function markJobFailed(
  job: QueueRow,
  errorMessage: string,
): Promise<void> {
  const attempts = job.attempts + 1;
  const BACKOFF_SEC = [5, 15, 60, 300, 900]; // 5s, 15s, 1m, 5m, 15m
  const delaySec = BACKOFF_SEC[Math.min(attempts - 1, BACKOFF_SEC.length - 1)];
  const nextAt = new Date(Date.now() + delaySec * 1000).toISOString();
  const isDead = attempts >= job.max_attempts;

  const { error } = await supabase()
    .from(TABLE)
    .update({
      status: isDead ? "dead" : "pending",
      attempts,
      last_error: errorMessage.slice(0, 500),
      next_attempt_at: nextAt,
    })
    .eq("id", job.id);
  if (error) throw new Error(`markJobFailed: ${error.message}`);
}
