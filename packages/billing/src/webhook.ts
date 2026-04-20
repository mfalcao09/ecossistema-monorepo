import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifica assinatura HMAC-SHA-256 do webhook Banco Inter.
 * Header enviado pelo Inter: `x-inter-signature: sha256=<hex>`
 * Usa timingSafeEqual para evitar timing attacks.
 */
export function verifyInterWebhook(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const normalized = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(normalized, 'hex');

  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}
