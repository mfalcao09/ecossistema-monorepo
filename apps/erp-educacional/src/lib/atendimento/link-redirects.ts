/**
 * Algoritmos de distribuição de leads em /l/<slug>.
 *
 * Modos:
 *   - sequential: round-robin sobre numbers ativos (usa cursor_idx persistido)
 *   - random:     aleatório ponderado (weight de cada number)
 *   - ordered:    ordem explícita em schedule_config.order (índices em numbers)
 *   - by_hour:    mapa hora → index (chave "HH-HH" em schedule_config.ranges)
 */

export type DistributionMode = "sequential" | "random" | "ordered" | "by_hour";

export interface LinkNumber {
  number: string;           // "556799999999" (E.164 sem +)
  label?: string;
  weight?: number;          // default 1
  active?: boolean;         // default true
}

export interface ScheduleConfig {
  order?: number[];                       // ordered: índices em numbers
  ranges?: Record<string, number>;        // by_hour: "0-8" → index
  tz?: string;                            // by_hour: "America/Sao_Paulo"
}

/**
 * Seleciona índice do number de destino.
 * Retorna null se não há nenhum number ativo.
 */
export function selectNumberIndex(
  numbers: LinkNumber[],
  distribution: DistributionMode,
  schedule: ScheduleConfig,
  cursorIdx: number,
  now: Date = new Date(),
): number | null {
  // Filtra apenas ativos (mantendo índice original)
  const activeWithIdx = numbers
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.active !== false);

  if (activeWithIdx.length === 0) return null;

  switch (distribution) {
    case "sequential": {
      // round-robin sobre os ativos
      const pick = cursorIdx % activeWithIdx.length;
      return activeWithIdx[pick].i;
    }

    case "random": {
      const weights = activeWithIdx.map(({ n }) => Math.max(1, n.weight ?? 1));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let k = 0; k < activeWithIdx.length; k++) {
        r -= weights[k];
        if (r <= 0) return activeWithIdx[k].i;
      }
      return activeWithIdx[activeWithIdx.length - 1].i;
    }

    case "ordered": {
      const order = Array.isArray(schedule.order) ? schedule.order : [];
      // Encontra o primeiro índice na ordem que seja ativo
      for (const idx of order) {
        const entry = activeWithIdx.find(({ i }) => i === idx);
        if (entry) return entry.i;
      }
      // Fallback: primeiro ativo
      return activeWithIdx[0].i;
    }

    case "by_hour": {
      const tz = schedule.tz ?? "America/Sao_Paulo";
      const hour = hourInTz(now, tz);
      const ranges = schedule.ranges ?? {};

      for (const [range, idx] of Object.entries(ranges)) {
        const [startStr, endStr] = range.split("-");
        const start = Number(startStr);
        const end = Number(endStr);
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        // intervalo semi-aberto [start, end)
        const inRange =
          start < end
            ? hour >= start && hour < end
            : hour >= start || hour < end; // cruza meia-noite
        if (inRange) {
          const entry = activeWithIdx.find(({ i }) => i === idx);
          if (entry) return entry.i;
        }
      }
      return activeWithIdx[0].i;
    }
  }

  return null;
}

function hourInTz(date: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    });
    const h = Number(fmt.format(date));
    return Number.isFinite(h) ? h % 24 : date.getHours();
  } catch {
    return date.getHours();
  }
}

/**
 * Valida slug: 3-64 chars, [a-z0-9-], sem duplo hífen.
 */
export function validateSlug(slug: string): string | null {
  if (!slug || slug.length < 3) return "slug deve ter ao menos 3 caracteres.";
  if (slug.length > 64) return "slug deve ter no máximo 64 caracteres.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return "slug aceita apenas [a-z0-9-] e não pode começar/terminar com hífen.";
  }
  if (/--/.test(slug)) return "slug não pode conter hífens duplos.";
  return null;
}

/**
 * Valida numbers JSON.
 */
export function validateNumbers(numbers: unknown): { ok: true; value: LinkNumber[] } | { ok: false; erro: string } {
  if (!Array.isArray(numbers)) return { ok: false, erro: "numbers deve ser array." };
  if (numbers.length === 0) return { ok: false, erro: "numbers não pode estar vazio." };
  if (numbers.length > 30) return { ok: false, erro: "Máximo 30 números por link." };

  const cleaned: LinkNumber[] = [];
  for (const raw of numbers) {
    if (!raw || typeof raw !== "object") return { ok: false, erro: "Item de numbers inválido." };
    const n = (raw as Record<string, unknown>).number;
    if (typeof n !== "string" || !/^\d{10,15}$/.test(n)) {
      return { ok: false, erro: `number inválido (esperado 10-15 dígitos sem +): ${String(n)}` };
    }
    cleaned.push({
      number: n,
      label: typeof (raw as Record<string, unknown>).label === "string" ? ((raw as Record<string, unknown>).label as string) : undefined,
      weight: typeof (raw as Record<string, unknown>).weight === "number" ? ((raw as Record<string, unknown>).weight as number) : 1,
      active: (raw as Record<string, unknown>).active !== false,
    });
  }
  return { ok: true, value: cleaned };
}

/** SHA-256 hex em WebCrypto (disponível em Node 20+ e edge runtime). */
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
