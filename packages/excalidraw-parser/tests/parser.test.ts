import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseExcalidraw, toMarkdown } from "../src/index.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const fixture = readFileSync(
  resolve(here, "fixtures/cfo-close-flow.excalidraw.json"),
  "utf8",
);

describe("parseExcalidraw", () => {
  it("extrai 3 formas, 2 setas e 1 nota solta; ignora elementos deletados", () => {
    const parsed = parseExcalidraw(fixture);

    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.nodes.map((n) => n.label).sort()).toEqual([
      "BAM check?",
      "CFO-IA Chief",
      "pg_cron 18h BRT",
    ]);

    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges[0].fromId).toBe("rect-cron");
    expect(parsed.edges[0].toId).toBe("rect-chief");
    expect(parsed.edges[0].label).toBe("invoca");

    expect(parsed.floatingTexts).toHaveLength(1);
    expect(parsed.floatingTexts[0].text).toContain("HITL Marcelo");
  });

  it("rejeita JSON sem type=excalidraw", () => {
    expect(() =>
      parseExcalidraw('{"type":"other","version":2,"elements":[]}'),
    ).toThrow(/excalidraw/);
  });

  it("encapsula erro de JSON malformado em mensagem amigável", () => {
    expect(() => parseExcalidraw("{not valid json")).toThrow(
      /Failed to parse Excalidraw JSON/,
    );
  });

  it("aceita arquivo sem elements como diagrama vazio", () => {
    const parsed = parseExcalidraw('{"type":"excalidraw","version":2}');
    expect(parsed).toEqual({ nodes: [], edges: [], floatingTexts: [] });
  });

  it("seta sem binding (orphan arrow) vira edge com fromId/toId null", () => {
    const orphan = {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "arrow-orphan",
          type: "arrow",
          x: 0,
          y: 0,
          text: "sem âncora",
        },
      ],
    };
    const parsed = parseExcalidraw(JSON.stringify(orphan));
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0]).toMatchObject({
      id: "arrow-orphan",
      fromId: null,
      toId: null,
      label: "sem âncora",
    });
  });

  it("text com containerId apontando para shape inexistente vira floating", () => {
    const dangling = {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "text-dangling",
          type: "text",
          x: 0,
          y: 0,
          text: "órfão de container",
          containerId: "shape-que-nao-existe",
        },
      ],
    };
    const parsed = parseExcalidraw(JSON.stringify(dangling));
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.floatingTexts).toHaveLength(1);
    expect(parsed.floatingTexts[0].text).toBe("órfão de container");
  });
});

describe("toMarkdown", () => {
  it("renderiza seções Formas/Conexões/Notas com rótulos resolvidos", () => {
    const md = toMarkdown(
      parseExcalidraw(fixture),
      "Fluxo de fechamento CFO-FIC",
    );

    expect(md).toContain("# Fluxo de fechamento CFO-FIC");
    expect(md).toContain("**CFO-IA Chief** _(rectangle)_");
    expect(md).toContain("**BAM check?** _(diamond)_");
    expect(md).toContain("pg_cron 18h BRT → CFO-IA Chief — _invoca_");
    expect(md).toContain("CFO-IA Chief → BAM check?");
    expect(md).toContain("HITL Marcelo");
  });

  it("lida com diagrama vazio", () => {
    const md = toMarkdown({ nodes: [], edges: [], floatingTexts: [] });
    expect(md).toContain("_nenhuma forma rotulável_");
    expect(md).toContain("_nenhuma seta_");
  });
});
