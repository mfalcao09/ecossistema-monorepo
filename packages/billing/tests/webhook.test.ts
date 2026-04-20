import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyInterWebhook } from '../src/webhook.js';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('verifyInterWebhook', () => {
  const SECRET = 'test-secret-key';
  const PAYLOAD = JSON.stringify({ event: 'PAGAMENTO', nossoNumero: '00001234', valor: 500 });

  it('retorna true para assinatura válida (sem prefixo)', () => {
    const sig = sign(PAYLOAD, SECRET);
    expect(verifyInterWebhook(PAYLOAD, sig, SECRET)).toBe(true);
  });

  it('retorna true para assinatura válida com prefixo sha256=', () => {
    const sig = `sha256=${sign(PAYLOAD, SECRET)}`;
    expect(verifyInterWebhook(PAYLOAD, sig, SECRET)).toBe(true);
  });

  it('retorna false para payload modificado', () => {
    const sig = sign(PAYLOAD, SECRET);
    const tampered = PAYLOAD.replace('500', '1');
    expect(verifyInterWebhook(tampered, sig, SECRET)).toBe(false);
  });

  it('retorna false para secret errado', () => {
    const sig = sign(PAYLOAD, 'outro-secret');
    expect(verifyInterWebhook(PAYLOAD, sig, SECRET)).toBe(false);
  });

  it('retorna false para assinatura com comprimento diferente', () => {
    expect(verifyInterWebhook(PAYLOAD, 'abc', SECRET)).toBe(false);
  });

  it('retorna false para assinatura vazia', () => {
    expect(verifyInterWebhook(PAYLOAD, '', SECRET)).toBe(false);
  });

  it('é robusto a payload vazio (edge case)', () => {
    const sig = sign('', SECRET);
    expect(verifyInterWebhook('', sig, SECRET)).toBe(true);
  });
});
