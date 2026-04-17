/**
 * Integração: 11 hooks rodando juntos simulando um agente.
 *
 * Cenários (do briefing S01):
 *   1. Chamada OK passa por todos sem bloqueio
 *   2. Ação crítica + valor alto = bloqueada (Art. II)
 *   3. Write em /memory/foo.md = redirecionada (Art. XIV)
 *   4. rm -rf / em Bash = bloqueado (Art. XIX)
 *   5. Tool com schema + input inválido = bloqueado (Art. XVIII)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { artIIHITL } from "../src/art-ii-hitl.js";
import { artIIIIdempotency } from "../src/art-iii-idempotency.js";
import { artIVAudit } from "../src/art-iv-audit.js";
import { artVIIIBaixaReal } from "../src/art-viii-baixa-real.js";
import { artIXFalhaExplicita } from "../src/art-ix-falha-explicita.js";
import { createArtXIIHook } from "../src/art-xii-cost-control.js";
import { artXIVDualWrite } from "../src/art-xiv-dual-write.js";
import { createArtXVIIIHook } from "../src/art-xviii-data-contracts.js";
import { artXIXSecurity } from "../src/art-xix-security.js";
import { artXXSoberania } from "../src/art-xx-soberania.js";
import { createArtXXIIHook } from "../src/art-xxii-aprendizado.js";

import type {
  HookContext,
  HookDecision,
  PostHookContext,
  PreToolUseHook,
  PostToolUseHook,
  SessionContext,
  ToolSchemaRegistry,
} from "../src/types.js";
import { setLiteLLMClient, setSupabaseClient } from "../src/utils.js";
import {
  createMockSupabase,
  ctx,
  mockLiteLLM,
  postCtx,
  sessionCtx,
} from "./_helpers.js";

const registry: ToolSchemaRegistry = {
  getSchema: (name) =>
    name === "criar_matricula_schema"
      ? {
          type: "object",
          required: ["aluno_id"],
          properties: { aluno_id: { type: "number" } },
        }
      : null,
  getVersion: (name) => (name === "criar_matricula_schema" ? "v1" : null),
};

describe("Integração — 11 hooks em pipeline", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  const artXVIII = createArtXVIIIHook({ registry });
  const artXII = createArtXIIHook();
  const memoryAddSpy = vi.fn(async () => {});
  const artXXII = createArtXXIIHook({ memoryAdd: memoryAddSpy });

  const preHooks: PreToolUseHook[] = [
    artIIHITL,
    artIIIIdempotency,
    artXII,
    artXIVDualWrite,
    artXIXSecurity,
    artXXSoberania,
    artXVIII,
  ];
  const postHooks: PostToolUseHook[] = [artIVAudit, artVIIIBaixaReal, artIXFalhaExplicita];

  async function runPre(c: HookContext): Promise<HookDecision> {
    for (const h of preHooks) {
      const res = await h(c);
      if (res.decision === "block") return res;
    }
    return { decision: "allow" };
  }

  async function runPost(c: PostHookContext): Promise<Error | null> {
    for (const h of postHooks) {
      try {
        await h(c);
      } catch (err) {
        return err as Error;
      }
    }
    return null;
  }

  async function runSessionEnd(c: SessionContext): Promise<void> {
    await artXXII(c);
  }

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseClient(mock.client);
    setLiteLLMClient(mockLiteLLM(1000));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    memoryAddSpy.mockClear();
  });

  afterEach(() => {
    setSupabaseClient(null);
    setLiteLLMClient(null);
    vi.restoreAllMocks();
  });

  it("1) chamada OK passa pelos 11 hooks sem bloqueio", async () => {
    const pre = await runPre(
      ctx({
        tool_name: "consultar_saldo",
        tool_input: { conta_id: 42 },
      }),
    );
    expect(pre).toEqual({ decision: "allow" });

    const postErr = await runPost(
      postCtx({
        tool_name: "consultar_saldo",
        tool_input: { conta_id: 42 },
        result: { saldo_brl: 1000, status: "done" },
        http_status: 200,
      }),
    );
    expect(postErr).toBeNull();

    await runSessionEnd(
      sessionCtx({
        tools_used: ["consultar_saldo"],
        files_touched: [],
      }),
    );
    expect(memoryAddSpy).toHaveBeenCalledOnce();

    // audit_log foi gravado
    expect(mock.state.inserts.some((i) => i.table === "audit_log")).toBe(true);
  });

  it("2) ação financeira crítica acima do limite é bloqueada (Art. II)", async () => {
    const pre = await runPre(
      ctx({
        tool_name: "pix_transferencia",
        tool_input: { valor: 50_000, destino: "conta-x" },
      }),
    );
    expect(pre).toMatchObject({ decision: "block" });
    expect((pre as { reason: string }).reason).toMatch(/Art\. II/);
    // approval_request criado
    expect(mock.state.inserts.some((i) => i.table === "approval_requests")).toBe(true);
  });

  it("3) Write em /memory/*.md é redirecionado (Art. XIV)", async () => {
    const pre = await runPre(
      ctx({
        tool_name: "Write",
        tool_input: { file_path: "/project/memory/decisions.md", content: "x" },
      }),
    );
    expect(pre).toMatchObject({ decision: "block" });
    expect((pre as { reason: string }).reason).toMatch(/Art\. XIV/);
    expect((pre as { reason: string }).reason).toMatch(/ecosystem_memory/);
  });

  it("4) rm -rf / em Bash é bloqueado (Art. XIX)", async () => {
    const pre = await runPre(
      ctx({ tool_name: "Bash", tool_input: { command: "rm -rf /" } }),
    );
    expect(pre).toMatchObject({ decision: "block" });
    expect((pre as { reason: string }).reason).toMatch(/Art\. XIX/);
  });

  it("5) tool com schema + input inválido é bloqueado (Art. XVIII)", async () => {
    const pre = await runPre(
      ctx({
        tool_name: "criar_matricula_schema",
        tool_input: { aluno_id: "não é número" },
      }),
    );
    expect(pre).toMatchObject({ decision: "block" });
    expect((pre as { reason: string }).reason).toMatch(/Art\. XVIII/);
  });

  it("post-pipeline detecta falha silenciosa (Art. IX) e audita (Art. IV)", async () => {
    const err = await runPost(
      postCtx({
        tool_name: "emitir_boleto",
        result: { success: false, error: "gateway inacessível" },
        http_status: 200,
      }),
    );
    expect(err).toBeTruthy();
    expect(err!.name).toBe("ToolFailedError");

    // Antes do erro, Art. IV gravou o audit — e Art. IX gravou severity HIGH
    const auditRows = mock.state.inserts.filter((i) => i.table === "audit_log");
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows.some((r) => (r.payload as { severity: string }).severity === "HIGH")).toBe(
      true,
    );
  });
});
