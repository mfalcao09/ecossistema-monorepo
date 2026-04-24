import { supabase } from "./client.js";

export type HealthCheckKind = "heartbeat" | "canary" | "socket_ping" | "reconnect";

export async function recordHealthCheck(
  instanceId: string,
  kind: HealthCheckKind,
  success: boolean,
  latencyMs?: number | null,
  details?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase()
    .from("whatsapp_health_checks")
    .insert({
      instance_id: instanceId,
      kind,
      success,
      latency_ms: latencyMs ?? null,
      details: details ?? null,
    });
  if (error) {
    // Health check log falhar não deve derrubar o loop
    console.error(`recordHealthCheck failed: ${error.message}`);
  }
}

/** Últimos N heartbeats; usado por watchdog. */
export async function recentFailures(
  instanceId: string,
  kind: HealthCheckKind,
  window = 5,
): Promise<number> {
  const { data, error } = await supabase()
    .from("whatsapp_health_checks")
    .select("success")
    .eq("instance_id", instanceId)
    .eq("kind", kind)
    .order("checked_at", { ascending: false })
    .limit(window);
  if (error) return 0;
  return (data ?? []).filter((r) => !r.success).length;
}
