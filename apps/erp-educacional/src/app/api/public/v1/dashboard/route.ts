/**
 * GET /api/public/v1/dashboard
 *
 * Métricas do dia em um único payload. Scope: dashboard:read.
 *
 * Response:
 *   {
 *     conversations_open: N,
 *     conversations_resolved_today: N,
 *     avg_response_time_seconds: N | null,
 *     messages_today: N,
 *     contacts_total: N,
 *     deals_open: N,
 *     deals_won_today: N,
 *     deals_lost_today: N,
 *     webhook_attempts_pending: N,
 *     generated_at: ISO
 *   }
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPublicApiKey } from "@/lib/atendimento/public-api-auth";

export const GET = withPublicApiKey("dashboard:read", async (_req: NextRequest, ctx) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayIso = startOfDay.toISOString();

  async function count(table: string, filter: (q: unknown) => unknown): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (ctx.supabase as any).from(table).select("*", { count: "exact", head: true });
    q = filter(q);
    const { count } = await q;
    return count ?? 0;
  }

  const [
    conversations_open,
    conversations_resolved_today,
    messages_today,
    contacts_total,
    deals_open,
    deals_won_today,
    deals_lost_today,
    webhook_attempts_pending,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("atendimento_conversations", (q: any) => q.eq("status", "open")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("atendimento_conversations", (q: any) => q.eq("status", "resolved").gte("updated_at", startOfDayIso)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("atendimento_messages", (q: any) => q.gte("created_at", startOfDayIso)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("atendimento_contacts", (q: any) => q),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("deals", (q: any) => q.is("won_at", null).is("lost_at", null)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("deals", (q: any) => q.gte("won_at", startOfDayIso)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("deals", (q: any) => q.gte("lost_at", startOfDayIso)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count("webhook_attempts", (q: any) => q.is("delivered_at", null).not("next_retry_at", "is", null)),
  ]);

  return NextResponse.json({
    conversations_open,
    conversations_resolved_today,
    avg_response_time_seconds: null, // S7 calcula via metrics_snapshots
    messages_today,
    contacts_total,
    deals_open,
    deals_won_today,
    deals_lost_today,
    webhook_attempts_pending,
    generated_at: new Date().toISOString(),
  });
});
