import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signInterPayload, verifyInterWebhook } from '../src/webhook.js';

const SECRET = 'super-secret-key';

function sigHex(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
function sigB64(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64');
}

describe('verifyInterWebhook', () => {
  it('aceita assinatura hex válida', () => {
    const body = JSON.stringify({ evento: 'pagamento_recebido' });
    const signature = sigHex(body, SECRET);
    expect(verifyInterWebhook({ rawBody: body, signature, secret: SECRET })).toBe(true);
  });

  it('aceita prefixo sha256=', () => {
    const body = '{"x":1}';
    const signature = `sha256=${sigHex(body, SECRET)}`;
    expect(verifyInterWebhook({ rawBody: body, signature, secret: SECRET })).toBe(true);
  });

  it('aceita assinatura base64', () => {
    const body = '{"x":1}';
    const signature = sigB64(body, SECRET);
    expect(verifyInterWebhook({ rawBody: body, signature, secret: SECRET })).toBe(true);
  });

  it('aceita Uint8Array como rawBody', () => {
    const body = new TextEncoder().encode('{"a":true}');
    const signature = sigHex('{"a":true}', SECRET);
    expect(verifyInterWebhook({ rawBody: body, signature, secret: SECRET })).toBe(true);
  });

  it('rejeita assinatura adulterada (mesmo tamanho)', () => {
    const body = '{"x":1}';
    const valid = sigHex(body, SECRET);
    const tampered = valid.slice(0, -1) + (valid.endsWith('0') ? '1' : '0');
    expect(verifyInterWebhook({ rawBody: body, signature: tampered, secret: SECRET })).toBe(false);
  });

  it('rejeita secret errado', () => {
    const body = '{"x":1}';
    expect(
      verifyInterWebhook({ rawBody: body, signature: sigHex(body, 'outro'), secret: SECRET }),
    ).toBe(false);
  });

  it('rejeita body diferente', () => {
    const sig = sigHex('{"a":1}', SECRET);
    expect(verifyInterWebhook({ rawBody: '{"a":2}', signature: sig, secret: SECRET })).toBe(false);
  });

  it('rejeita signature vazia', () => {
    expect(verifyInterWebhook({ rawBody: 'x', signature: '', secret: SECRET })).toBe(false);
  });

  it('rejeita secret vazio', () => {
    expect(verifyInterWebhook({ rawBody: 'x', signature: 'aabb', secret: '' })).toBe(false);
  });

  it('rejeita signature com caracteres inválidos', () => {
    expect(
      verifyInterWebhook({ rawBody: 'x', signature: '!!!nothex!!!', secret: SECRET }),
    ).toBe(false);
  });

  it('rejeita signature hex de tamanho errado', () => {
    expect(
      verifyInterWebhook({ rawBody: 'x', signature: 'deadbeef', secret: SECRET }),
    ).toBe(false);
  });

  it('rejeita signature com tamanho ímpar (hex malformed)', () => {
    expect(
      verifyInterWebhook({ rawBody: 'x', signature: 'abc', secret: SECRET }),
    ).toBe(false);
  });
});

describe('signInterPayload', () => {
  it('produz assinatura verificável', () => {
    const body = '{"ping":true}';
    const sig = signInterPayload(body, SECRET);
    expect(verifyInterWebhook({ rawBody: body, signature: sig, secret: SECRET })).toBe(true);
  });

  it('aceita Uint8Array', () => {
    const body = new TextEncoder().encode('{"x":1}');
    const sig = signInterPayload(body, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});
