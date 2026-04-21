/**
 * Unit tests — automation-engine (S8a)
 *
 * Testa funções puras do motor:
 *   - getPayloadField (dot-notation)
 *   - evaluateCondition (10 operadores)
 *   - evaluateConditions (AND/OR)
 */

import { describe, it, expect } from "vitest";
import {
  getPayloadField,
  evaluateCondition,
  evaluateConditions,
} from "@/lib/atendimento/automation-engine";

describe("getPayloadField", () => {
  const payload = {
    message: { content: "matrícula aberta", type: "text" },
    conversation: { id: "uuid-1", labels: ["label-a", "label-b"] },
    deal: { pipeline_id: "p1", stage_id: "s1" },
  };

  it("retorna valor simples", () => {
    expect(getPayloadField(payload, "message.content")).toBe("matrícula aberta");
  });

  it("retorna array", () => {
    expect(getPayloadField(payload, "conversation.labels")).toEqual(["label-a", "label-b"]);
  });

  it("retorna undefined para path inexistente", () => {
    expect(getPayloadField(payload, "foo.bar")).toBeUndefined();
  });

  it("lida com payload null", () => {
    expect(getPayloadField(null, "foo")).toBeUndefined();
  });
});

describe("evaluateCondition", () => {
  const base = {
    message: { content: "Olá, quero matrícula" },
    conversation: { status: "open", queue_id: "q1", labels: ["tag1"] },
    deal: { value_cents: 500000 },
  };

  it("equals true", () => {
    expect(evaluateCondition({ field: "conversation.status", op: "equals", value: "open" }, base)).toBe(true);
  });

  it("equals false", () => {
    expect(evaluateCondition({ field: "conversation.status", op: "equals", value: "resolved" }, base)).toBe(false);
  });

  it("not_equals", () => {
    expect(evaluateCondition({ field: "conversation.status", op: "not_equals", value: "resolved" }, base)).toBe(true);
  });

  it("contains case-insensitive", () => {
    expect(evaluateCondition({ field: "message.content", op: "contains", value: "MATRÍCULA" }, base)).toBe(true);
  });

  it("contains com múltiplas palavras (OR)", () => {
    expect(evaluateCondition({ field: "message.content", op: "contains", value: "boleto|matrícula|pagamento" }, base)).toBe(true);
  });

  it("contains false", () => {
    expect(evaluateCondition({ field: "message.content", op: "contains", value: "diploma" }, base)).toBe(false);
  });

  it("regex_match", () => {
    expect(evaluateCondition({ field: "message.content", op: "regex_match", value: "^Ol[áa]" }, base)).toBe(true);
  });

  it("gt numeric", () => {
    expect(evaluateCondition({ field: "deal.value_cents", op: "gt", value: 100000 }, base)).toBe(true);
  });

  it("lt numeric", () => {
    expect(evaluateCondition({ field: "deal.value_cents", op: "lt", value: 1000000 }, base)).toBe(true);
  });

  it("in array", () => {
    expect(evaluateCondition({ field: "conversation.status", op: "in", value: ["open", "pending"] }, base)).toBe(true);
  });

  it("has_tag", () => {
    expect(evaluateCondition({ field: "", op: "has_tag", value: "tag1" }, base)).toBe(true);
    expect(evaluateCondition({ field: "", op: "has_tag", value: "tag99" }, base)).toBe(false);
  });

  it("queue_is", () => {
    expect(evaluateCondition({ field: "", op: "queue_is", value: "q1" }, base)).toBe(true);
  });

  it("operador desconhecido retorna false", () => {
    expect(evaluateCondition({ field: "x", op: "unknown" as never, value: 1 }, base)).toBe(false);
  });

  it("regex inválida não quebra", () => {
    expect(evaluateCondition({ field: "message.content", op: "regex_match", value: "[invalid(" }, base)).toBe(false);
  });
});

describe("evaluateConditions (AND/OR)", () => {
  const payload = {
    message: { content: "matrícula" },
    conversation: { status: "open" },
  };

  it("AND — todas verdadeiras", () => {
    const conds = [
      { field: "message.content", op: "contains" as const, value: "matrícula" },
      { field: "conversation.status", op: "equals" as const, value: "open" },
    ];
    expect(evaluateConditions(conds, "AND", payload)).toBe(true);
  });

  it("AND — uma falsa", () => {
    const conds = [
      { field: "message.content", op: "contains" as const, value: "matrícula" },
      { field: "conversation.status", op: "equals" as const, value: "resolved" },
    ];
    expect(evaluateConditions(conds, "AND", payload)).toBe(false);
  });

  it("OR — pelo menos uma verdadeira", () => {
    const conds = [
      { field: "message.content", op: "contains" as const, value: "boleto" },
      { field: "conversation.status", op: "equals" as const, value: "open" },
    ];
    expect(evaluateConditions(conds, "OR", payload)).toBe(true);
  });

  it("OR — todas falsas", () => {
    const conds = [
      { field: "message.content", op: "contains" as const, value: "boleto" },
      { field: "conversation.status", op: "equals" as const, value: "resolved" },
    ];
    expect(evaluateConditions(conds, "OR", payload)).toBe(false);
  });

  it("array vazio = sempre true", () => {
    expect(evaluateConditions([], "AND", payload)).toBe(true);
    expect(evaluateConditions([], "OR", payload)).toBe(true);
  });
});
