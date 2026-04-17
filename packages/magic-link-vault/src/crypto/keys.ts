import { KeyError } from '../errors.js';

/**
 * Gera uma DEK (Data Encryption Key) de 256 bits para uso único por token.
 * A DEK é cifrada pela KEK (do Supabase Vault) antes de persistir.
 */
export function generateDEKRaw(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32)); // 256 bits
}

/**
 * Wraps (cifra) a DEK usando AES-KW com a KEK fornecida.
 * KEK deve vir do Supabase Vault — nunca de env var em texto.
 */
export async function wrapDEK(dekRaw: Uint8Array, kekRaw: Uint8Array): Promise<Uint8Array> {
  let kek: CryptoKey;
  try {
    kek = await crypto.subtle.importKey('raw', kekRaw, 'AES-KW', false, ['wrapKey']);
  } catch (e) {
    throw new KeyError(`Failed to import KEK: ${String(e)}`);
  }

  const dekKey = await crypto.subtle.importKey(
    'raw',
    dekRaw,
    { name: 'AES-GCM', length: 256 },
    true, // exportable para wrapping
    ['encrypt', 'decrypt'],
  );

  let wrapped: ArrayBuffer;
  try {
    wrapped = await crypto.subtle.wrapKey('raw', dekKey, kek, 'AES-KW');
  } catch (e) {
    throw new KeyError(`Failed to wrap DEK: ${String(e)}`);
  }

  return new Uint8Array(wrapped);
}

/**
 * Unwraps (decifra) a DEK usando AES-KW com a KEK fornecida.
 * Retorna os bytes raw da DEK para uso imediato em decrypt.
 */
export async function unwrapDEK(wrappedDEK: Uint8Array, kekRaw: Uint8Array): Promise<Uint8Array> {
  let kek: CryptoKey;
  try {
    kek = await crypto.subtle.importKey('raw', kekRaw, 'AES-KW', false, ['unwrapKey']);
  } catch (e) {
    throw new KeyError(`Failed to import KEK for unwrap: ${String(e)}`);
  }

  let dekKey: CryptoKey;
  try {
    dekKey = await crypto.subtle.unwrapKey(
      'raw',
      wrappedDEK,
      kek,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      true, // exportable para podermos extrair os bytes raw
      ['encrypt', 'decrypt'],
    );
  } catch (e) {
    throw new KeyError(`Failed to unwrap DEK: ${String(e)}`);
  }

  const exported = await crypto.subtle.exportKey('raw', dekKey);
  return new Uint8Array(exported);
}

export function arrayBufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return arrayBufferToHex(hash);
}
