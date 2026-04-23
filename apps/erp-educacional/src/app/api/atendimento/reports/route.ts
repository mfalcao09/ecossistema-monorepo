/**
 * GET /api/atendimento/reports  — lista + executa relatórios salvos
 * POST                          — cria nova definição de relatório
 *
 * Execução ad-hoc:
 *   GET /api/atendimento/reports?run=<report_type>&from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv
 *     report_type ∈ { volume, sla, funnel, agent_performance, lead_origin }
 *
 * Listagem:
 *   GET /api/atendimento/reports  → { ok, definitions: [...] }
 *
 * Criação (POST):
 *   body { name, description?, report_type, filters?, columns?, group_by?, date_range_days? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeRange,
  toCSV,
  REPORT_TYPES,
  type ReportType,
} from "@/lib/atendimento/dashboards";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  report_type: z.enum(REPORT_TYPES),
  filters: z.record(z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  group_by: z.string().max(32).optional(),
  date_range_days: z.number().int().min(1).max(365).optional(),
  is_favorite: z.boolean().optional(),
});

// ── Executores por tipo ───────────────────────────────────────────────────────
async function runVolume(
  admin: ReturnType<typeof createAdminClient>,
  from: string,
  to: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("metrics_snapshots")
    .select(
      "day, conversations_opened, conversations_closed, messages_in, messages_out, templates_sent",
    )
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function runSLA(
  admin: ReturnType<typeof createAdminClient>,
  from: string,
  to: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("metrics_snapshots")
    .select(
      "day, avg_first_response_sec, p50_first_response_sec, p90_first_response_sec, avg_resolution_sec, p50_resolution_sec, p90_resolution_sec",
    )
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function runFunnel(
  admin: ReturnType<typeof createAdminClient>,
  from: string,
  to: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_conversation_funnel", {
    range_start: from,
    range_end: to,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function runLeadOrigin(
  admin: ReturnType<typeof createAdminClient>,
  from: string,
  to: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc(
    "get_lead_origin_breakdown",
    {
      range_start: from,
      range_end: to,
    },
  );
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function runAgentPerformance(
  admin: ReturnType<typeof createAdminClient>,
  from: string,
  to: string,
) {
  // Agrupa mensagens de saída por sender_id no range — evita depender de tabela
  // de agentes que pode estar vazia no bootstrap.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("atendimento_messages")
    .select("sender_id, message_type, conversation_id, created_at")
    .gte("created_at", from)
    .lt("created_at", addOneDay(to))
    .in("message_type", ["outgoing", "template"])
    .eq("sender_type", "agent");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    sender_id: string | null;
    conversation_id: string | null;
  }>;
  const perAgent = new Map<
    string,
    { agent_id: string; messages: number; conversations: Set<string> }
  >();
  for (const r of rows) {
    if (!r.sender_id) continue;
    let entry = perAgent.get(r.sender_id);
    if (!entry) {
      entry = {
        agent_id: r.sender_id,
        messages: 0,
        conversations: new Set(),
      };
      perAgent.set(r.sender_id, entry);
    }
    entry.messages += 1;
    if (r.conversation_id) entry.conversations.add(r.conversation_id);
  }

  return Array.from(perAgent.values())
    .map((e) => ({
      agent_id: e.agent_id,
      messages: e.messages,
      conversations: e.conversations.size,
    }))
    .sort((a, b) => b.messages - a.messages);
}

function addOneDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

// ── Handlers ──────────────────────────────────────────────────────────────────
export const GET = protegerRota(async (request: NextRequest) => {
  const url = new URL(request.url);
  const admin = createAdminClient();
  const run = url.searchParams.get("run") as ReportType | null;

  if (run && (REPORT_TYPES as readonly string[]).includes(run)) {
    const { from, to } = normalizeRange(
      url.searchParams.get("from"),
      url.searchParams.get("to"),
      30,
    );
    const format = url.searchParams.get("format") ?? "json";

    let rows: Array<Record<string, unknown>>;
    try {
      switch (run) {
        case "volume":
          rows = await runVolume(admin, from, to);
          break;
        case "sla":
          rows = await runSLA(admin, from, to);
          break;
        case "funnel":
          rows = await runFunnel(admin, from, to);
          break;
        case "lead_origin":
          rows = await runLeadOrigin(admin, from, to);
          break;
        case "agent_performance":
          rows = await runAgentPerformance(admin, from, to);
          break;
        case "custom":
        default:
          rows = [];
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    if (format === "csv") {
      const csv = toCSV(rows);
      const fname = `relatorio_${run}_${from}_${to}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      report_type: run,
      range: { from, to },
      rows,
    });
  }

  // Sem `run`: lista definições salvas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("report_definitions")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, definitions: data ?? [] });
});

export const POST = protegerRota(
  async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "payload_invalido",
          detalhes: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("report_definitions")
      .insert({
        owner_id: userId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        report_type: parsed.data.report_type,
        filters: parsed.data.filters ?? {},
        columns: parsed.data.columns ?? [],
        group_by: parsed.data.group_by ?? null,
        date_range_days: parsed.data.date_range_days ?? 30,
        is_favorite: parsed.data.is_favorite ?? false,
      })
      .select("*")
      .single();
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, definition: data });
  },
  { skipCSRF: true },
);
