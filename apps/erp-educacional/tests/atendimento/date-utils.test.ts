/**
 * Unit — helpers de data para calendário de agendamentos.
 */

import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildMonthGrid,
  daysInMonth,
  toDateKey,
} from "@/lib/atendimento/date-utils";

describe("addMonths", () => {
  it("avança dentro do mesmo ano", () => {
    expect(addMonths(2026, 2, 3)).toEqual({ year: 2026, month: 5 });
  });
  it("atravessa fim de ano", () => {
    expect(addMonths(2026, 10, 3)).toEqual({ year: 2027, month: 1 });
  });
  it("retrocede atravessando ano", () => {
    expect(addMonths(2026, 1, -2)).toEqual({ year: 2025, month: 11 });
  });
});

describe("daysInMonth", () => {
  it("fevereiro ano normal = 28", () => {
    expect(daysInMonth(2026, 1)).toBe(28);
  });
  it("fevereiro ano bissexto = 29", () => {
    expect(daysInMonth(2028, 1)).toBe(29);
  });
  it("abril = 30", () => {
    expect(daysInMonth(2026, 3)).toBe(30);
  });
});

describe("buildMonthGrid", () => {
  it("retorna exatamente 42 células", () => {
    const grid = buildMonthGrid(2026, 3); // abril/2026
    expect(grid).toHaveLength(42);
  });
  it("primeira célula é domingo", () => {
    const grid = buildMonthGrid(2026, 3);
    expect(grid[0].getUTCDay()).toBe(0);
  });
  it("contém dia 1 do mês alvo", () => {
    const grid = buildMonthGrid(2026, 3);
    const dayOnes = grid.filter(
      (d) => d.getUTCMonth() === 3 && d.getUTCDate() === 1,
    );
    expect(dayOnes).toHaveLength(1);
  });
});

describe("toDateKey", () => {
  it("formata YYYY-MM-DD em UTC", () => {
    expect(toDateKey(new Date("2026-04-21T15:30:00.000Z"))).toBe("2026-04-21");
  });
});
