/**
 * Integration test — trigger de histórico em deals (S4).
 *
 * Skipado por default. Para rodar:
 *   E2E=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm test
 *
 * Valida que um PATCH em deals.stage_id gera um evento
 * `stage_transfer` em deal_history_events (pelo trigger).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const RUN = process.env.E2E === "1";
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const maybe = RUN && url && key ? describe : describe.skip;

maybe("S4 · trigger atnd_s4_log_deal_history", () => {
  const supabase = createClient(url, key);
  let pipelineId: string;
  let stages: Array<{ id: string; name: string }> = [];
  let dealId: string;

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("pipelines")
      .select("id, pipeline_stages(id, name)")
      .eq("key", "ATND")
      .single();
    pipelineId = data!.id;
    stages     = data!.pipeline_stages;
  });

  afterAll(async () => {
    if (dealId) await supabase.from("deals").delete().eq("id", dealId);
  });

  it("stage_transfer é gravado quando PATCH muda stage_id", async () => {
    const [from, to] = stages;
    const { data: deal } = await supabase
      .from("deals")
      .insert({ pipeline_id: pipelineId, stage_id: from.id, title: "[test] S4" })
      .select("id")
      .single();
    dealId = deal!.id;

    const { error: errUpd } = await supabase
      .from("deals").update({ stage_id: to.id }).eq("id", dealId);
    expect(errUpd).toBeNull();

    const { data: events } = await supabase
      .from("deal_history_events")
      .select("event_type, payload")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true });

    expect(events).toBeTruthy();
    const types = (events ?? []).map((e) => e.event_type);
    expect(types).toContain("deal_created");
    expect(types).toContain("stage_transfer");

    const transfer = (events ?? []).find((e) => e.event_type === "stage_transfer");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((transfer?.payload as any)?.from).toBe(from.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((transfer?.payload as any)?.to).toBe(to.id);
  });
});
