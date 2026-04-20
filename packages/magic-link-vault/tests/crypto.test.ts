import { describe, test, expect } from 'vitest';
import {
  encryptClientSide,
  importDEK,
  decryptServerSide,
  generateDEKRaw,
  wrapDEK,
  unwrapDEK,
} from '../src/index.js';

// Node.js 18+ expõe globalThis.crypto com Web Crypto API
// Vitest roda em Node — sem necessidade de polyfill

describe('AES-256-GCM round-trip', () => {
  test('encrypt + decrypt retorna plaintext original', async () => {
    const dekRaw = generateDEKRaw();
    const plaintext = 'super-secret-api-key-abc123!@#';

    const key = await importDEK(dekRaw.buffer);
    const encrypted = await encryptClientSide(plaintext, key);

    const decrypted = await decryptServerSide(encrypted, dekRaw);
    expect(decrypted).toBe(plaintext);
  });

  test('payload cifrado tem campos obrigatórios', async () => {
    const dekRaw = generateDEKRaw();
    const key = await importDEK(dekRaw.buffer);
    const encrypted = await encryptClientSide('test', key);

    expect(encrypted.algorithm).toBe('AES-256-GCM');
    expect(encrypted.version).toBe('1');
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    // IV deve ter 12 bytes (16 chars base64)
    const ivBytes = atob(encrypted.iv).length;
    expect(ivBytes).toBe(12);
  });

  test('dois encrypts do mesmo plaintext produzem IVs diferentes', async () => {
    const dekRaw = generateDEKRaw();
    const key = await importDEK(dekRaw.buffer);
    const a = await encryptClientSide('secret', key);
    const b = await encryptClientSide('secret', key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  test('ciphertext adulterado falha com auth tag mismatch', async () => {
    const dekRaw = generateDEKRaw();
    const key = await importDEK(dekRaw.buffer);
    const encrypted = await encryptClientSide('secret-value', key);

    // Adultera o ciphertext (inverte os últimos bytes)
    const bytes = Uint8Array.from(atob(encrypted.ciphertext), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0xff;
    const tampered = { ...encrypted, ciphertext: btoa(String.fromCharCode(...bytes)) };

    await expect(decryptServerSide(tampered, dekRaw)).rejects.toThrow(/auth tag mismatch|tampered/i);
  });

  test('IV errado falha na decifração', async () => {
    const dekRaw = generateDEKRaw();
    const key = await importDEK(dekRaw.buffer);
    const encrypted = await encryptClientSide('secret-value', key);

    const wrongIV = btoa(String.fromCharCode(...new Uint8Array(12)));
    const tampered = { ...encrypted, iv: wrongIV };

    await expect(decryptServerSide(tampered, dekRaw)).rejects.toThrow(/auth tag|Decryption failed/i);
  });

  test('DEK errada falha na decifração', async () => {
    const dekRaw = generateDEKRaw();
    const wrongDEK = generateDEKRaw();
    const key = await importDEK(dekRaw.buffer);
    const encrypted = await encryptClientSide('secret-value', key);

    await expect(decryptServerSide(encrypted, wrongDEK)).rejects.toThrow(/auth tag|Decryption failed/i);
  });
});

describe('KEK wrap/unwrap', () => {
  test('wrap + unwrap retorna DEK original', async () => {
    const dekRaw = generateDEKRaw();
    const kekRaw = generateDEKRaw(); // reutiliza generateDEKRaw para gerar 256 bits

    const wrapped = await wrapDEK(dekRaw, kekRaw);
    const unwrapped = await unwrapDEK(wrapped, kekRaw);

    expect(unwrapped).toEqual(dekRaw);
  });

  test('KEK errada falha no unwrap', async () => {
    const dekRaw = generateDEKRaw();
    const kekRaw = generateDEKRaw();
    const wrongKEK = generateDEKRaw();

    const wrapped = await wrapDEK(dekRaw, kekRaw);
    await expect(unwrapDEK(wrapped, wrongKEK)).rejects.toThrow(/unwrap/i);
  });

  test('round-trip completo: wrap DEK → cifra → unwrap DEK → decifra', async () => {
    const dekRaw = generateDEKRaw();
    const kekRaw = generateDEKRaw();
    const plaintext = 'Inter_Client_Secret_PROD_XYZ987';

    const wrappedDEK = await wrapDEK(dekRaw, kekRaw);
    const key = await importDEK(dekRaw.buffer);
    const encrypted = await encryptClientSide(plaintext, key);

    const unwrappedDEK = await unwrapDEK(wrappedDEK, kekRaw);
    const decrypted = await decryptServerSide(encrypted, unwrappedDEK);

    expect(decrypted).toBe(plaintext);
  });
});
