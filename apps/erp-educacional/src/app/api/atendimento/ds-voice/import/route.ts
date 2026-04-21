/**
 * POST /api/atendimento/ds-voice/import
 *
 * Body: payload do /export (ou preview=true sem persistir).
 * Query: ?preview=1 → retorna resumo sem inserir
 *
 * Estratégia:
 *   - Mantém UUIDs originais (facilita re-runs idempotentes via upsert)
 *   - Upsert por id (messages/audios/media/documents/folders/funnels/triggers)
 *   - Arquivos de storage NÃO são copiados — precisam estar acessíveis pelas URLs do payload
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

interface ExportPayload {
  schema_version?: number;
  folders?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  audios?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  funnels?: Array<Record<string, unknown>>;
  funnel_steps?: Array<Record<string, unknown>>;
  triggers?: Array<Record<string, unknown>>;
}

export const POST = withPermission(
  "ds_voice",
  "create",
)(async (req: NextRequest, ctx) => {
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  const payload = (await req.json().catch(() => null)) as ExportPayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const summary = {
    folders: payload.folders?.length ?? 0,
    messages: payload.messages?.length ?? 0,
    audios: payload.audios?.length ?? 0,
    media: payload.media?.length ?? 0,
    documents: payload.documents?.length ?? 0,
    funnels: payload.funnels?.length ?? 0,
    funnel_steps: payload.funnel_steps?.length ?? 0,
    triggers: payload.triggers?.length ?? 0,
  };

  if (preview) {
    return NextResponse.json({ preview: true, summary });
  }

  // Insere em ordem (FKs): folders → itens → funnels → steps → triggers
  const errors: Record<string, string> = {};

  if (payload.folders?.length) {
    const { error } = await ctx.supabase
      .from("ds_voice_folders")
      .upsert(payload.folders, { onConflict: "id" });
    if (error) errors.folders = error.message;
  }

  const tables: Array<[keyof ExportPayload, string]> = [
    ["messages", "ds_voice_messages"],
    ["audios", "ds_voice_audios"],
    ["media", "ds_voice_media"],
    ["documents", "ds_voice_documents"],
    ["funnels", "ds_voice_funnels"],
  ];

  for (const [key, table] of tables) {
    const rows = (payload[key] as Array<Record<string, unknown>>) ?? [];
    if (rows.length === 0) continue;
    const { error } = await ctx.supabase
      .from(table)
      .upsert(rows, { onConflict: "id" });
    if (error) errors[String(key)] = error.message;
  }

  if (payload.funnel_steps?.length) {
    const { error } = await ctx.supabase
      .from("ds_voice_funnel_steps")
      .upsert(payload.funnel_steps, { onConflict: "id" });
    if (error) errors.funnel_steps = error.message;
  }

  if (payload.triggers?.length) {
    const { error } = await ctx.supabase
      .from("ds_voice_triggers")
      .upsert(payload.triggers, { onConflict: "id" });
    if (error) errors.triggers = error.message;
  }

  return NextResponse.json({
    imported: true,
    summary,
    errors: Object.keys(errors).length ? errors : undefined,
  });
});
