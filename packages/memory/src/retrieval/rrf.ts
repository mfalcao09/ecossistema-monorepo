/**
 * Reciprocal Rank Fusion (RRF) — combina múltiplos rankings em um score único.
 *
 *   score(doc) = Σ  weight_list / (k + rank_in_list + 1)
 *
 * - `k=60` é default clássico (Cormack et al., 2009).
 * - Rankings passados já ordenados; rank é o índice na lista.
 * - Pesos são opcionais; se não passados, cada ranking contribui igualmente.
 * - Documentos ausentes em um ranking não recebem contribuição daquela lista.
 */
export interface RRFInput<T> {
  /** Rankings em ordem decrescente de relevância (posição 0 é a melhor). */
  rankings: T[][];
  /** Extrai o identificador estável do item. */
  idOf: (item: T) => string;
  /** Peso opcional por ranking; default 1.0 cada. */
  weights?: number[];
  /** k do RRF. Default 60. */
  k?: number;
}

export interface RRFOutput<T> {
  id: string;
  score: number;
  item: T;
}

export function reciprocalRankFusion<T>(input: RRFInput<T>): RRFOutput<T>[] {
  const { rankings, idOf, weights, k = 60 } = input;
  const scores = new Map<string, number>();
  const firstItem = new Map<string, T>();

  rankings.forEach((ranking, listIdx) => {
    const w = weights?.[listIdx] ?? 1;
    ranking.forEach((item, rank) => {
      const id = idOf(item);
      const contribution = w / (k + rank + 1);
      scores.set(id, (scores.get(id) ?? 0) + contribution);
      if (!firstItem.has(id)) firstItem.set(id, item);
    });
  });

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score, item: firstItem.get(id)! }))
    .sort((a, b) => b.score - a.score);
}
