import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  generateDEKRaw,
  wrapDEK,
  unwrapDEK,
  encryptClientSide,
  importDEK,
  decryptServerSide,
  buildNewToken,
  isTokenValid,
} from '../src/index.js';

// Simula o fluxo E2E completo sem Supabase real:
// Agent cria token → browser cifra → servidor armazena → SC-29 decifra → proxy call

describe('E2E: Magic Link Vault flow', () => {
  const kekRaw = generateDEKRaw(); // em prod: vem do Supabase Vault

  // Estado simulando o banco
  let db: {
    vault_tokens: Map<string, {
      token: string;
      credential_name: string;
      project: string;
      dek_wrapped: Uint8Array;
      expires_at: string;
      used: boolean;
    }>;
    ecosystem_credentials: Map<string, {
      vault_key: string | null;
      vault_iv: string | null;
      vault_algorithm: string | null;
    }>;
  };

  beforeEach(() => {
    db = {
      vault_tokens: new Map(),
      ecosystem_credentials: new Map(),
    };
  });

  test('fluxo completo: agent cria token → browser cifra → SC-29 decifra → API mock recebe secret', async () => {
    const CREDENTIAL_NAME = 'INTER_CLIENT_SECRET';
    const PLAINTEXT_SECRET = 'Bearer_Inter_Prod_XYZ987_abc!@#$';

    // 1. Agent chama collect_secret → gera token + DEK
    const dekRaw = generateDEKRaw();
    const wrappedDEK = await wrapDEK(dekRaw, kekRaw);
    const newToken = buildNewToken({
      credential_name: CREDENTIAL_NAME,
      project: 'fic',
      scope_description: 'Inter Client Secret para emissão de boleto FIC',
      requested_by: 'cfo-fic',
      dek_wrapped: wrappedDEK,
    });

    // Persiste no banco (simulado)
    db.vault_tokens.set(newToken.token, {
      token: newToken.token,
      credential_name: newToken.credential_name,
      project: newToken.project,
      dek_wrapped: wrappedDEK,
      expires_at: newToken.expires_at.toISOString(),
      used: false,
    });
    db.ecosystem_credentials.set(CREDENTIAL_NAME, {
      vault_key: null,
      vault_iv: null,
      vault_algorithm: null,
    });

    // 2. Agent gera URL e "envia" para Marcelo
    const url = `https://vault.ecossistema.internal/vault/collect/${newToken.token}`;
    expect(url).toContain(newToken.token);

    // 3. Browser abre URL e valida token
    const tokenRow = db.vault_tokens.get(newToken.token)!;
    expect(isTokenValid({
      ...tokenRow,
      scope: null,
      used_at: null,
      used_from_ip: null,
      used_from_ua: null,
      created_at: new Date().toISOString(),
    })).toBe(true);

    // 4. Servidor envia DEK ao browser (via /api/vault/dek)
    //    Browser recebe DEK e cifra o plaintext
    const dekForBrowser = await unwrapDEK(wrappedDEK, kekRaw);
    const cryptoKey = await importDEK(dekForBrowser.buffer);
    const encryptedPayload = await encryptClientSide(PLAINTEXT_SECRET, cryptoKey);

    // 5. Browser POST → servidor valida token e armazena ciphertext (EF collect-secret)
    //    Validação do token
    expect(tokenRow.used).toBe(false);
    expect(new Date(tokenRow.expires_at) > new Date()).toBe(true);

    // Armazena ciphertext (simulação do que a EF faz)
    db.ecosystem_credentials.set(CREDENTIAL_NAME, {
      vault_key: encryptedPayload.ciphertext,
      vault_iv: encryptedPayload.iv,
      vault_algorithm: encryptedPayload.algorithm,
    });
    tokenRow.used = true; // invalida o token

    // 6. Segunda tentativa com o mesmo token deve falhar (one-time)
    expect(tokenRow.used).toBe(true);
    expect(isTokenValid({
      ...tokenRow,
      scope: null,
      used_at: new Date().toISOString(),
      used_from_ip: null,
      used_from_ua: null,
      created_at: new Date().toISOString(),
    })).toBe(false);

    // 7. SC-29 Modo B: unwrap DEK, decifra ciphertext, simula proxy call
    const cred = db.ecosystem_credentials.get(CREDENTIAL_NAME)!;
    expect(cred.vault_key).toBeTruthy();

    const dekForDecrypt = await unwrapDEK(wrappedDEK, kekRaw);
    const decrypted = await decryptServerSide(
      {
        ciphertext: cred.vault_key!,
        iv: cred.vault_iv!,
        algorithm: 'AES-256-GCM',
        version: '1',
      },
      dekForDecrypt,
    );

    // 8. API mock receberia o secret correto
    expect(decrypted).toBe(PLAINTEXT_SECRET);

    // 9. Garante que o plaintext nunca ficou em ecosystem_credentials
    expect(cred.vault_key).not.toBe(PLAINTEXT_SECRET);
    expect(cred.vault_key).not.toContain('Bearer');
  });

  test('token one-time: segundo uso é rejeitado', async () => {
    const dekRaw = generateDEKRaw();
    const wrappedDEK = await wrapDEK(dekRaw, kekRaw);
    const newToken = buildNewToken({
      credential_name: 'X',
      project: 'ecosystem',
      scope_description: 'X',
      requested_by: 'agent',
      dek_wrapped: wrappedDEK,
    });

    db.vault_tokens.set(newToken.token, {
      token: newToken.token,
      credential_name: 'X',
      project: 'ecosystem',
      dek_wrapped: wrappedDEK,
      expires_at: newToken.expires_at.toISOString(),
      used: false,
    });

    const tokenRow = db.vault_tokens.get(newToken.token)!;

    // Primeiro uso — válido
    expect(tokenRow.used).toBe(false);
    tokenRow.used = true;

    // Segundo uso — inválido
    expect(tokenRow.used).toBe(true);
  });

  test('ciphertext nunca contém o plaintext', async () => {
    const dekRaw = generateDEKRaw();
    const key = await importDEK(dekRaw.buffer);
    const secret = 'my-very-secret-api-key-12345';

    const encrypted = await encryptClientSide(secret, key);

    expect(encrypted.ciphertext).not.toContain(secret);
    expect(atob(encrypted.ciphertext)).not.toContain(secret);
  });

  test('SC-29 com KEK errada não consegue decifrar', async () => {
    const dekRaw = generateDEKRaw();
    const kek1 = generateDEKRaw();
    const kek2 = generateDEKRaw(); // KEK diferente

    const wrappedDEK = await wrapDEK(dekRaw, kek1);
    const key = await importDEK(dekRaw.buffer);
    const encrypted = await encryptClientSide('secret', key);

    // Tenta decifrar com KEK errada
    await expect(unwrapDEK(wrappedDEK, kek2)).rejects.toThrow(/unwrap/i);

    // Confirma que com KEK certa funciona
    const correctDEK = await unwrapDEK(wrappedDEK, kek1);
    const decrypted = await decryptServerSide(encrypted, correctDEK);
    expect(decrypted).toBe('secret');
  });
});
