/**
 * GET  /api/atendimento/ds-agentes/[id]/knowledge  — lista chunks do agente
 * POST /api/atendimento/ds-agentes/[id]/knowledge  — ingere texto ou arquivo
 *
 * POST body (JSON):
 *   { title: string, content: string, source_url?: string, metadata?: object }
 *
 * POST body (multipart/form-data):
 *   file: File (text/plain, application/pdf, .md, .docx — extração básica)
 *   title?: string
 *   source_url?: string
 *
 * Permissão: ds_ai / view | create
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { ingestKnowledge, listKnowledge } from "@/lib/atendimento/rag-client";

type RouteParams = { id: string };

export const GET = withPermission(
  "ds_ai",
  "view",
)(async (_req: NextRequest, ctx) => {
  const params =
    (await (ctx.params as Promise<RouteParams> | undefined)) ??
    ({ id: "" } as RouteParams);

  try {
    const chunks = await listKnowledge(params.id);
    return NextResponse.json({ chunks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
});

export const POST = withPermission(
  "ds_ai",
  "create",
)(async (req: NextRequest, ctx) => {
  const params =
    (await (ctx.params as Promise<RouteParams> | undefined)) ??
    ({ id: "" } as RouteParams);

  // Verifica que o agente existe
  const { data: agent, error: agentErr } = await ctx.supabase
    .from("ds_agents")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  if (agentErr || !agent) {
    return NextResponse.json(
      { erro: "Agente não encontrado" },
      { status: 404 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";

  // ── Multipart (upload de arquivo) ──────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title =
      (formData.get("title") as string | null)?.trim() ??
      file?.name ??
      "Documento";
    const sourceUrl =
      (formData.get("source_url") as string | null)?.trim() ?? null;

    if (!file) {
      return NextResponse.json(
        { erro: "Campo 'file' obrigatório" },
        { status: 400 },
      );
    }

    const fileType = file.type;
    let content = "";

    if (
      fileType === "text/plain" ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".txt")
    ) {
      content = await file.text();
    } else if (fileType === "application/pdf" || file.name.endsWith(".pdf")) {
      // Extração básica: converte PDF para text via Buffer
      // Para extração completa, usar pdfjs-dist (já está no package.json)
      const buffer = Buffer.from(await file.arrayBuffer());
      // Extração simples — texto bruto do PDF (sem OCR)
      content = extractTextFromPdfBuffer(buffer);
      if (!content.trim()) {
        return NextResponse.json(
          {
            erro: "Não foi possível extrair texto do PDF. Use um PDF com texto nativo (não escaneado).",
          },
          { status: 422 },
        );
      }
    } else {
      // Tenta ler como texto puro para outros formatos (.docx parcial, etc.)
      content = await file.text().catch(() => "");
      if (!content.trim()) {
        return NextResponse.json(
          {
            erro: `Tipo de arquivo não suportado: ${fileType}. Use .txt, .md ou .pdf.`,
          },
          { status: 422 },
        );
      }
    }

    try {
      const result = await ingestKnowledge(
        params.id,
        title,
        content,
        sourceUrl ?? undefined,
      );
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ erro: msg }, { status: 500 });
    }
  }

  // ── JSON body ─────────────────────────────────────────────────
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
    source_url?: string;
    metadata?: Record<string, unknown>;
  } | null;

  if (!body?.title?.trim() || !body?.content?.trim()) {
    return NextResponse.json(
      { erro: "'title' e 'content' são obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const result = await ingestKnowledge(
      params.id,
      body.title.trim(),
      body.content.trim(),
      body.source_url,
      body.metadata,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
});

// ──────────────────────────────────────────────────────────────
// Extração básica de texto de PDF (Buffer → string)
// Para conteúdo rico, substituir por pdfjs-dist em worker separado.
// ──────────────────────────────────────────────────────────────
function extractTextFromPdfBuffer(buffer: Buffer): string {
  // Estratégia simples: lê bytes procurando por streams de texto BT...ET do PDF
  // (funciona para PDFs não-criptografados com texto nativo)
  const str = buffer.toString("binary");
  const texts: string[] = [];
  const regex = /BT[\s\S]*?ET/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    // Extrai strings entre parênteses ou entre < >
    const block = match[0];
    const parenMatches = block.match(/\(([^)]*)\)/g) ?? [];
    for (const p of parenMatches) {
      const t = p.slice(1, -1).replace(/\\n/g, "\n").replace(/\\t/g, " ");
      if (t.trim()) texts.push(t);
    }
  }
  return texts.join(" ").trim();
}
