import type { EncryptedPayload } from '../types.js';
import { CryptoError } from '../errors.js';

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf.buffer;
}

export async function importDEK(rawKey: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
}

export async function encryptClientSide(
  plaintext: string,
  dek: CryptoKey,
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits AES-GCM

  let ciphertext: ArrayBuffer;
  try {
    ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      dek,
      encoder.encode(plaintext),
    );
  } catch (e) {
    throw new CryptoError(`Client-side encryption failed: ${String(e)}`);
  }

  return {
    ciphertext: arrayBufferToBase64(ciphertext), // inclui auth tag GCM nos últimos 16 bytes
    iv: arrayBufferToBase64(iv.buffer),
    algorithm: 'AES-256-GCM',
    version: '1',
  };
}
