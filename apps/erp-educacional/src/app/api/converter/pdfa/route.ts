/**
 * API Route: Conversão de documentos para PDF/A
 *
 * POST /api/converter/pdfa
 *
 * Recebe um arquivo (multipart/form-data) e o converte para PDF/A
 * chamando o microserviço DocumentConverter.
 *
 * Uso: server-side — chamada a partir do wizard de diploma.
 * Retorna o PDF/A em Base64 para ser embutido no XML.
 */

import { protegerRota } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import {
  convertDocumentToPdfA,
  checkConverterHealth,
} from "@/lib/document-converter/client";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Tipos suportados
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
];

export const POST = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          {
            error:
              'Nenhum arquivo enviado. Use o campo "file" em multipart/form-data.',
          },
          { status: 400 },
        );
      }

      if (!ALLOWED_MIMETYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Tipo de arquivo não suportado: ${file.type}`,
            supported: ALLOWED_MIMETYPES,
          },
          { status: 415 },
        );
      }

      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Arquivo muito grande. Limite: 20MB." },
          { status: 413 },
        );
      }

      // Verificar se o microserviço está disponível
      const isHealthy = await checkConverterHealth();
      if (!isHealthy) {
        return NextResponse.json(
          {
            error: "Serviço de conversão temporariamente indisponível.",
            detail:
              "O microserviço DocumentConverter não respondeu ao health check. Verifique se está rodando.",
          },
          { status: 503 },
        );
      }

      // Converter arquivo para Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Chamar o microserviço
      const result = await convertDocumentToPdfA(buffer, file.name, file.type);

      if (!result.success) {
        return NextResponse.json(
          { error: "Falha na conversão do documento." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        pdfaBase64: result.pdfaBase64,
        validation: result.validation,
        metadata: result.metadata,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[/api/converter/pdfa] Erro:", message);

      return NextResponse.json(
        {
          erro: sanitizarErro("Erro interno ao converter o documento.", 500),
          detail: message,
        },
        { status: 500 },
      );
    }
  },
);

// Health check da rota (verifica se o microserviço está acessível)
export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const isHealthy = await checkConverterHealth();
    return NextResponse.json({
      route: "/api/converter/pdfa",
      converterAvailable: isHealthy,
      converterUrl: process.env.DOCUMENT_CONVERTER_URL || "não configurada",
    });
  },
  { skipCSRF: true },
);
