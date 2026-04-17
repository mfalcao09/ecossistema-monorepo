/**
 * Extração de entidades via regex — barata, síncrona, sem LLM.
 *
 * Cobertura proposital (contexto Marcelo):
 *   - CPF (xxx.xxx.xxx-xx ou 11 dígitos)
 *   - CNPJ (xx.xxx.xxx/xxxx-xx ou 14 dígitos)
 *   - Datas PT-BR (dd/mm/aaaa, dd-mm-aaaa, yyyy-mm-dd)
 *   - Valores monetários (R$ 1.234,56)
 *   - Nomes próprios simples (sequência de Iniciais Maiúsculas)
 *   - Emails
 *
 * Para contextos onde entity-boost pesa (financeiro/jurídico) isso já é mais
 * forte que BM25 puro. Upgrade futuro: trocar por LLM Haiku.
 */

const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RE_CPF = /(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\b\d{11}\b)/g;
const RE_CNPJ = /(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\b\d{14}\b)/g;
const RE_DATE_BR = /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
const RE_MONEY = /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g;
// Nomes próprios: 1-3 palavras iniciadas com maiúscula (inclui acentos).
const RE_PROPER = /\b(?:[A-ZÁ-Ú][a-zá-ú]+)(?:\s+(?:[A-ZÁ-Ú][a-zá-ú]+|d[aeo]s?|d[aeo]))*(?:\s+[A-ZÁ-Ú][a-zá-ú]+)\b/g;

export function extractEntities(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const set = new Set<string>();
  const patterns = [RE_EMAIL, RE_CPF, RE_CNPJ, RE_DATE_BR, RE_MONEY, RE_PROPER];
  for (const re of patterns) {
    const matches = text.match(re);
    if (matches) for (const m of matches) set.add(m.trim());
  }
  return [...set];
}

/**
 * Computa score de overlap entre entidades da query e entidades de um hit.
 *
 * score = |entitiesQuery ∩ entitiesHit| / |entitiesQuery|
 *
 * Retorna 0 se a query não tem entidades (evita ruído em queries lexicais).
 */
export function entityOverlapScore(
  queryEntities: string[],
  hitEntities: unknown,
): number {
  if (queryEntities.length === 0) return 0;
  const hitSet = normalizeEntitiesField(hitEntities);
  if (hitSet.size === 0) return 0;
  const queryNorm = queryEntities.map((e) => e.toLowerCase());
  let matched = 0;
  for (const qe of queryNorm) {
    if (hitSet.has(qe)) matched += 1;
  }
  return matched / queryNorm.length;
}

function normalizeEntitiesField(raw: unknown): Set<string> {
  const out = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") out.add(item.toLowerCase());
      else if (item && typeof item === "object") {
        const label = (item as { value?: string; name?: string; text?: string }).value
          ?? (item as { name?: string }).name
          ?? (item as { text?: string }).text;
        if (typeof label === "string") out.add(label.toLowerCase());
      }
    }
  }
  return out;
}
