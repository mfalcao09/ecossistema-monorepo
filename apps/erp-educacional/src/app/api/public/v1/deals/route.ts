/**
 * GET  /api/public/v1/deals — lista (scope: deals:read)
 * POST /api/public/v1/deals — cria deal (scope: deals:write)
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPublicApiKey } from "@/lib/atendimento/public-api-auth";

export const GET = withPublicApiKey("deals:read", async (req: NextRequest, ctx) => {
  const params = req.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const pipelineId = params.get("pipeline_id");
  const stageId = params.get("stage_id");

  let q = ctx.supabase
    .from("deals")
    .select("id, title, pipeline_id, stage_id, contact_id, value_cents, currency, assignee_id, source, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (pipelineId) q = q.eq("pipeline_id", pipelineId);
  if (stageId) q = q.eq("stage_id", stageId);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0, limit, offset });
});

export const POST = withPublicApiKey("deals:write", async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    pipeline_id?: string;
    stage_id?: string;
    contact_id?: string;
    value_cents?: number;
    source?: string;
  } | null;

  if (!body?.title || !body.pipeline_id || !body.stage_id) {
    return NextResponse.json(
      { error: "bad_request", detail: "Fields 'title', 'pipeline_id', 'stage_id' required" },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("deals")
    .insert({
      title: body.title,
      pipeline_id: body.pipeline_id,
      stage_id: body.stage_id,
      contact_id: body.contact_id ?? null,
      value_cents: body.value_cents ?? null,
      currency: "BRL",
      source: body.source ?? "public_api",
    })
    .select("id, title, pipeline_id, stage_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ deal: data }, { status: 201 });
});
