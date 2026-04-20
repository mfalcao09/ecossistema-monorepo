import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CredentialsClient,
  CredentialsError,
  getCredential,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// CredentialsClient
// ---------------------------------------------------------------------------

describe("CredentialsClient", () => {
  const config = {
    gatewayUrl: "https://gqckbunsfjgerbuiyzvn.functions.supabase.co",
    ownerToken: "test-token",
  };

  it("lança erro se gatewayUrl estiver vazio", () => {
    expect(() => new CredentialsClient({ gatewayUrl: "", ownerToken: "x" })).toThrow(
      CredentialsError,
    );
  });

  it("lança erro se ownerToken estiver vazio", () => {
    expect(() => new CredentialsClient({ gatewayUrl: "https://x.com", ownerToken: "" })).toThrow(
      CredentialsError,
    );
  });

  it("lança erro se name estiver vazio", async () => {
    const client = new CredentialsClient(config);
    await expect(client.get("", "agent-001")).rejects.toThrow(CredentialsError);
  });

  it("lança erro se agentId estiver vazio", async () => {
    const client = new CredentialsClient(config);
    await expect(client.get("MY_KEY", "")).rejects.toThrow(CredentialsError);
  });

  it("retorna CredentialResult em caso de sucesso", async () => {
    const mockResult = { value: "sk-secret-123", cached_at: "2026-04-18T10:00:00Z" };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    } as Response);

    const client = new CredentialsClient(config);
    const result = await client.get("OPENAI_API_KEY", "agent-erp-001");

    expect(result.value).toBe("sk-secret-123");
    expect(result.cached_at).toBe("2026-04-18T10:00:00Z");

    expect(global.fetch).toHaveBeenCalledWith(
      `${config.gatewayUrl}/credential-gateway`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "OPENAI_API_KEY", agent_id: "agent-erp-001" }),
      }),
    );
  });

  it("lança CredentialsError com statusCode em caso de falha HTTP", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as Response);

    const client = new CredentialsClient(config);
    const err = await client.get("MY_KEY", "agent-001").catch((e) => e as CredentialsError);

    expect(err).toBeInstanceOf(CredentialsError);
    expect(err.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// getCredential (função conveniente)
// ---------------------------------------------------------------------------

describe("getCredential", () => {
  beforeEach(() => {
    process.env["CREDENTIAL_GATEWAY_URL"] = "https://gqck.functions.supabase.co";
    process.env["CREDENTIAL_GATEWAY_TOKEN"] = "tok-test";
  });

  afterEach(() => {
    delete process.env["CREDENTIAL_GATEWAY_URL"];
    delete process.env["CREDENTIAL_GATEWAY_TOKEN"];
  });

  it("retorna o value da credencial", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: "sk-abc", cached_at: "2026-04-18T00:00:00Z" }),
    } as Response);

    const value = await getCredential("MY_KEY", "agent-001");
    expect(value).toBe("sk-abc");
  });

  it("lança erro se CREDENTIAL_GATEWAY_URL não estiver definida", async () => {
    delete process.env["CREDENTIAL_GATEWAY_URL"];
    await expect(getCredential("MY_KEY", "agent-001")).rejects.toThrow(CredentialsError);
  });
});
