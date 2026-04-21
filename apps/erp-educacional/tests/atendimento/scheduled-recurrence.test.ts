/**
 * Unit — regra de recorrência para scheduled_messages.
 */

import { describe, expect, it } from "vitest";
import { computeNextOccurrence } from "@/lib/atendimento/recurrence";

describe("computeNextOccurrence", () => {
  const base = new Date("2026-04-21T12:00:00.000Z");

  it("avança 1 dia em DAILY", () => {
    const next = computeNextOccurrence(base, { freq: "DAILY" });
    expect(next?.toISOString()).toBe("2026-04-22T12:00:00.000Z");
  });

  it("avança interval*dias em DAILY com interval", () => {
    const next = computeNextOccurrence(base, { freq: "DAILY", interval: 3 });
    expect(next?.toISOString()).toBe("2026-04-24T12:00:00.000Z");
  });

  it("avança 7 dias em WEEKLY", () => {
    const next = computeNextOccurrence(base, { freq: "WEEKLY" });
    expect(next?.toISOString()).toBe("2026-04-28T12:00:00.000Z");
  });

  it("avança 1 mês em MONTHLY", () => {
    const next = computeNextOccurrence(base, { freq: "MONTHLY" });
    expect(next?.toISOString()).toBe("2026-05-21T12:00:00.000Z");
  });

  it("retorna null quando next > until", () => {
    const next = computeNextOccurrence(base, {
      freq: "DAILY",
      until: "2026-04-21T23:00:00.000Z",
    });
    expect(next).toBeNull();
  });

  it("respeita until quando próxima ocorrência é válida", () => {
    const next = computeNextOccurrence(base, {
      freq: "DAILY",
      until: "2026-05-01T00:00:00.000Z",
    });
    expect(next?.toISOString()).toBe("2026-04-22T12:00:00.000Z");
  });
});
