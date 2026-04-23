/**
 * GET /api/atendimento/ds-voice/funnels/[id]/simulate?contact_name=João
 *
 * Renderiza o preview do funil sem enviar nada. Retorna lista de steps
 * expandidos com o conteúdo já resolvido (variáveis aplicadas).
 *
 * Uso: UI de construção de funis mostra "mock chat" com timing.
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { resolveVariables } from "@/lib/atendimento/variables";

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;
  const contactName = req.nextUrl.searchParams.get("contact_name") ?? "Contato";

  const { data: steps } = await ctx.supabase
    .from("ds_voice_funnel_steps")
    .select("id, sort_order, item_type, item_id, delay_seconds")
    .eq("funnel_id", id)
    .order("sort_order", { ascending: true });

  if (!steps?.length) {
    return NextResponse.json({ steps: [], total_seconds: 0 });
  }

  const ctxVars = { contact: { name: contactName } };
  const resolved: Array<Record<string, unknown>> = [];
  let offsetSeconds = 0;

  for (const s of steps) {
    offsetSeconds += s.delay_seconds;
    const table =
      s.item_type === "message"
        ? "ds_voice_messages"
        : s.item_type === "audio"
          ? "ds_voice_audios"
          : s.item_type === "media"
            ? "ds_voice_media"
            : "ds_voice_documents";

    const { data: item } = await ctx.supabase
      .from(table)
      .select("*")
      .eq("id", s.item_id)
      .maybeSingle();

    let renderedContent: string | null = null;
    if (item && s.item_type === "message") {
      renderedContent = resolveVariables(String(item.content ?? ""), ctxVars, {
        keepUnknown: false,
      });
    } else if (item && s.item_type === "media" && item.caption) {
      renderedContent = resolveVariables(String(item.caption), ctxVars, {
        keepUnknown: false,
      });
    }

    resolved.push({
      step_id: s.id,
      sort_order: s.sort_order,
      item_type: s.item_type,
      delay_seconds: s.delay_seconds,
      cumulative_seconds: offsetSeconds,
      item: item
        ? {
            id: item.id,
            title: item.title,
            file_url: item.file_url ?? null,
            mime_type: item.mime_type ?? null,
            rendered_content: renderedContent,
          }
        : null,
    });
  }

  return NextResponse.json({ steps: resolved, total_seconds: offsetSeconds });
});
