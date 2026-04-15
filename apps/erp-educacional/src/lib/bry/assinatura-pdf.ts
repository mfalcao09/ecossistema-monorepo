// ─────────────────────────────────────────────────────────────────────────────
// BRy Assinatura Digital — HUB Signer para PDFs
//
// Produto: API Assinatura Digital da BRy (distinto da API Diploma Digital).
// Usado para assinar Histórico Escolar, Termo de Expedição e Termo de
// Responsabilidade em formato PDF.
//
// Fluxo (assíncrono):
//   1. submitDocumento()  → envia PDF + lista de signatários → retorna documentoId
//   2. BRy notifica os signatários por e-mail/app BRy
//   3. Cada signatário assina no portal BRy
//   4. BRy chama o webhook configurado → /api/webhooks/bry-assinatura-pdf
//   5. Webhook baixa o PDF assinado e atualiza diploma_documentos_complementares
//
// Configuração de ambiente:
//   BRY_CLIENT_ID              — mesmo da API Diploma Digital (credenciais compartilhadas)
//   BRY_CLIENT_SECRET          — idem
//   BRY_ASSINATURA_PDF_BASE_URL — URL base do HUB Signer (ex: https://assinatura.bry.com.br)
//   BRY_ASSINATURA_PDF_WEBHOOK_URL — URL pública do webhook (ex: https://gestao.fic.edu.br/api/webhooks/bry-assinatura-pdf)
//
// Nota: O token OAuth2 usa as mesmas credenciais (BRY_CLIENT_ID / BRY_CLIENT_SECRET)
// mas o token_url pode diferir — se BRY_TIMESTAMP_TOKEN_URL estiver configurado,
// getTimestampToken() o usa (mesmo servidor da assinatura-digital).
// ─────────────────────────────────────────────────────────────────────────────

import type { BryConfig } from "./config";
import { getBryToken } from "./auth";

// ── Configuração extra (assinatura PDF) ────────────────────────────────────

/** Retorna a URL base do HUB Signer de assinatura de PDF */
export function getAssinaturaPdfBaseUrl(): string {
  const url = process.env.BRY_ASSINATURA_PDF_BASE_URL?.trim();
  if (!url) {
    // Fallback razoável — ajustar conforme contrato BRy
    const isHom = (process.env.BRY_AMBIENTE ?? "homologacao") === "homologacao";
    return isHom
      ? "https://hub-hom.bry.com.br/api/sign-service/v2"
      : "https://hub.bry.com.br/api/sign-service/v2";
  }
  return url;
}

/** URL pública do webhook que a BRy vai chamar após assinatura */
export function getWebhookUrl(): string {
  const base = (
    process.env.BRY_ASSINATURA_PDF_WEBHOOK_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).replace(/\/$/, "");
  return `${base}/api/webhooks/bry-assinatura-pdf`;
}

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface SignatarioPdf {
  /** Nome completo do signatário */
  nome: string;
  /** CPF (somente dígitos, ex: "12345678900") */
  cpf: string;
  /** E-mail — BRy envia o link de assinatura para cá */
  email: string;
  /** Cargo/papel visível no documento assinado */
  cargo: string;
}

export interface SubmitDocumentoParams {
  /** Buffer do PDF a ser assinado */
  pdfBytes: Uint8Array;
  /** Nome do arquivo (ex: "historico_escolar.pdf") */
  nomeArquivo: string;
  /** Título do documento exibido para os signatários */
  titulo: string;
  /** Lista de signatários em ordem de assinatura */
  signatarios: SignatarioPdf[];
  /** ID externo para correlação no webhook (ex: diploma_id + tipo) */
  externalId: string;
}

export interface SubmitDocumentoResult {
  /** ID do documento no BRy — salvar em diploma_documentos_complementares.bry_document_id */
  documentoId: string;
  /** URL do portal BRy para acompanhar o documento (opcional) */
  portalUrl?: string | null;
}

export type StatusDocumentoBry =
  | "PENDENTE"       // Aguardando assinatura
  | "EM_ANDAMENTO"   // Ao menos 1 signatário já assinou
  | "CONCLUIDO"      // Todos assinaram
  | "CANCELADO"      // Cancelado manualmente
  | "EXPIRADO";      // Prazo excedido

export interface DocumentoBryStatus {
  documentoId: string;
  status: StatusDocumentoBry;
  /** URL do PDF assinado (disponível quando status = CONCLUIDO) */
  pdfAssinadoUrl?: string | null;
  /** Progresso: quantos dos N signatários já assinaram */
  assinadoPor: number;
  total: number;
}

export interface BryWebhookPayload {
  /** ID do documento BRy */
  documentId: string;
  /** Status atual */
  status: StatusDocumentoBry;
  /** ID externo enviado no submit (para correlação) */
  externalId?: string;
  /** URL do PDF assinado (presente quando CONCLUIDO) */
  signedDocumentUrl?: string;
  /** Timestamp ISO do evento */
  eventAt?: string;
  /** Metadados adicionais (payload completo) */
  [key: string]: unknown;
}

// ── Funções principais ─────────────────────────────────────────────────────

/**
 * Submete um PDF ao BRy HUB Signer para coleta de assinaturas.
 *
 * Retorna o `documentoId` que deve ser salvo em
 * `diploma_documentos_complementares.bry_document_id`.
 */
export async function submitDocumentoBry(
  config: BryConfig,
  params: SubmitDocumentoParams
): Promise<SubmitDocumentoResult> {
  const token = await getBryToken(config);
  const baseUrl = getAssinaturaPdfBaseUrl();
  const webhookUrl = getWebhookUrl();

  // Montar FormData conforme API BRy HUB Signer
  const form = new FormData();

  // Arquivo PDF
  const pdfBlob = new Blob([params.pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  form.append("file", pdfBlob, params.nomeArquivo);

  // Metadados do documento
  form.append("title", params.titulo);
  form.append("externalId", params.externalId);
  form.append("webhookUrl", webhookUrl);

  // Signatários: nome, cpf, email, cargo (em ordem)
  params.signatarios.forEach((s, i) => {
    form.append(`signers[${i}][name]`, s.nome);
    form.append(`signers[${i}][cpf]`, s.cpf.replace(/\D/g, ""));
    form.append(`signers[${i}][email]`, s.email);
    form.append(`signers[${i}][role]`, s.cargo);
    form.append(`signers[${i}][order]`, String(i + 1));
    // Tipo de assinatura: ELECTRONIC ou DIGITAL (ICP-Brasil)
    // Por padrão usamos assinatura eletrônica simples para PDFs complementares.
    // Para assinatura digital ICP-Brasil, usar "DIGITAL" e exigir certificado A3.
    form.append(`signers[${i}][signatureType]`, "ELECTRONIC");
  });

  const response = await fetch(`${baseUrl}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `BRy submitDocumento falhou (${response.status}): ${text.slice(0, 800)}`
    );
  }

  const data = await response.json() as {
    id?: string;
    documentId?: string;
    portalUrl?: string;
  };

  const documentoId = data.id ?? data.documentId;
  if (!documentoId) {
    throw new Error(`BRy submitDocumento: resposta sem ID — ${JSON.stringify(data).slice(0, 300)}`);
  }

  return {
    documentoId,
    portalUrl: data.portalUrl ?? null,
  };
}

/**
 * Consulta o status atual de um documento no BRy.
 * Útil para polling quando o webhook não chegar.
 */
export async function consultarStatusDocumentoBry(
  config: BryConfig,
  documentoId: string
): Promise<DocumentoBryStatus> {
  const token = await getBryToken(config);
  const baseUrl = getAssinaturaPdfBaseUrl();

  const response = await fetch(`${baseUrl}/documents/${documentoId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `BRy consultarStatus falhou (${response.status}): ${text.slice(0, 500)}`
    );
  }

  const data = await response.json() as {
    id?: string;
    documentId?: string;
    status?: string;
    signedDocumentUrl?: string;
    signedCount?: number;
    totalSigners?: number;
    signers?: Array<{ signed: boolean }>;
  };

  const id = (data.id ?? data.documentId ?? documentoId);
  const status = normalizarStatus(data.status ?? "PENDENTE");
  const assinadoPor = data.signedCount ?? data.signers?.filter(s => s.signed).length ?? 0;
  const total = data.totalSigners ?? data.signers?.length ?? 0;

  return {
    documentoId: id,
    status,
    pdfAssinadoUrl: data.signedDocumentUrl ?? null,
    assinadoPor,
    total,
  };
}

/**
 * Cancela um documento pendente de assinatura no BRy.
 */
export async function cancelarDocumentoBry(
  config: BryConfig,
  documentoId: string
): Promise<void> {
  const token = await getBryToken(config);
  const baseUrl = getAssinaturaPdfBaseUrl();

  const response = await fetch(`${baseUrl}/documents/${documentoId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: "Cancelado pelo sistema FIC" }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(
      `BRy cancelarDocumento falhou (${response.status}): ${text.slice(0, 400)}`
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizarStatus(raw: string): StatusDocumentoBry {
  const upper = raw.toUpperCase().replace(/-/g, "_");
  const mapa: Record<string, StatusDocumentoBry> = {
    PENDENTE: "PENDENTE",
    PENDING: "PENDENTE",
    EM_ANDAMENTO: "EM_ANDAMENTO",
    IN_PROGRESS: "EM_ANDAMENTO",
    CONCLUIDO: "CONCLUIDO",
    COMPLETED: "CONCLUIDO",
    SIGNED: "CONCLUIDO",
    FINISHED: "CONCLUIDO",
    CANCELADO: "CANCELADO",
    CANCELED: "CANCELADO",
    CANCELLED: "CANCELADO",
    EXPIRADO: "EXPIRADO",
    EXPIRED: "EXPIRADO",
  };
  return mapa[upper] ?? "PENDENTE";
}
