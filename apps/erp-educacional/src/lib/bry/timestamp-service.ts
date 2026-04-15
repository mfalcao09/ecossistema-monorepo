// ─────────────────────────────────────────────────────────────────────────────
// BRy Carimbo do Tempo — Serviço REST
//
// Integra com a API de carimbo-service da BRy para emissão de carimbos do
// tempo (timestamps) sobre documentos XML assinados.
//
// Baseado no modelo oficial: emissao-carimbo-do-tempo-rest-master
//
// Dois modos de operação:
//   - FILE: envia o documento inteiro (multipart file upload)
//   - HASH: envia apenas o hash SHA256 do documento (mais leve)
//
// Endpoint: POST {timestampBaseUrl}
// Auth: Bearer JWT (mesmo OAuth2 client_credentials do fluxo de assinatura)
// Content-Type: multipart/form-data
//
// NONCE: a BRy espera um inteiro simples (ex: 1, 42, 123456).
// Não use BigInt strings — o serviço rejeita valores fora do range de inteiro.
// ─────────────────────────────────────────────────────────────────────────────

import type { BryConfig } from "./config";
import { getTimestampToken, invalidarCacheTimestampToken } from "./auth";
import type { BryTimestampResponse } from "./types";

// Timeout para chamadas ao BRy Timestamp Service (30s)
// Evita que a rota de carimbo fique travada indefinidamente
const TIMESTAMP_TIMEOUT_MS = 30_000;

/**
 * Solicita carimbo do tempo para um documento via conteúdo (FILE).
 *
 * Envia o documento XML assinado inteiro para o carimbo-service.
 * O serviço calcula o hash internamente e retorna o carimbo em base64.
 *
 * @param config Configuração BRy (inclui timestampBaseUrl)
 * @param params Parâmetros: nonce (inteiro), hashAlgorithm, content (Buffer), fileName
 * @param _retried Controle interno anti-recursão infinita no 401
 * @returns Resposta com array de timeStamps contendo nonce + content (base64)
 */
export async function bryTimestampByContent(
  config: BryConfig,
  params: {
    nonce: string;
    content: Buffer;
    fileName?: string;
    hashAlgorithm?: "SHA1" | "SHA256" | "SHA512";
  },
  _retried = false
): Promise<BryTimestampResponse> {
  const token = await getTimestampToken(config);
  const url = config.timestampBaseUrl;

  const form = new FormData();
  form.append("nonce", params.nonce);
  form.append("hashAlgorithm", params.hashAlgorithm ?? "SHA256");
  form.append("format", "FILE");
  form.append("documents[0][nonce]", params.nonce);

  // Enviar o documento como Blob (multipart file)
  // Converter Buffer → ArrayBuffer para compatibilidade com Blob API
  const arrayBuf = params.content.buffer.slice(
    params.content.byteOffset,
    params.content.byteOffset + params.content.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuf], { type: "application/xml" });
  form.append(
    "documents[0][content]",
    blob,
    params.fileName ?? "documento.xml"
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
    signal: AbortSignal.timeout(TIMESTAMP_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Se 401, invalidar cache e tentar UMA vez — evita recursão infinita
    if (response.status === 401 && !_retried) {
      invalidarCacheTimestampToken();
      return bryTimestampByContent(config, params, true);
    }
    const text = await response.text();
    throw new Error(
      `BRy Carimbo (FILE) falhou (${response.status}): ${text.slice(0, 1000)}`
    );
  }

  return response.json() as Promise<BryTimestampResponse>;
}

/**
 * Solicita carimbo do tempo para um documento via hash (HASH).
 *
 * Envia apenas o hash SHA256 do documento. Mais eficiente para documentos
 * grandes, já que não transmite o conteúdo inteiro.
 *
 * @param config Configuração BRy
 * @param params Parâmetros: nonce (inteiro), hash (hex string SHA256)
 * @param _retried Controle interno anti-recursão infinita no 401
 * @returns Resposta com array de timeStamps contendo nonce + content (base64)
 */
export async function bryTimestampByHash(
  config: BryConfig,
  params: {
    nonce: string;
    hash: string;
    hashAlgorithm?: "SHA1" | "SHA256" | "SHA512";
  },
  _retried = false
): Promise<BryTimestampResponse> {
  const token = await getTimestampToken(config);
  const url = config.timestampBaseUrl;

  const form = new FormData();
  form.append("nonce", params.nonce);
  form.append("hashAlgorithm", params.hashAlgorithm ?? "SHA256");
  form.append("format", "HASH");
  form.append("documents[0][nonce]", params.nonce);
  form.append("documents[0][content]", params.hash);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
    signal: AbortSignal.timeout(TIMESTAMP_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Se 401, invalidar cache e tentar UMA vez — evita recursão infinita
    if (response.status === 401 && !_retried) {
      invalidarCacheTimestampToken();
      return bryTimestampByHash(config, params, true);
    }
    const text = await response.text();
    throw new Error(
      `BRy Carimbo (HASH) falhou (${response.status}): ${text.slice(0, 1000)}`
    );
  }

  return response.json() as Promise<BryTimestampResponse>;
}

/**
 * Função de conveniência: aplica carimbo do tempo em um XML assinado.
 *
 * Calcula o hash SHA256 do conteúdo e envia via modo HASH (mais eficiente).
 * Se preferir enviar o arquivo inteiro, use bryTimestampByContent().
 *
 * IMPORTANTE: nonce deve ser um inteiro simples (1 a 2_000_000_000).
 * A BRy rejeita BigInt strings ou valores fora do range de inteiro.
 *
 * @param config Configuração BRy
 * @param xmlAssinado Conteúdo do XML assinado (string ou Buffer)
 * @returns Carimbo do tempo em base64
 */
export async function aplicarCarimboDoTempo(
  config: BryConfig,
  xmlAssinado: string | Buffer
): Promise<{ nonce: string; carimboBase64: string }> {
  const { createHash, randomInt } = await import("crypto");

  // Gerar nonce como inteiro simples (conforme modelo oficial BRy)
  // BRy espera número inteiro — BigInt strings causam rejeição silenciosa
  const nonce = randomInt(1, 2_000_000_000).toString();

  // Calcular SHA256 do documento
  const buffer =
    typeof xmlAssinado === "string"
      ? Buffer.from(xmlAssinado, "utf-8")
      : xmlAssinado;
  const hash = createHash("sha256").update(buffer).digest("hex").toUpperCase();

  // Chamar API via hash (mais eficiente, não transmite o XML inteiro)
  const response = await bryTimestampByHash(config, {
    nonce,
    hash,
    hashAlgorithm: "SHA256",
  });

  if (!response.timeStamps || response.timeStamps.length === 0) {
    throw new Error("BRy Carimbo: nenhum timestamp retornado");
  }

  return {
    nonce,
    carimboBase64: response.timeStamps[0].content,
  };
}
