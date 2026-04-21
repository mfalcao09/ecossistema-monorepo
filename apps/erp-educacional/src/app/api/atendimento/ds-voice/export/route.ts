/**
 * GET /api/atendimento/ds-voice/export
 *
 * Dump completo da biblioteca em JSON. Campos de storage (storage_path, file_url)
 * são preservados: importador em outra instância precisa re-uploadar arquivos
 * (ver /import).
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

export const GET = withPermission(
  "ds_voice",
  "view",
)(async (_req: NextRequest, ctx) => {
  const [
    { data: folders },
    { data: messages },
    { data: audios },
    { data: media },
    { data: documents },
    { data: funnels },
    { data: funnel_steps },
    { data: triggers },
  ] = await Promise.all([
    ctx.supabase.from("ds_voice_folders").select("*"),
    ctx.supabase.from("ds_voice_messages").select("*"),
    ctx.supabase.from("ds_voice_audios").select("*"),
    ctx.supabase.from("ds_voice_media").select("*"),
    ctx.supabase.from("ds_voice_documents").select("*"),
    ctx.supabase.from("ds_voice_funnels").select("*"),
    ctx.supabase.from("ds_voice_funnel_steps").select("*"),
    ctx.supabase.from("ds_voice_triggers").select("*"),
  ]);

  const payload = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    folders: folders ?? [],
    messages: messages ?? [],
    audios: audios ?? [],
    media: media ?? [],
    documents: documents ?? [],
    funnels: funnels ?? [],
    funnel_steps: funnel_steps ?? [],
    triggers: triggers ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ds-voice-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
