import { describe, test, expect } from "vitest";
import {
  generateTokenString,
  buildNewToken,
  assertTokenValid,
  isTokenValid,
  minutesUntilExpiry,
  TokenError,
} from "../src/index.js";
import type { VaultToken } from "../src/index.js";

function makeToken(overrides: Partial<VaultToken> = {}): VaultToken {
  const now = new Date();
  const expires = new Date(now.getTime() + 15 * 60 * 1000);
  return {
    token: "abc123",
    credential_name: "INTER_CLIENT_SECRET",
    project: "fic",
    scope: "Inter Client Secret FIC",
    dek_wrapped: null,
    requested_by: "cfo-fic",
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    used: false,
    used_at: null,
    used_from_ip: null,
    used_from_ua: null,
    ...overrides,
  };
}

describe("generateTokenString", () => {
  test("gera string de 32 caracteres por padrão", () => {
    expect(generateTokenString()).toHaveLength(32);
  });

  test("usa apenas caracteres url-safe", () => {
    const token = generateTokenString(64);
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  test("dois tokens gerados são diferentes", () => {
    expect(generateTokenString()).not.toBe(generateTokenString());
  });
});

describe("buildNewToken", () => {
  test("gera token com campos corretos", () => {
    const result = buildNewToken({
      credential_name: "INTER_SECRET",
      project: "fic",
      scope_description: "Chave Inter FIC",
      requested_by: "cfo-fic",
    });

    expect(result.token).toHaveLength(32);
    expect(result.credential_name).toBe("INTER_SECRET");
    expect(result.project).toBe("fic");
    expect(result.scope).toBe("Chave Inter FIC");
    expect(result.requested_by).toBe("cfo-fic");
    expect(result.expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  test("TTL padrão é 15 minutos", () => {
    const before = Date.now();
    const result = buildNewToken({
      credential_name: "X",
      project: "ecosystem",
      scope_description: "X",
      requested_by: "agent",
    });
    const diffMin = (result.expires_at.getTime() - before) / 60_000;
    expect(diffMin).toBeGreaterThanOrEqual(14.9);
    expect(diffMin).toBeLessThanOrEqual(15.1);
  });

  test("TTL customizado é respeitado", () => {
    const before = Date.now();
    const result = buildNewToken({
      credential_name: "X",
      project: "ecosystem",
      scope_description: "X",
      requested_by: "agent",
      ttl_minutes: 30,
    });
    const diffMin = (result.expires_at.getTime() - before) / 60_000;
    expect(diffMin).toBeGreaterThanOrEqual(29.9);
  });

  test("TTL acima de 60 lança TokenError", () => {
    expect(() =>
      buildNewToken({
        credential_name: "X",
        project: "ecosystem",
        scope_description: "X",
        requested_by: "agent",
        ttl_minutes: 61,
      }),
    ).toThrow(TokenError);
  });

  test("TTL abaixo de 1 lança TokenError", () => {
    expect(() =>
      buildNewToken({
        credential_name: "X",
        project: "ecosystem",
        scope_description: "X",
        requested_by: "agent",
        ttl_minutes: 0,
      }),
    ).toThrow(TokenError);
  });
});

describe("isTokenValid", () => {
  test("token válido retorna true", () => {
    expect(isTokenValid(makeToken())).toBe(true);
  });

  test("token null retorna false", () => {
    expect(isTokenValid(null)).toBe(false);
  });

  test("token used retorna false", () => {
    expect(isTokenValid(makeToken({ used: true }))).toBe(false);
  });

  test("token expirado retorna false", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isTokenValid(makeToken({ expires_at: past }))).toBe(false);
  });
});

describe("assertTokenValid", () => {
  test("token válido não lança", () => {
    expect(() => assertTokenValid(makeToken(), "abc")).not.toThrow();
  });

  test('token null lança TokenError com "not found"', () => {
    expect(() => assertTokenValid(null, "abc")).toThrow(/not found/i);
  });

  test("token already used lança TokenError", () => {
    expect(() => assertTokenValid(makeToken({ used: true }), "abc")).toThrow(
      /already used/i,
    );
  });

  test("token expirado lança TokenError", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(() =>
      assertTokenValid(makeToken({ expires_at: past }), "abc"),
    ).toThrow(/expired/i);
  });
});

describe("minutesUntilExpiry", () => {
  test("retorna ~15 para token recém-criado", () => {
    const token = makeToken();
    expect(minutesUntilExpiry(token)).toBeGreaterThanOrEqual(14);
    expect(minutesUntilExpiry(token)).toBeLessThanOrEqual(15);
  });

  test("retorna 0 para token expirado", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(minutesUntilExpiry(makeToken({ expires_at: past }))).toBe(0);
  });
});
