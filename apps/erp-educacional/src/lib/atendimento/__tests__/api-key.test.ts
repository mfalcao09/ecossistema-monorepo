/**
 * Unit tests — api-key helpers (S8a)
 */

import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, hasScope } from "@/lib/atendimento/api-key";

describe("generateApiKey", () => {
  it("retorna prefixo sk_live_", () => {
    const { plaintext } = generateApiKey();
    expect(plaintext.startsWith("sk_live_")).toBe(true);
  });

  it("hash é SHA-256 hex (64 chars)", () => {
    const { hash } = generateApiKey();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("prefix tem 12 chars", () => {
    const { prefix } = generateApiKey();
    expect(prefix.length).toBe(12);
  });

  it("hashApiKey é determinístico", () => {
    const a = hashApiKey("sk_live_abc123");
    const b = hashApiKey("sk_live_abc123");
    expect(a).toBe(b);
    expect(hashApiKey("sk_live_XYZ")).not.toBe(a);
  });
});

describe("hasScope", () => {
  it("wildcard * cobre tudo", () => {
    expect(hasScope({ id: "k1", account_id: null, scopes: ["*"], name: "n" }, "messages:send")).toBe(true);
    expect(hasScope({ id: "k1", account_id: null, scopes: ["*"], name: "n" }, "deals:write")).toBe(true);
  });

  it("scope exato match", () => {
    expect(hasScope({ id: "k1", account_id: null, scopes: ["messages:send"], name: "n" }, "messages:send")).toBe(true);
    expect(hasScope({ id: "k1", account_id: null, scopes: ["messages:read"], name: "n" }, "messages:send")).toBe(false);
  });

  it("namespace wildcard (messages:*) cobre specific", () => {
    expect(hasScope({ id: "k1", account_id: null, scopes: ["messages:*"], name: "n" }, "messages:send")).toBe(true);
    expect(hasScope({ id: "k1", account_id: null, scopes: ["contacts:*"], name: "n" }, "messages:send")).toBe(false);
  });

  it("sem scope → false", () => {
    expect(hasScope({ id: "k1", account_id: null, scopes: [], name: "n" }, "messages:send")).toBe(false);
  });
});
