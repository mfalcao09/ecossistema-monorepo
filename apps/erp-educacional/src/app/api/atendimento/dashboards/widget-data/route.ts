/**
 * GET /api/atendimento/dashboards/widget-data?kind=<slug>&range_days=&limit=
 *
 * Endpoint agregador usado pelos componentes do PR B (ADR-020 expansão).
 * Cada `kind` mapeia para um catalog_slug e resolve os dados necessários.
 *
 * Mantém-se tudo num só handler para não explodir a quantidade de rotas;
 * se um `kind` ficar pesado, migra para rota própria.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPermission } from "@/lib/atendimento/permissions";

type Admin = ReturnType<typeof createAdminClient>;

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export const GET = withPermission(
  "dashboard",
  "view",
)(async (req: NextRequest) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const rangeDays = Math.max(
    1,
    Math.min(365, Number(url.searchParams.get("range_days") ?? 30)),
  );
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit") ?? 10)),
  );
  const admin = createAdminClient();

  try {
    switch (kind) {
      case "agent_workload_live":
        return NextResponse.json(await agentWorkloadLive(admin, limit));
      case "live_queue_status":
        return NextResponse.json(await liveQueueStatus(admin));
      case "transfer_chain_trace":
        return NextResponse.json(await transferChainTrace(admin, limit));
      case "quick_replies_usage":
        return NextResponse.json(
          await quickRepliesUsage(admin, rangeDays, limit),
        );
      case "automation_execution_audit":
        return NextResponse.json(
          await automationAudit(admin, rangeDays, limit),
        );
      case "classification_tags_cloud":
        return NextResponse.json(await tagsCloud(admin, rangeDays, limit));
      case "reply_time_heatmap":
        return NextResponse.json(await replyTimeHeatmap(admin, rangeDays));
      case "conversation_funnel":
        return NextResponse.json(await conversationFunnel(admin, rangeDays));
      case "channel_performance":
        return NextResponse.json(await channelPerformance(admin, rangeDays));
      case "kanban_pipeline_mini":
        return NextResponse.json(await kanbanPipelineMini(admin));
      case "ai_assistant_status":
        return NextResponse.json(await aiAssistantStatus(admin));
      default:
        return NextResponse.json(
          { erro: "kind não reconhecido" },
          { status: 400 },
        );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Handlers por kind
// ─────────────────────────────────────────────────────────────────────────────

async function agentWorkloadLive(admin: Admin, limit: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agents } = await (admin as any)
    .from("atendimento_agents")
    .select("id, user_id, name, avatar_url, availability_status")
    .limit(limit);
  const rows = (agents ?? []) as Array<{
    id: string;
    user_id: string | null;
    name: string | null;
    avatar_url: string | null;
    availability_status: string | null;
  }>;
  if (rows.length === 0) return { agents: [] };

  const userIds = rows.map((a) => a.user_id).filter(Boolean) as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: counts } = await (admin as any)
    .from("atendimento_conversations")
    .select("assignee_id")
    .in("assignee_id", userIds)
    .eq("status", "open");
  const activeByUser = new Map<string, number>();
  for (const r of (counts as Array<{ assignee_id: string }> | null) ?? []) {
    activeByUser.set(r.assignee_id, (activeByUser.get(r.assignee_id) ?? 0) + 1);
  }

  return {
    agents: rows.map((a) => ({
      id: a.id,
      name: a.name,
      avatar_url: a.avatar_url,
      status: a.availability_status ?? "offline",
      active: a.user_id ? (activeByUser.get(a.user_id) ?? 0) : 0,
    })),
  };
}

async function liveQueueStatus(admin: Admin) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teams } = await (admin as any)
    .from("teams")
    .select("id, name, color_hex")
    .order("name", { ascending: true });
  const rows = (teams ?? []) as Array<{
    id: string;
    name: string;
    color_hex: string | null;
  }>;
  if (rows.length === 0) return { queues: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: convs } = await (admin as any)
    .from("atendimento_conversations")
    .select("team_id, created_at")
    .in(
      "team_id",
      rows.map((t) => t.id),
    )
    .in("status", ["pending", "open"]);
  const byTeam = new Map<string, { pending: number; oldest: string | null }>();
  for (const c of (convs as Array<{
    team_id: string;
    created_at: string;
  }> | null) ?? []) {
    const cur = byTeam.get(c.team_id) ?? { pending: 0, oldest: null };
    cur.pending += 1;
    if (!cur.oldest || c.created_at < cur.oldest) cur.oldest = c.created_at;
    byTeam.set(c.team_id, cur);
  }
  const now = Date.now();
  return {
    queues: rows.map((t) => {
      const entry = byTeam.get(t.id) ?? { pending: 0, oldest: null };
      const waitSec = entry.oldest
        ? Math.round((now - new Date(entry.oldest).getTime()) / 1000)
        : 0;
      return {
        id: t.id,
        name: t.name,
        color: t.color_hex,
        pending: entry.pending,
        longest_wait_sec: waitSec,
      };
    }),
  };
}

async function transferChainTrace(admin: Admin, limit: number) {
  // Proxy: últimas atribuições trocadas. Dados reais de histórico de
  // transferência virão em sprint futura com tabela dedicada de eventos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("atendimento_conversations")
    .select("id, assignee_id, team_id, updated_at, status")
    .not("assignee_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return { items: data ?? [] };
}

async function quickRepliesUsage(
  admin: Admin,
  rangeDays: number,
  limit: number,
) {
  const from = daysAgo(rangeDays);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgs } = await (admin as any)
    .from("atendimento_messages")
    .select("template_id")
    .not("template_id", "is", null)
    .gte("created_at", from);
  const count = new Map<string, number>();
  for (const m of (msgs as Array<{ template_id: string }> | null) ?? []) {
    count.set(m.template_id, (count.get(m.template_id) ?? 0) + 1);
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return { items: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: templates } = await (admin as any)
    .from("atendimento_whatsapp_templates")
    .select("id, name, title")
    .in(
      "id",
      top.map(([id]) => id),
    );
  const nameById = new Map<string, string>();
  for (const t of (templates as Array<{
    id: string;
    name: string | null;
    title: string | null;
  }> | null) ?? []) {
    nameById.set(t.id, t.title || t.name || "Sem nome");
  }
  return {
    items: top.map(([id, n]) => ({
      id,
      name: nameById.get(id) ?? id.slice(0, 8),
      count: n,
    })),
  };
}

async function automationAudit(admin: Admin, rangeDays: number, limit: number) {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - rangeDays);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runs } = await (admin as any)
    .from("automation_executions")
    .select("id, rule_id, status, executed_at, triggered_by_event, error")
    .gte("executed_at", from.toISOString())
    .order("executed_at", { ascending: false })
    .limit(limit);
  const items = (runs ?? []) as Array<{
    id: string;
    rule_id: string;
    status: string;
    executed_at: string;
    triggered_by_event: string;
    error: string | null;
  }>;
  if (items.length === 0)
    return { items: [], stats: { success: 0, failed: 0, partial: 0 } };

  const ruleIds = Array.from(new Set(items.map((r) => r.rule_id)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rules } = await (admin as any)
    .from("atendimento_automation_rules")
    .select("id, name")
    .in("id", ruleIds);
  const nameById = new Map<string, string>();
  for (const r of (rules as Array<{ id: string; name: string }> | null) ?? []) {
    nameById.set(r.id, r.name);
  }

  const stats = { success: 0, failed: 0, partial: 0 };
  for (const i of items) {
    if (i.status === "failed") stats.failed += 1;
    else if (i.status === "partial") stats.partial += 1;
    else stats.success += 1;
  }

  return {
    stats,
    items: items.map((i) => ({
      id: i.id,
      rule_name: nameById.get(i.rule_id) ?? "Regra removida",
      status: i.status,
      event: i.triggered_by_event,
      error: i.error,
      at: i.executed_at,
    })),
  };
}

async function tagsCloud(admin: Admin, rangeDays: number, limit: number) {
  const from = daysAgo(rangeDays);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: joins } = await (admin as any)
    .from("atendimento_conversation_labels")
    .select("label_id, conversation:conversation_id(created_at)")
    .gte("conversation.created_at", from);
  const count = new Map<string, number>();
  for (const j of (joins as Array<{
    label_id: string;
    conversation: { created_at: string } | null;
  }> | null) ?? []) {
    if (!j.conversation) continue;
    count.set(j.label_id, (count.get(j.label_id) ?? 0) + 1);
  }
  if (count.size === 0) return { tags: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: labels } = await (admin as any)
    .from("atendimento_labels")
    .select("id, name, color_hex")
    .in("id", Array.from(count.keys()));
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const byId = new Map<string, { name: string; color: string | null }>();
  for (const l of (labels as Array<{
    id: string;
    name: string;
    color_hex: string | null;
  }> | null) ?? []) {
    byId.set(l.id, { name: l.name, color: l.color_hex });
  }

  return {
    tags: top.map(([id, n]) => ({
      id,
      name: byId.get(id)?.name ?? id.slice(0, 8),
      color: byId.get(id)?.color ?? "#94a3b8",
      count: n,
    })),
  };
}

async function replyTimeHeatmap(admin: Admin, rangeDays: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_reply_time_heatmap", {
    range_days: rangeDays,
  });
  if (error) throw new Error(error.message);
  return { cells: data ?? [] };
}

async function conversationFunnel(admin: Admin, rangeDays: number) {
  const today = new Date();
  const from = new Date(today.getTime() - (rangeDays - 1) * 86400000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_conversation_funnel", {
    range_start: from.toISOString().slice(0, 10),
    range_end: today.toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return { stages: data ?? [] };
}

async function channelPerformance(admin: Admin, rangeDays: number) {
  const from = daysAgo(rangeDays);
  const to = new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snaps } = await (admin as any)
    .from("metrics_snapshots")
    .select("volume_by_inbox, avg_first_response_sec, avg_resolution_sec")
    .gte("day", from)
    .lte("day", to);
  const totalsByInbox = new Map<string, number>();
  let sumAvgFirst = 0,
    nAvgFirst = 0;
  let sumAvgRes = 0,
    nAvgRes = 0;
  for (const s of (snaps as Array<{
    volume_by_inbox: Record<string, number> | null;
    avg_first_response_sec: number | null;
    avg_resolution_sec: number | null;
  }> | null) ?? []) {
    for (const [inboxId, n] of Object.entries(s.volume_by_inbox ?? {})) {
      totalsByInbox.set(inboxId, (totalsByInbox.get(inboxId) ?? 0) + n);
    }
    if (s.avg_first_response_sec !== null) {
      sumAvgFirst += s.avg_first_response_sec;
      nAvgFirst += 1;
    }
    if (s.avg_resolution_sec !== null) {
      sumAvgRes += s.avg_resolution_sec;
      nAvgRes += 1;
    }
  }

  const inboxIds = Array.from(totalsByInbox.keys());
  if (inboxIds.length === 0) return { channels: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inboxes } = await (admin as any)
    .from("atendimento_inboxes")
    .select("id, name, channel_type")
    .in("id", inboxIds);
  const meta = new Map<string, { name: string; channel: string }>();
  for (const i of (inboxes as Array<{
    id: string;
    name: string;
    channel_type: string;
  }> | null) ?? []) {
    meta.set(i.id, { name: i.name, channel: i.channel_type });
  }

  const avgFirst = nAvgFirst ? Math.round(sumAvgFirst / nAvgFirst) : null;
  const avgRes = nAvgRes ? Math.round(sumAvgRes / nAvgRes) : null;

  return {
    avg_first_response_sec: avgFirst,
    avg_resolution_sec: avgRes,
    channels: [...totalsByInbox.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({
        id,
        name: meta.get(id)?.name ?? "Canal",
        channel: meta.get(id)?.channel ?? "—",
        volume: n,
      })),
  };
}

async function kanbanPipelineMini(admin: Admin) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pipelines } = await (admin as any)
    .from("pipelines")
    .select("id, name, is_pinned, sort_order")
    .order("is_pinned", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1);
  const pipeline = (
    (pipelines ?? []) as Array<{
      id: string;
      name: string;
    }>
  )[0];
  if (!pipeline) return { pipeline: null, stages: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stages } = await (admin as any)
    .from("pipeline_stages")
    .select("id, name, color_hex, is_won, is_lost, sort_order")
    .eq("pipeline_id", pipeline.id)
    .order("sort_order", { ascending: true });
  const stageRows = (stages ?? []) as Array<{
    id: string;
    name: string;
    color_hex: string | null;
    is_won: boolean;
    is_lost: boolean;
  }>;
  if (stageRows.length === 0)
    return { pipeline: { id: pipeline.id, name: pipeline.name }, stages: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deals } = await (admin as any)
    .from("deals")
    .select("stage_id, value_cents, won_at, lost_at")
    .in(
      "stage_id",
      stageRows.map((s) => s.id),
    );
  const agg = new Map<string, { count: number; value: number }>();
  for (const d of (deals as Array<{
    stage_id: string;
    value_cents: number | null;
    won_at: string | null;
    lost_at: string | null;
  }> | null) ?? []) {
    if (d.won_at || d.lost_at) continue; // só em aberto
    const cur = agg.get(d.stage_id) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += d.value_cents ?? 0;
    agg.set(d.stage_id, cur);
  }

  return {
    pipeline: { id: pipeline.id, name: pipeline.name },
    stages: stageRows.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color_hex,
      is_won: s.is_won,
      is_lost: s.is_lost,
      ...(agg.get(s.id) ?? { count: 0, value: 0 }),
    })),
  };
}

async function aiAssistantStatus(admin: Admin) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("ds_agents")
    .select("id, name, enabled, config, last_run_at");
  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    enabled: boolean;
    config: {
      model?: string;
      temperature?: number;
      system_prompt?: string;
    } | null;
    last_run_at: string | null;
  }>;

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return { agents: [] };

  const since = new Date();
  since.setUTCHours(since.getUTCHours() - 24);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: execs } = await (admin as any)
    .from("ds_agent_executions")
    .select("agent_id, status")
    .in("agent_id", ids)
    .gte("created_at", since.toISOString());
  const stats = new Map<string, { runs: number; errors: number }>();
  for (const e of (execs as Array<{
    agent_id: string;
    status: string;
  }> | null) ?? []) {
    const cur = stats.get(e.agent_id) ?? { runs: 0, errors: 0 };
    cur.runs += 1;
    if (e.status === "error" || e.status === "failed") cur.errors += 1;
    stats.set(e.agent_id, cur);
  }

  return {
    agents: rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      model: r.config?.model ?? null,
      temperature: r.config?.temperature ?? null,
      last_run_at: r.last_run_at,
      runs_24h: stats.get(r.id)?.runs ?? 0,
      errors_24h: stats.get(r.id)?.errors ?? 0,
    })),
  };
}
