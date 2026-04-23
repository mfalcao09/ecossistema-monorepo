/**
 * POST /api/atendimento/ds-bots/[id]/execute — executa o bot em modo playground.
 *   Body: { action: "start" | "input", execution_id?, input?, initial_variables? }
 *
 * No playground o `conversation_id`/`contact_id` ficam null; os side-effects são
 * devolvidos como JSON para o chat mock renderizar (sem chamar Meta API).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDsBotEnabled } from "@/lib/atendimento/feature-flags";
import {
  startExecution,
  resumeExecution,
} from "@/lib/atendimento/ds-bot-runner";
import type { DsBotFlow } from "@/lib/atendimento/ds-bot-types";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    initial_variables: z.record(z.any()).optional(),
    channel: z.string().default("playground"),
  }),
  z.object({
    action: z.literal("input"),
    execution_id: z.string().uuid(),
    input: z.string(),
  }),
]);

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDsBotEnabled())
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );

  const admin = createAdminClient();

  if (parsed.data.action === "start") {
    const { data: bot, error } = await admin
      .from("ds_bots")
      .select("id, flow_json, start_node_id, version")
      .eq("id", id)
      .maybeSingle();
    if (error || !bot)
      return NextResponse.json({ error: "not_found" }, { status: 404 });

    const result = await startExecution(
      {
        bot: {
          id: bot.id,
          flow: bot.flow_json as DsBotFlow,
          start_node_id: bot.start_node_id,
          version: bot.version ?? 1,
        },
        conversation_id: null,
        contact_id: null,
        channel: parsed.data.channel,
        initial_variables: parsed.data.initial_variables,
      },
      admin,
    );
    return NextResponse.json(result);
  }

  const result = await resumeExecution(
    parsed.data.execution_id,
    parsed.data.input,
    admin,
  );
  return NextResponse.json(result);
}
