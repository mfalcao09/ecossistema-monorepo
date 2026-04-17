import { describe, it, expect } from "vitest";
import {
  FilterValidationError,
  validateFilters,
} from "../../src/filters/strict-filters.js";

describe("validateFilters", () => {
  it("aceita filtros completos", () => {
    expect(() =>
      validateFilters({ agent_id: "cfo-fic", business_id: "fic" }),
    ).not.toThrow();
  });

  it("rejeita filtros ausentes", () => {
    expect(() => validateFilters(undefined as unknown)).toThrow(FilterValidationError);
    expect(() => validateFilters(null as unknown)).toThrow(FilterValidationError);
    expect(() => validateFilters("x" as unknown)).toThrow(FilterValidationError);
  });

  it("exige agent_id", () => {
    expect(() => validateFilters({ business_id: "fic" })).toThrow(/agent_id/);
  });

  it("exige business_id", () => {
    expect(() => validateFilters({ agent_id: "x" })).toThrow(/business_id/);
  });

  it("rejeita agent_id vazio", () => {
    expect(() => validateFilters({ agent_id: "   ", business_id: "fic" })).toThrow(
      /agent_id/,
    );
  });

  it("rejeita user_id com tipo errado", () => {
    expect(() =>
      validateFilters({ agent_id: "a", business_id: "b", user_id: 123 }),
    ).toThrow(/user_id/);
  });

  it("rejeita run_id com tipo errado", () => {
    expect(() =>
      validateFilters({ agent_id: "a", business_id: "b", run_id: [] }),
    ).toThrow(/run_id/);
  });
});
