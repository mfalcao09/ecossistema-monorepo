/**
 * Unit test — lógica de SLA do Kanban (S4).
 */

import { describe, it, expect } from "vitest";
import { computeSlaStatus, slaBadgeColor } from "@/lib/atendimento/sla";

const DAY = 24 * 60 * 60 * 1000;

describe("computeSlaStatus", () => {
  const now = new Date("2026-04-21T12:00:00Z");

  it("retorna 'none' quando nenhum SLA está configurado", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 10 * DAY),
      sla_warning_days: null,
      sla_danger_days:  null,
      now,
    });
    expect(r).toBe("none");
  });

  it("retorna 'green' dentro do prazo", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 1 * DAY),
      sla_warning_days: 3,
      sla_danger_days:  7,
      now,
    });
    expect(r).toBe("green");
  });

  it("retorna 'yellow' quando ultrapassa sla_warning_days mas não sla_danger_days", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 4 * DAY),
      sla_warning_days: 3,
      sla_danger_days:  7,
      now,
    });
    expect(r).toBe("yellow");
  });

  it("retorna 'red' quando ultrapassa sla_danger_days", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 10 * DAY),
      sla_warning_days: 3,
      sla_danger_days:  7,
      now,
    });
    expect(r).toBe("red");
  });

  it("red > yellow (ordem de precedência: danger antes de warning)", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 8 * DAY),
      sla_warning_days: 3,
      sla_danger_days:  7,
      now,
    });
    expect(r).toBe("red");
  });

  it("aceita string ISO como entered_stage_at", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 2 * DAY).toISOString(),
      sla_warning_days: 1,
      sla_danger_days:  5,
      now,
    });
    expect(r).toBe("yellow");
  });

  it("retorna 'none' para data inválida", () => {
    const r = computeSlaStatus({
      entered_stage_at: "não-é-data",
      sla_warning_days: 1,
      sla_danger_days:  5,
      now,
    });
    expect(r).toBe("none");
  });

  it("aplica warning mesmo com danger null (caso pipeline_stages.sla_danger_days opcional)", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 5 * DAY),
      sla_warning_days: 3,
      sla_danger_days:  null,
      now,
    });
    expect(r).toBe("yellow");
  });

  it("fronteira exata: diffDays == sla_warning_days → yellow", () => {
    const r = computeSlaStatus({
      entered_stage_at: new Date(now.getTime() - 3 * DAY),
      sla_warning_days: 3,
      sla_danger_days:  7,
      now,
    });
    expect(r).toBe("yellow");
  });
});

describe("slaBadgeColor", () => {
  it("mapeia cada status para hex distinto", () => {
    expect(slaBadgeColor("red")).toBe("#F04438");
    expect(slaBadgeColor("yellow")).toBe("#F79009");
    expect(slaBadgeColor("green")).toBe("#12B76A");
    expect(slaBadgeColor("none")).toBe("#98A2B3");
  });
});
