import { describe, expect, it } from "vitest";
import { createArtXVIIIHook } from "../src/art-xviii-data-contracts.js";
import type { ToolSchemaRegistry } from "../src/types.js";
import { ctx } from "./_helpers.js";

function makeRegistry(schemas: Record<string, { schema: object; version: string }>): ToolSchemaRegistry {
  return {
    getSchema: (n) => schemas[n]?.schema ?? null,
    getVersion: (n) => schemas[n]?.version ?? null,
  };
}

describe("Art. XVIII — Data Contracts", () => {
  it("allow sem registry (default permissivo)", async () => {
    const hook = createArtXVIIIHook();
    const res = await hook(ctx({ tool_name: "qualquer" }));
    expect(res).toEqual({ decision: "allow" });
  });

  it("allow quando input é válido pelo schema", async () => {
    const registry = makeRegistry({
      criar_aluno: {
        version: "v1",
        schema: {
          type: "object",
          required: ["nome", "cpf"],
          properties: {
            nome: { type: "string", minLength: 2 },
            cpf: { type: "string", pattern: "^[0-9]{11}$" },
          },
        },
      },
    });
    const hook = createArtXVIIIHook({ registry });
    const res = await hook(
      ctx({
        tool_name: "criar_aluno",
        tool_input: { nome: "Fulano", cpf: "12345678900" },
      }),
    );
    expect(res).toEqual({ decision: "allow" });
  });

  it("block com erro de schema", async () => {
    const registry = makeRegistry({
      criar_aluno: {
        version: "v1",
        schema: {
          type: "object",
          required: ["nome", "cpf"],
          properties: {
            cpf: { type: "string", pattern: "^[0-9]{11}$" },
          },
        },
      },
    });
    const hook = createArtXVIIIHook({ registry });
    const res = await hook(
      ctx({ tool_name: "criar_aluno", tool_input: { cpf: "abc" } }),
    );
    expect(res).toMatchObject({ decision: "block" });
    const reason = (res as { reason: string }).reason;
    expect(reason).toMatch(/Art\. XVIII.*criar_aluno/);
    expect(reason).toMatch(/v1/);
  });

  it("allow para tool sem schema (modo permissivo)", async () => {
    const registry = makeRegistry({});
    const hook = createArtXVIIIHook({ registry });
    const res = await hook(ctx({ tool_name: "sem_schema" }));
    expect(res).toEqual({ decision: "allow" });
  });

  it("block para tool sem schema (requireSchema)", async () => {
    const registry = makeRegistry({});
    const hook = createArtXVIIIHook({ registry, requireSchema: true });
    const res = await hook(ctx({ tool_name: "sem_schema" }));
    expect(res).toMatchObject({ decision: "block" });
  });
});
