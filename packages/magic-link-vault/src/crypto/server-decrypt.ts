import type { EncryptedPayload } from "../types.js";
import { CryptoError } from "../errors.js";

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

export async function importDEKForDecrypt(
  rawKey: Uint8Array,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

export async function decryptServerSide(
  payload: EncryptedPayload,
  dekRaw: Uint8Array,
): Promise<string> {
  if (payload.algorithm !== "AES-256-GCM") {
    throw new CryptoError(`Unsupported algorithm: ${payload.algorithm}`);
  }

  const key = await importDEKForDecrypt(dekRaw);
  const iv = base64ToUint8Array(payload.iv);
  const ciphertext = base64ToUint8Array(payload.ciphertext);

  let plainBuffer: ArrayBuffer;
  try {
    plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, tagLength: 128 },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    // GCM auth tag verification failed — ciphertext tampered
    throw new CryptoError(
      "Decryption failed: auth tag mismatch or ciphertext tampered",
    );
  }

  return new TextDecoder().decode(plainBuffer);
}
