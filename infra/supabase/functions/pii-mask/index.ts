// pii-mask/index.ts
// SC-19 — mascara PII preservando formato e retorna hashes determinísticos dos valores originais.
import { errors, ok, readJson } from "../_shared/errors.ts";
import { PII_PATTERNS, type PIIType } from "./patterns.ts";

const PII_SALT = Deno.env.get("PII_HASH_SALT") ?? "ecosystem-v9";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Found {
  type: PIIType;
  position: [number, number];  // [start, end) no texto ORIGINAL
  value_hash: string;          // sha256(salt + original value)
}

interface MaskResult {
  masked: string;
  found: Found[];
  counts: Record<string, number>;
}

async function maskText(text: string): Promise<MaskResult> {
  const matches: { start: number; end: number; type: PIIType; value: string; replacement: string }[] = [];

  for (const p of PII_PATTERNS) {
    p.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.regex.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Deduplica overlap: se já há match cobrindo esse range, pula
      const overlap = matches.some((x) => !(end <= x.start || start >= x.end));
      if (overlap) continue;
      matches.push({ start, end, type: p.type, value: m[0], replacement: p.mask(m[0]) });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  // Build masked string + found entries em paralelo
  let masked = "";
  let cursor = 0;
  const found: Found[] = [];
  const counts: Record<string, number> = {};

  for (const m of matches) {
    masked += text.slice(cursor, m.start) + m.replacement;
    cursor = m.end;
    found.push({
      type: m.type,
      position: [m.start, m.end],
      value_hash: await sha256Hex(PII_SALT + ":" + m.type + ":" + m.value),
    });
    counts[m.type] = (counts[m.type] ?? 0) + 1;
  }
  masked += text.slice(cursor);

  return { masked, found, counts };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errors.methodNotAllowed();
  try {
    const payload = await readJson<{ text?: string; texts?: string[] }>(req);
    if (payload.text !== undefined) {
      if (typeof payload.text !== "string") return errors.badRequest("text must be string");
      const result = await maskText(payload.text);
      return ok(result);
    }
    if (Array.isArray(payload.texts)) {
      const results = await Promise.all(payload.texts.map((t) =>
        typeof t === "string" ? maskText(t) : Promise.resolve({ masked: "", found: [], counts: {} })
      ));
      return ok({ results });
    }
    return errors.badRequest("provide 'text' or 'texts'");
  } catch (e) {
    if (e instanceof Response) return e;
    return errors.internal("unhandled", (e as Error).message);
  }
});
