import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { artXIICostControl } from "../src/art-xii-cost-control.js";
import { setLiteLLMClient } from "../src/utils.js";
import { ctx, mockLiteLLM, mockLiteLLMFailing } from "./_helpers.js";

describe("Art. XII — Custos", () => {
  afterEach(() => setLiteLLMClient(null));

  it("allow para tool não-LLM", async () => {
    setLiteLLMClient(mockLiteLLM(0));
    const res = await artXIICostControl(ctx({ tool_name: "consultar_saldo" }));
    expect(res).toEqual({ decision: "allow" });
  });

  it("allow com budget suficiente", async () => {
    setLiteLLMClient(mockLiteLLM(100));
    const res = await artXIICostControl(
      ctx({
        tool_name: "llm_chat_completion",
        tool_input: { model: "claude-sonnet-4-6", tokens_expected: 1000 },
      }),
    );
    expect(res).toEqual({ decision: "allow" });
  });

  it("block com budget insuficiente", async () => {
    setLiteLLMClient(mockLiteLLM(0.0001));
    const res = await artXIICostControl(
      ctx({
        tool_name: "llm_chat_completion",
        tool_input: { model: "claude-opus-4-6", tokens_expected: 100_000 },
      }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/Budget insuficiente/);
  });

  it("fail-closed quando LiteLLM joga exceção", async () => {
    setLiteLLMClient(mockLiteLLMFailing());
    const res = await artXIICostControl(
      ctx({ tool_name: "llm_chat_completion", tool_input: { model: "gpt-4o" } }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/Fail-closed/);
  });

  it("usa defaults quando input incompleto", async () => {
    setLiteLLMClient(mockLiteLLM(100));
    const res = await artXIICostControl(
      ctx({ tool_name: "llm_chat_completion", tool_input: {} }),
    );
    expect(res).toEqual({ decision: "allow" });
  });
});
