/**
 * POST /api/atendimento/ds-voice/upload
 *
 * Sobe arquivo pro Supabase Storage (bucket "atendimento", prefixo "ds-voice/")
 * e retorna { storage_path, file_url } para o cliente salvar no item correspondente.
 *
 * Body: multipart/form-data
 *   - file:   File (obrigatório)
 *   - kind:   "audio" | "image" | "video" | "document" (para limit + content-type)
 *
 * Resposta: { storage_path, file_url, size, mime_type, duration? }
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import {
  STORAGE_BUCKET,
  UPLOAD_LIMITS,
} from "@/lib/atendimento/ds-voice-schemas";
import { createAdminClient } from "@/lib/supabase/admin";

// Fluid Compute default (Node.js). maxDuration amplo para uploads grandes.
export const maxDuration = 60;

const VALID_KINDS = ["audio", "image", "video", "document"] as const;
type Kind = (typeof VALID_KINDS)[number];

export const POST = withPermission(
  "ds_voice",
  "create",
)(async (req: NextRequest, _ctx) => {
  const form = await req.formData().catch(() => null);
  if (!form)
    return NextResponse.json({ erro: "multipart inválido" }, { status: 400 });

  const file = form.get("file");
  const kind = form.get("kind") as string | null;

  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "arquivo ausente" }, { status: 400 });
  }
  if (!kind || !VALID_KINDS.includes(kind as Kind)) {
    return NextResponse.json(
      { erro: "kind inválido (audio|image|video|document)" },
      { status: 400 },
    );
  }

  const limit = UPLOAD_LIMITS[kind as Kind];
  if (file.size > limit) {
    return NextResponse.json(
      { erro: `arquivo excede limite ${Math.round(limit / 1024 / 1024)}MB` },
      { status: 413 },
    );
  }

  // Gera path estável: ds-voice/<kind>/<yyyymm>/<uuid>.<ext>
  const uuid = crypto.randomUUID();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const path = `ds-voice/${kind}/${yyyymm}/${uuid}.${ext}`;

  const admin = createAdminClient();
  const buffer = await file.arrayBuffer();

  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "31536000",
      upsert: false,
    });

  if (upErr) {
    console.error("[ds-voice/upload] upload failed", upErr);
    return NextResponse.json({ erro: upErr.message }, { status: 500 });
  }

  const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  return NextResponse.json({
    storage_path: path,
    file_url: pub.publicUrl,
    size: file.size,
    mime_type: file.type || null,
    filename: file.name,
  });
});
