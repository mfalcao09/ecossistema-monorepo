import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Tipos de arquivo permitidos para referência visual
const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
];

const EXTENSOES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/msword": "doc",
};

const TAMANHO_MAX = 20 * 1024 * 1024; // 20MB

// POST /api/config/visual-template
// Body: FormData { file, ambiente }
export const POST = protegerRota(async (request: NextRequest) => {
  const supabase = await createClient();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const ambiente = (formData.get("ambiente") as string) ?? "homologacao";

  if (!file) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  // Validar tipo
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Aceito: PDF, DOCX, JPG, PNG, WebP." },
      { status: 400 },
    );
  }

  // Validar tamanho (máx 20MB)
  if (file.size > TAMANHO_MAX) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Máximo 20MB." },
      { status: 400 },
    );
  }

  // Montar caminho no Storage
  const ext = EXTENSOES[file.type] ?? "bin";
  const timestamp = Date.now();
  const path = `visual-templates/${ambiente}/${timestamp}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload no Supabase Storage (bucket system-assets)
  const { error: uploadError } = await supabase.storage
    .from("system-assets")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[visual-template] upload error:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Obter URL pública
  const {
    data: { publicUrl },
  } = supabase.storage.from("system-assets").getPublicUrl(path);

  // Salvar URL na diploma_config do ambiente correspondente
  const { data, error: dbError } = await supabase
    .from("diploma_config")
    .update({
      rvdd_arquivo_referencia_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("ambiente", ambiente)
    .select()
    .single();

  if (dbError) {
    console.error("[visual-template] db error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    url: publicUrl,
    config: data,
  });
});

// DELETE /api/config/visual-template?ambiente=homologacao|producao
// Remove o arquivo de referência visual
export const DELETE = protegerRota(async (request: NextRequest) => {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const ambiente = searchParams.get("ambiente") ?? "homologacao";

  // Buscar URL atual para deletar do storage
  const { data: configData } = await supabase
    .from("diploma_config")
    .select("rvdd_arquivo_referencia_url")
    .eq("ambiente", ambiente)
    .single();

  if (configData?.rvdd_arquivo_referencia_url) {
    // Extrair path relativo da URL pública
    const url = configData.rvdd_arquivo_referencia_url;
    const bucketPath = url.split("/system-assets/")[1];
    if (bucketPath) {
      await supabase.storage.from("system-assets").remove([bucketPath]);
    }
  }

  // Limpar da config
  const { data, error: dbError } = await supabase
    .from("diploma_config")
    .update({
      rvdd_arquivo_referencia_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("ambiente", ambiente)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ config: data });
});
