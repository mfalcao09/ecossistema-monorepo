import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "../../src/retrieval/rrf.js";

describe("reciprocalRankFusion", () => {
  it("retorna vazio se rankings vazios", () => {
    const out = reciprocalRankFusion({ rankings: [], idOf: (x: string) => x });
    expect(out).toEqual([]);
  });

  it("documento presente em ambos rankings vence documento presente em só um", () => {
    // 'ambos' rank 2 nas duas listas; 'exclusivo' rank 1 em só uma.
    const listA = ["exclusivo", "ambos", "z"];
    const listB = ["ambos", "outro", "mais"];
    const out = reciprocalRankFusion({
      rankings: [listA, listB],
      idOf: (x) => x,
    });
    expect(out[0].id).toBe("ambos");
  });

  it("peso influencia ordem final", () => {
    const listDense = ["x", "y"];   // dense coloca x primeiro
    const listSparse = ["y", "x"];  // sparse inverte
    const denseHeavy = reciprocalRankFusion({
      rankings: [listDense, listSparse],
      idOf: (v) => v,
      weights: [10, 0.1],
    });
    expect(denseHeavy[0].id).toBe("x");
    const sparseHeavy = reciprocalRankFusion({
      rankings: [listDense, listSparse],
      idOf: (v) => v,
      weights: [0.1, 10],
    });
    expect(sparseHeavy[0].id).toBe("y");
  });

  it("documento exclusivo de um ranking recebe menor score", () => {
    const listA = ["exclusivo", "comum"];
    const listB = ["comum"];
    const out = reciprocalRankFusion({
      rankings: [listA, listB],
      idOf: (v) => v,
    });
    const comum = out.find((r) => r.id === "comum");
    const exclusivo = out.find((r) => r.id === "exclusivo");
    expect(comum!.score).toBeGreaterThan(exclusivo!.score);
  });

  it("k maior achata diferenças de rank (relação entre top e bottom)", () => {
    const ranking = ["top", "mid", "bot"];
    const low = reciprocalRankFusion({
      rankings: [ranking],
      idOf: (x) => x,
      k: 1,
    });
    const high = reciprocalRankFusion({
      rankings: [ranking],
      idOf: (x) => x,
      k: 10000,
    });
    const ratioLow = low[0].score / low[2].score;
    const ratioHigh = high[0].score / high[2].score;
    // Com k grande, ratio top/bot tende a 1 (achatamento)
    expect(ratioHigh).toBeLessThan(ratioLow);
  });
});
