/**
 * Utilitários compartilhados pelos hooks.
 *
 * - hashPayload: SHA-256 determinístico para LGPD-safe audit (Art. IV)
 * - createApprovalRequest: insere em `approval_requests` (Art. II)
 * - writeAuditLog: insere em `audit_log` (Art. IV)
 * - checkBudget: consulta LiteLLM proxy (Art. XII)
 * - isIrreversible / isFinancial / parseAmountFromInput: classificadores
 * - makeIdempotencyKey: determinístico por (agent, tool, input, dia) — Art. III
 * - getSupabase: lazy singleton via env vars (override-able em testes)
 */

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalRequest,
  AuditEntry,
  HooksSupabase,
  LiteLLMBudgetClient,
} from "./types.js";

// -----------------------------------------------------------------------------
// Classificadores
// -----------------------------------------------------------------------------

export const IRREVERSIVEIS: ReadonlySet<string> = new Set([
  "deletar_dados_aluno",
  "assinar_contrato",
  "cancelar_matricula",
  "rotacionar_credencial_prod",
]);

export const ACOES_CRITICAS_FINANCEIRAS: ReadonlySet<string> = new Set([
  "emitir_boleto_massa",
  "pix_transferencia",
  "pagamento_fornecedor",
  "rotacionar_credencial_prod",
  "assinar_contrato",
  "deletar_dados_aluno",
  "atualizar_status_matricula_massa",
]);

export function isIrreversible(tool_name: string): boolean {
  return IRREVERSIVEIS.has(tool_name);
}

export function isFinancial(tool_name: string): boolean {
  return ACOES_CRITICAS_FINANCEIRAS.has(tool_name);
}

/**
 * Extrai valor monetário do input. Olha em `valor`, `amount`, `total_brl`.
 * Retorna null quando não há valor claramente definido.
 */
export function parseAmountFromInput(input: unknown): number | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  for (const key of ["valor", "amount", "total_brl", "valor_brl"]) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Number(v.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Hashing (Art. IV — LGPD-safe)
// -----------------------------------------------------------------------------

/**
 * SHA-256 determinístico. Objetos são serializados com chaves ordenadas pra
 * evitar hashes diferentes pro mesmo payload.
 */
export function hashPayload(obj: unknown): string {
  const canonical = canonicalize(obj);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// -----------------------------------------------------------------------------
// Idempotency key (Art. III)
// -----------------------------------------------------------------------------

export function makeIdempotencyKey(args: {
  agent_id: string;
  tool_name: string;
  tool_input: unknown;
  date?: Date;
}): string {
  const d = args.date ?? new Date();
  const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return hashPayload({
    agent_id: args.agent_id,
    tool_name: args.tool_name,
    tool_input: args.tool_input,
    day,
  });
}

// -----------------------------------------------------------------------------
// Supabase client (env-driven, mockable)
// -----------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;
let _supabaseOverride: HooksSupabase | null = null;

/**
 * Permite override do client em testes. Passe `null` pra resetar.
 */
export function setSupabaseClient(client: HooksSupabase | null): void {
  _supabaseOverride = client;
  _supabase = null;
}

export function getSupabase(): HooksSupabase {
  if (_supabaseOverride) return _supabaseOverride;
  if (_supabase) return _supabase as unknown as HooksSupabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[constitutional-hooks] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (ou use setSupabaseClient em testes)",
    );
  }
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase as unknown as HooksSupabase;
}

// -----------------------------------------------------------------------------
// Approval requests (Art. II)
// -----------------------------------------------------------------------------

export async function createApprovalRequest(req: ApprovalRequest): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("approval_requests").insert({
    ...req,
    created_at: new Date().toISOString(),
  });
  if (error) {
    // Falha explícita (Art. IX): não silenciamos erros de escrita
    throw new Error(`[art-ii] falha ao criar approval_request: ${JSON.stringify(error)}`);
  }
}

// -----------------------------------------------------------------------------
// Audit log (Art. IV) — append-only
// -----------------------------------------------------------------------------

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("audit_log").insert(entry);
  if (error) {
    // Auditoria não pode ser silenciosa, mas também não pode bloquear ação
    // do agente. Jogamos no console.error — D-Governanca monitora.
    // eslint-disable-next-line no-console
    console.error("[art-iv] falha ao gravar audit_log", { entry, error });
  }
}

// -----------------------------------------------------------------------------
// Budget (Art. XII) — via LiteLLM proxy
// -----------------------------------------------------------------------------

let _liteLLM: LiteLLMBudgetClient | null = null;

export function setLiteLLMClient(client: LiteLLMBudgetClient | null): void {
  _liteLLM = client;
}

export function getLiteLLMClient(): LiteLLMBudgetClient {
  if (_liteLLM) return _liteLLM;
  // Default: HTTP simples contra LITELLM_PROXY_URL. Endpoint esperado:
  // GET {url}/budget/{business_id} → { remaining_usd: number }
  _liteLLM = {
    async getRemainingBudgetUSD(business_id: string) {
      const base = process.env.LITELLM_PROXY_URL;
      if (!base) {
        throw new Error("[art-xii] LITELLM_PROXY_URL não configurado");
      }
      const res = await fetch(`${base}/budget/${encodeURIComponent(business_id)}`, {
        headers: process.env.LITELLM_MASTER_KEY
          ? { Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}` }
          : {},
      });
      if (!res.ok) {
        throw new Error(`[art-xii] LiteLLM budget check falhou: ${res.status}`);
      }
      const data = (await res.json()) as { remaining_usd?: number };
      if (typeof data.remaining_usd !== "number") {
        throw new Error("[art-xii] resposta LiteLLM sem remaining_usd");
      }
      return data.remaining_usd;
    },
  };
  return _liteLLM;
}

/**
 * Estima custo USD de uma chamada LLM. Heurística grosseira — suficiente
 * pra decidir bloqueio preventivo. Refina em S5 (LiteLLM).
 */
export function estimateLLMCostUSD(args: {
  model: string;
  tokens_expected: number;
}): number {
  // Preço médio ponderado por 1M tokens (USD) — input+output combinados.
  // Fontes (2026-04): anthropic.com/pricing + litellm price sheet.
  const PRICE_PER_M_TOKENS: Record<string, number> = {
    "claude-opus-4-6": 30,
    "claude-sonnet-4-6": 6,
    "claude-haiku-4-5": 1.5,
    "gpt-4o": 10,
    "gpt-4o-mini": 0.6,
  };
  const price = PRICE_PER_M_TOKENS[args.model] ?? 10; // default conservador
  return (args.tokens_expected / 1_000_000) * price;
}

// -----------------------------------------------------------------------------
// Path matchers (Art. XIV — Dual-Write)
// -----------------------------------------------------------------------------

/**
 * Retorna true se o path deve ser redirecionado pro Supabase em vez de
 * escrito em disco. Baseado no briefing S01 spec do Art. XIV.
 */
export function isDualWritePath(path: string): boolean {
  const p = path.replaceAll("\\", "/");
  return (
    /\/memory\/.+\.md$/.test(p) ||
    /\/secrets\//.test(p) ||
    /\/credentials\//.test(p) ||
    /\/tasks\/.+\.md$/.test(p) ||
    /\/sessions\/.+\.md$/.test(p)
  );
}

// -----------------------------------------------------------------------------
// Bash blocklist (Art. XIX) — cópia literal do briefing (phantom-style)
// -----------------------------------------------------------------------------

/**
 * Blocklist de comandos bash. Baseada na curada do phantom (briefing S01 § Art. XIX).
 *
 * Divergência documentada: o regex original `/dd\s+of=\/dev\//` só captura
 * `dd of=/dev/...` sem argumentos intermediários, perdendo o padrão mais
 * comum `dd if=X of=/dev/Y`. Ajustado para `/\bdd\b[^;|&\n]*\bof=\/dev\//`.
 */
export const BASH_BLOCKLIST: ReadonlyArray<RegExp> = [
  /rm\s+-rf\s+\//,
  /mkfs/,
  /\bdd\b[^;|&\n]*\bof=\/dev\//,
  /git\s+push\s+--force\s+(origin\s+)?(main|master)/,
  /docker\s+(compose\s+)?down\b.*--volumes/,
  /systemctl\s+stop\s+(supabase|railway|postgres)/,
  /kill\s+-9\s+1\b/,
  />\s*\/dev\/sda/,
  /curl.*\|\s*(sh|bash)/,
];

export function matchBashBlocklist(command: string): RegExp | null {
  for (const re of BASH_BLOCKLIST) {
    if (re.test(command)) return re;
  }
  return null;
}
