// ─────────────────────────────────────────────────────────────────────────────
// BRy Diploma Digital — Serviço de Assinatura (Initialize + Finalize)
//
// Implementa as chamadas HTTP reais à API BRy usando multipart/form-data,
// conforme documentado em docs/bry-api-referencia-tecnica.md.
//
// Fluxo:
//   1. initialize() → envia XML + certificado → retorna signedAttributes
//   2. (extensão BRy cifra signedAttributes no browser do usuário)
//   3. finalize() → envia signatureValue + initializedDocument → retorna XML assinado
// ─────────────────────────────────────────────────────────────────────────────

import type { BryConfig } from "./config";
import { getBryToken, invalidarCacheToken } from "./auth";
import type {
  BryInitializeParams,
  BryInitializeResponse,
  BryFinalizeParams,
  BryFinalizeResponse,
} from "./types";

const MEC_NAMESPACE =
  "https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd";

/**
 * Etapa 1: Inicializar assinatura.
 *
 * Envia o XML + chave pública para o BRy.
 * Retorna signedAttributes (hash para cifrar) e initializedDocuments (blob para finalize).
 */
export async function bryInitialize(
  config: BryConfig,
  params: BryInitializeParams
): Promise<BryInitializeResponse> {
  const token = await getBryToken(config);
  const url = `${config.signatureBaseUrl}/initialize`;

  // Montar FormData conforme docs BRy (multipart/form-data)
  const form = new FormData();
  form.append("nonce", params.nonce);
  form.append("signatureFormat", "ENVELOPED");
  form.append("hashAlgorithm", "SHA256");
  form.append("certificate", params.certificate);
  form.append("profile", params.profile);
  form.append("returnType", "BASE64");

  // Documento original
  form.append("originalDocuments[0][nonce]", params.nonce);

  // O XML é enviado como arquivo (Blob) com tipo application/xml
  const xmlBlob = new Blob([params.xmlContent], { type: "application/xml" });
  form.append("originalDocuments[0][content]", xmlBlob, "documento.xml");

  // Nodo específico (DadosDiploma, DadosRegistro, etc.)
  if (params.specificNodeName) {
    form.append(
      "originalDocuments[0][specificNode][name]",
      params.specificNodeName
    );
    form.append(
      "originalDocuments[0][specificNode][namespace]",
      params.specificNodeNamespace ?? MEC_NAMESPACE
    );
  }

  // includeXPathEnveloped (obrigatório do 2º passo em diante)
  if (params.includeXPathEnveloped === false) {
    form.append("includeXPathEnveloped", "false");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
    },
    body: form,
  });

  if (!response.ok) {
    // Se 401, invalidar cache e tentar uma vez mais
    if (response.status === 401) {
      invalidarCacheToken();
      return bryInitialize(config, params);
    }
    const text = await response.text();
    throw new Error(
      `BRy Initialize falhou (${response.status}): ${text.slice(0, 1000)}`
    );
  }

  return response.json() as Promise<BryInitializeResponse>;
}

/**
 * Etapa 3: Finalizar assinatura.
 *
 * Envia o signatureValue (cifrado pela extensão) + initializedDocument + certificado.
 * Retorna o XML assinado em Base64.
 */
export async function bryFinalize(
  config: BryConfig,
  params: BryFinalizeParams
): Promise<BryFinalizeResponse> {
  const token = await getBryToken(config);
  const url = `${config.signatureBaseUrl}/finalize`;

  const form = new FormData();
  form.append("nonce", params.nonce);
  form.append("signatureFormat", "ENVELOPED");
  form.append("hashAlgorithm", "SHA256");
  form.append("certificate", params.certificate);
  form.append("profile", params.profile);
  form.append("returnType", "BASE64");

  // Documento original (mesmo XML enviado no initialize)
  const xmlBlob = new Blob([params.xmlContent], { type: "application/xml" });
  form.append("finalizations[0][content]", xmlBlob, "documento.xml");

  // signatureValue = signedAttributes cifrado com chave privada pela extensão
  form.append("finalizations[0][signatureValue]", params.signatureValue);

  // initializedDocument = blob retornado pelo initialize
  form.append(
    "finalizations[0][initializedDocument]",
    params.initializedDocument
  );

  // includeXPathEnveloped (mesma config do initialize)
  if (params.includeXPathEnveloped === false) {
    form.append("includeXPathEnveloped", "false");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
    },
    body: form,
  });

  if (!response.ok) {
    if (response.status === 401) {
      invalidarCacheToken();
      return bryFinalize(config, params);
    }
    const text = await response.text();
    throw new Error(
      `BRy Finalize falhou (${response.status}): ${text.slice(0, 1000)}`
    );
  }

  return response.json() as Promise<BryFinalizeResponse>;
}
