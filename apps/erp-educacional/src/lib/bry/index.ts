// ─────────────────────────────────────────────────────────────────────────────
// BRy Diploma Digital — Barrel Export
// ─────────────────────────────────────────────────────────────────────────────

export { getBryConfig, getExtraTimestampUrl } from "./config";
export type { BryConfig } from "./config";

export { getBryToken, invalidarCacheToken, getTimestampToken, invalidarCacheTimestampToken } from "./auth";

export { bryInitialize, bryFinalize } from "./signature-service";

export {
  bryTimestampByContent,
  bryTimestampByHash,
  aplicarCarimboDoTempo,
} from "./timestamp-service";

export { aplicarCarimboXmlInterno, verificarEAvancarPacote } from "./carimbo-pipeline";
export type { ResultadoCarimboInterno } from "./carimbo-pipeline";

export { getPassosAssinatura, getPassosAssinaturaDinamicos } from "./passos-assinatura";
export type { AssinanteBanco } from "./passos-assinatura";

export {
  getAssinaturaPdfBaseUrl,
  getWebhookUrl,
  submitDocumentoBry,
  consultarStatusDocumentoBry,
  cancelarDocumentoBry,
} from "./assinatura-pdf";
export type {
  SignatarioPdf,
  SubmitDocumentoParams,
  SubmitDocumentoResult,
  DocumentoBryStatus,
  StatusDocumentoBry,
  BryWebhookPayload,
} from "./assinatura-pdf";

export type {
  TipoAssinanteBry,
  TipoDocumentoBry,
  PerfilAssinatura,
  BryInitializeParams,
  BryInitializeResponse,
  BryFinalizeParams,
  BryFinalizeResponse,
  BryExtensionSignInput,
  BryExtensionSignOutput,
  PassoAssinatura,
  TimestampFormat,
  BryTimestampParams,
  BryTimestampResponse,
} from "./types";
