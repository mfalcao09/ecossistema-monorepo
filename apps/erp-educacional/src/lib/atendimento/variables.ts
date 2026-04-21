/**
 * DS Voice — Parser de variáveis (isomórfico client/server).
 *
 * Variáveis suportadas (Nexvy-paridade):
 *   - {Nome}           → nome completo do contato
 *   - {Primeiro Nome}  → primeira palavra do nome
 *   - {Saudação}       → "Bom dia" | "Boa tarde" | "Boa noite" (por hora local)
 *   - {Hora}           → "HH:mm" (24h)
 *
 * Sintaxe:
 *   - Chaves literais: {Nome} é a variável. Texto fora é preservado.
 *   - Case-insensitive no matching: {NOME}, {nome}, {Nome} → mesma variável.
 *   - Variável desconhecida: preservada literalmente (não falha).
 *
 * Client-safe: nenhum import de server. Usar dentro de componentes "use client"
 * (editor preview) e em server (ds-voice-sender.ts).
 */

export type VariableName = "Nome" | "Primeiro Nome" | "Saudação" | "Hora";

export interface VariableContext {
  contact?: {
    name?: string | null;
    phone_number?: string | null;
  } | null;
  /** Data de referência para {Saudação} e {Hora}. Default = now(). */
  now?: Date;
  /**
   * Timezone para computar Saudação/Hora. Default = "America/Sao_Paulo".
   * Usa Intl — funciona em Node e browser.
   */
  timezone?: string;
}

const CANONICAL_NAMES: VariableName[] = [
  "Nome",
  "Primeiro Nome",
  "Saudação",
  "Hora",
];

const VARIABLE_REGEX = /\{([^{}\n]+)\}/g;

function normalize(raw: string): VariableName | null {
  const trimmed = raw.trim();
  // Match case-insensitive (também aceita sem acento em "Saudacao")
  const lower = trimmed.toLowerCase().replace(/ç/g, "c").replace(/ã/g, "a");
  for (const canonical of CANONICAL_NAMES) {
    const canonLower = canonical
      .toLowerCase()
      .replace(/ç/g, "c")
      .replace(/ã/g, "a");
    if (lower === canonLower) return canonical;
  }
  return null;
}

function getHourInTimezone(date: Date, timezone: string): number {
  // Intl.DateTimeFormat retorna hora no fuso escolhido — funciona em Node 20+ e browser
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? parseInt(hourPart.value, 10) : date.getHours();
}

function formatHourMinute(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

/**
 * Resolve o valor de uma variável no contexto. Retorna `null` se não há dado
 * disponível (caller decide: manter literal ou trocar por string vazia).
 */
export function resolveVariable(
  name: VariableName,
  context: VariableContext,
): string | null {
  const now = context.now ?? new Date();
  const tz = context.timezone ?? "America/Sao_Paulo";

  switch (name) {
    case "Nome": {
      const n = context.contact?.name?.trim();
      return n && n.length > 0 ? n : null;
    }
    case "Primeiro Nome": {
      const n = context.contact?.name?.trim();
      if (!n) return null;
      const first = n.split(/\s+/)[0];
      return first || null;
    }
    case "Saudação": {
      const hour = getHourInTimezone(now, tz);
      if (hour >= 5 && hour < 12) return "Bom dia";
      if (hour >= 12 && hour < 18) return "Boa tarde";
      return "Boa noite";
    }
    case "Hora": {
      return formatHourMinute(now, tz);
    }
    default:
      return null;
  }
}

/**
 * Substitui todas as variáveis no texto. Variáveis desconhecidas são preservadas.
 * Variáveis conhecidas mas sem dado viram string vazia (configurável via fallback).
 */
export function resolveVariables(
  template: string,
  context: VariableContext,
  opts: { keepUnknown?: boolean; fallback?: string } = {},
): string {
  const keepUnknown = opts.keepUnknown ?? true;
  const fallback = opts.fallback ?? "";

  return template.replace(VARIABLE_REGEX, (match, inner) => {
    const canonical = normalize(inner);
    if (!canonical) return keepUnknown ? match : fallback;
    const value = resolveVariable(canonical, context);
    return value ?? fallback;
  });
}

/**
 * Extrai a lista de variáveis únicas usadas no texto (canonical form).
 * Útil para popular ds_voice_messages.variables JSONB no save.
 */
export function extractVariables(template: string): VariableName[] {
  const found = new Set<VariableName>();
  for (const match of template.matchAll(VARIABLE_REGEX)) {
    const canonical = normalize(match[1]);
    if (canonical) found.add(canonical);
  }
  return Array.from(found);
}

/**
 * Catálogo completo para popular UI (picker de variáveis no editor).
 */
export const VARIABLE_CATALOG: ReadonlyArray<{
  name: VariableName;
  label: string;
  example: string;
  token: string;
}> = [
  {
    name: "Nome",
    label: "Nome completo",
    example: "João da Silva",
    token: "{Nome}",
  },
  {
    name: "Primeiro Nome",
    label: "Primeiro nome",
    example: "João",
    token: "{Primeiro Nome}",
  },
  {
    name: "Saudação",
    label: "Saudação",
    example: "Bom dia",
    token: "{Saudação}",
  },
  { name: "Hora", label: "Hora atual", example: "14:35", token: "{Hora}" },
] as const;
