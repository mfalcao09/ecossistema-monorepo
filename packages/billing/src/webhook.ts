import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookVerifyInput } from './types.js';

/**
 * Valida assinatura HMAC-SHA-256 de webhook do Banco Inter.
 *
 * Formatos aceitos de assinatura:
 * - hex puro (64 chars): `d3f6a...`
 * - prefixado: `sha256=d3f6a...`
 * - base64: `q1vQ...` (44 chars, termina com `=`)
 *
 * Comparação em tempo constante (timingSafeEqual) para evitar side-channel.
 * Retorna `false` em qualquer erro — nunca lança para chamador externo.
 */
export function verifyInterWebhook({
  rawBody,
  signature,
  secret,
}: WebhookVerifyInput): boolean {
  if (!signature || !secret) return false;

  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : Buffer.from(rawBody);

  const expected = createHmac('sha256', secret).update(body).digest();

  const provided = parseSignature(signature);
  if (!provided) return false;

  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

function parseSignature(raw: string): Buffer | null {
  const cleaned = raw.trim().replace(/^sha256=/i, '');
  if (!cleaned) return null;

  if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length % 2 === 0) {
    return Buffer.from(cleaned, 'hex');
  }

  if (/^[A-Za-z0-9+/]+=*$/.test(cleaned)) {
    try {
      return Buffer.from(cleaned, 'base64');
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Gera assinatura para testes / mirroring outbound (ex.: re-emitir webhook
 * para serviços internos assinando com nossa chave).
 */
export function signInterPayload(payload: string | Uint8Array, secret: string): string {
  const body = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : Buffer.from(payload);
  return createHmac('sha256', secret).update(body).digest('hex');
}
