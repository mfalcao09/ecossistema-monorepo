/**
 * Helpers do S7 — dashboards, relatórios e widgets externos.
 *
 * - Feature flag global + tipos canônicos (Widget, MetricKey, ReportType).
 * - JWT short-lived (HMAC-SHA256) para iframes externos sem depender de libs extras.
 * - Sanitização de range de datas (default 30 dias, max 365).
 */

import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────────
export function dashboardsEnabled(): boolean {
  // Se a env não estiver definida, default é ligado em dev e desligado em prod.
  const v = process.env.ATENDIMENTO_DASHBOARDS_ENABLED;
  if (v === undefined) return process.env.NODE_ENV !== "production";
  return v === "1" || v.toLowerCase() === "true";
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas conhecidas (as que o RPC compute_daily_metrics produz)
// ─────────────────────────────────────────────────────────────────────────────
export const METRIC_KEYS = [
  "conversations_opened",
  "conversations_closed",
  "conversations_pending",
  "conversations_snoozed",
  "conversations_open_end",
  "messages_in",
  "messages_out",
  "templates_sent",
  "avg_first_response_sec",
  "p50_first_response_sec",
  "p90_first_response_sec",
  "avg_resolution_sec",
  "p50_resolution_sec",
  "p90_resolution_sec",
  "deals_created",
  "deals_won",
  "deals_lost",
  "deals_value_won_cents",
  "deals_value_lost_cents",
  "conversion_rate_bp",
  "leads_by_source",
  "volume_by_inbox",
  "active_agents",
  "avg_conversations_per_agent",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const REPORT_TYPES = [
  "volume",
  "sla",
  "funnel",
  "agent_performance",
  "lead_origin",
  "custom",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const WIDGET_TYPES = [
  "kpi_card",
  "line_chart",
  "bar_chart",
  "pie_chart",
  "funnel",
  "table",
  "heatmap",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export function isMetricKey(v: unknown): v is MetricKey {
  return typeof v === "string" && (METRIC_KEYS as readonly string[]).includes(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Range de datas
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeRange(
  fromStr: string | null,
  toStr: string | null,
  fallbackDays = 30,
): { from: string; to: string; days: number } {
  const today = new Date();
  const to = toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)
    ? new Date(toStr + "T00:00:00Z")
    : today;
  const from = fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr)
    ? new Date(fromStr + "T00:00:00Z")
    : new Date(to.getTime() - fallbackDays * 86400000);
  const clampedFrom = from > to ? to : from;
  const maxRange = 365;
  const days = Math.min(
    Math.max(
      1,
      Math.round((to.getTime() - clampedFrom.getTime()) / 86400000) + 1,
    ),
    maxRange,
  );
  const finalFrom = new Date(to.getTime() - (days - 1) * 86400000);
  return {
    from: finalFrom.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    days,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT compacto (HMAC-SHA256) — sem deps adicionais
// -----------------------------------------------------------------------------
// Payload mínimo: { widget_id, exp (epoch s), iat }.
// ─────────────────────────────────────────────────────────────────────────────
const ENC = "base64url" as const;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString(ENC);
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, ENC);
}

function getJwtSecret(): string {
  const s =
    process.env.ATENDIMENTO_WIDGET_JWT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!s) throw new Error("ATENDIMENTO_WIDGET_JWT_SECRET ausente");
  return s;
}

export interface WidgetTokenPayload {
  widget_id: string;
  iat: number;
  exp: number;
  iss?: string;
}

export function signWidgetToken(
  widgetId: string,
  ttlSeconds: number,
): { token: string; hash: string; payload: WidgetTokenPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: WidgetTokenPayload = {
    widget_id: widgetId,
    iat: now,
    exp: now + Math.min(Math.max(ttlSeconds, 60), 86400 * 30),
    iss: "atendimento-s7",
  };
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput =
    b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", getJwtSecret())
    .update(signingInput)
    .digest();
  const token = signingInput + "." + b64url(sig);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash, payload };
}

export function verifyWidgetToken(token: string): WidgetTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto
    .createHmac("sha256", getJwtSecret())
    .update(h + "." + p)
    .digest();
  const given = b64urlDecode(s);
  if (expected.length !== given.length) return null;
  if (!crypto.timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(p).toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    if (typeof parsed.widget_id !== "string") return null;
    return parsed as WidgetTokenPayload;
  } catch {
    return null;
  }
}

export function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatadores pt-BR
// ─────────────────────────────────────────────────────────────────────────────
export function formatSeconds(secs: number | null | undefined): string {
  if (secs === null || secs === undefined) return "—";
  if (secs < 60) return `${Math.round(secs)} s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatCentsBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatBP(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return "—";
  return `${(bp / 100).toFixed(2)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV helper
// ─────────────────────────────────────────────────────────────────────────────
export function toCSV(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return header + "\n" + body;
}
