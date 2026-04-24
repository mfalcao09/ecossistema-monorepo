import { protegerRota } from "@/lib/security/api-guard";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Usa o service role client para bypassar RLS no storage
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Converte 1ª página de um PDF em PNG via pdfjs-dist (server-side) ──
async function convertPdfToPng(
  pdfBytes: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    // pdfjs-dist funciona em Node.js sem DOM — usa CanvasFactory customizado
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Desabilita worker no server (não precisa)
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    const pdf = await pdfjsLib.getDocument({
      data: pdfBytes,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;

    const page = await pdf.getPage(1);

    // Escala 2x para boa qualidade sem estourar memória
    const scale = 2;
    const viewport = page.getViewport({ scale });

    // Cria canvas off-screen via OffscreenCanvas (Node 18+)
    // Se não disponível, tentamos com createImageBitmap approach
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    // Usar canvas nativo do Node se disponível, senão retorna null
    // Na Vercel (Node 18+), OffscreenCanvas está disponível
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Falha ao criar contexto 2D");

      await page.render({
        canvasContext: ctx,
        viewport,
      } as any).promise;

      const blob = await canvas.convertToBlob({ type: "image/png" });
      const arrayBuffer = await blob.arrayBuffer();
      console.log(
        "[diploma-upload] PDF convertido para PNG:",
        Math.round(arrayBuffer.byteLength / 1024),
        "KB",
      );
      return new Uint8Array(arrayBuffer);
    }

    console.warn(
      "[diploma-upload] OffscreenCanvas não disponível — PDF não convertido",
    );
    return null;
  } catch (err) {
    console.error("[diploma-upload] Erro ao converter PDF→PNG:", err);
    return null;
  }
}

// POST — faz upload de arquivo para o Storage (timbrado, referência, etc.)
// Se o arquivo for PDF e o tipo for timbrado-historico, converte para PNG automaticamente.
// Retorna a URL pública. O frontend salva via PATCH /api/config/diploma
export const POST = protegerRota(
  async (request, { userId }) => {
    const admin = getAdminClient();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tipo = formData.get("tipo") as string | null;

    if (!file || !tipo) {
      return NextResponse.json(
        { error: "Arquivo e tipo são obrigatórios" },
        { status: 400 },
      );
    }

    const tiposValidos = ["timbrado-historico", "referencia-rvdd"];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    // Converte File → ArrayBuffer → Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    let buffer = new Uint8Array(arrayBuffer);
    let contentType = file.type;
    let finalExt = file.name.split(".").pop() || "png";
    let convertedFromPdf = false;

    // ── Se é PDF de timbrado, tenta converter para PNG no servidor ──
    if (tipo === "timbrado-historico" && file.type === "application/pdf") {
      console.log(
        "[diploma-upload] Timbrado PDF detectado, tentando converter para PNG...",
      );
      const pngBuffer = await convertPdfToPng(buffer);
      if (pngBuffer) {
        buffer = pngBuffer as Uint8Array<ArrayBuffer>;
        contentType = "image/png";
        finalExt = "png";
        convertedFromPdf = true;
        console.log("[diploma-upload] PDF convertido com sucesso para PNG");
      } else {
        // Se a conversão falhar, ainda aceita o PDF original
        console.warn(
          "[diploma-upload] Conversão PDF→PNG falhou, salvando PDF original",
        );
      }
    }

    // Define nome do arquivo baseado no tipo
    const filename = `${tipo}-${Date.now()}.${finalExt}`;
    const path = `diploma-config/${filename}`;

    // Upload para o Supabase Storage (via service role — bypassa RLS)
    const { error: uploadError } = await admin.storage
      .from("system-assets")
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[diploma-upload] Erro upload:", uploadError.message);
      return NextResponse.json(
        { erro: sanitizarErro(uploadError.message, 500) },
        { status: 500 },
      );
    }

    // Pega URL pública
    const { data: urlData } = admin.storage
      .from("system-assets")
      .getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      nome: file.name,
      convertido: convertedFromPdf,
      formato: finalExt,
    });
  },
  { skipCSRF: true },
);
