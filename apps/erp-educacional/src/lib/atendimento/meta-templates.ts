/**
 * Meta WABA Templates — tipos, mapeamento e cliente HTTP.
 *
 * Sprint S5 — sync bidirecional com Meta Graph API:
 *   GET /{WABA_ID}/message_templates?access_token=...
 *
 * Referência: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

// ───────────────────────────────────────────────────────────────
// Tipos da Meta Graph API (payload bruto)
// ───────────────────────────────────────────────────────────────

export type MetaTemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type MetaTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "DISABLED"
  | "PAUSED";
export type MetaButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
export type MetaHeaderFormat = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

export interface MetaButton {
  type: MetaButtonType;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export type MetaComponent =
  | {
      type: "HEADER";
      format: MetaHeaderFormat;
      text?: string;
      example?: { header_text?: string[]; header_handle?: string[] };
    }
  | {
      type: "BODY";
      text: string;
      example?: { body_text?: string[][] };
    }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: MetaButton[] };

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: MetaTemplateStatus;
  category: MetaTemplateCategory;
  components: MetaComponent[];
  rejected_reason?: string;
  quality_score?: { score: string };
}

export interface MetaTemplatesListResponse {
  data: MetaTemplate[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}

// ───────────────────────────────────────────────────────────────
// Schema DB (linha em atendimento_whatsapp_templates)
// ───────────────────────────────────────────────────────────────

export interface TemplateRow {
  inbox_id: string;
  meta_template_id: string;
  name: string;
  language: string;
  category: MetaTemplateCategory;
  status: MetaTemplateStatus;
  components: MetaComponent[];
  has_buttons: boolean;
  button_type: "QUICK_REPLY" | "CTA" | null;
  header_type: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  rejected_reason: string | null;
  last_synced_at: string;
}

// ───────────────────────────────────────────────────────────────
// Mapeamento Meta → Schema (função pura, testável)
// ───────────────────────────────────────────────────────────────

/**
 * Converte um template da Meta no formato de linha para o Supabase.
 * Infere has_buttons, button_type (QUICK_REPLY xor CTA) e header_type.
 */
export function mapMetaTemplateToRow(
  meta: MetaTemplate,
  inboxId: string,
  now: Date = new Date(),
): TemplateRow {
  const buttonsComponent = meta.components.find(
    (c): c is Extract<MetaComponent, { type: "BUTTONS" }> => c.type === "BUTTONS",
  );
  const headerComponent = meta.components.find(
    (c): c is Extract<MetaComponent, { type: "HEADER" }> => c.type === "HEADER",
  );

  let buttonType: "QUICK_REPLY" | "CTA" | null = null;
  if (buttonsComponent && buttonsComponent.buttons.length > 0) {
    const allQuickReply = buttonsComponent.buttons.every((b) => b.type === "QUICK_REPLY");
    buttonType = allQuickReply ? "QUICK_REPLY" : "CTA";
  }

  let headerType: TemplateRow["header_type"] = null;
  if (headerComponent) {
    const f = headerComponent.format;
    if (f === "TEXT" || f === "IMAGE" || f === "VIDEO" || f === "DOCUMENT") {
      headerType = f;
    }
  }

  return {
    inbox_id: inboxId,
    meta_template_id: meta.id,
    name: meta.name,
    language: meta.language,
    category: meta.category,
    status: meta.status,
    components: meta.components,
    has_buttons: Boolean(buttonsComponent),
    button_type: buttonType,
    header_type: headerType,
    rejected_reason: meta.rejected_reason ?? null,
    last_synced_at: now.toISOString(),
  };
}

// ───────────────────────────────────────────────────────────────
// Cliente HTTP Meta Graph
// ───────────────────────────────────────────────────────────────

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export interface MetaCredentials {
  wabaId: string;
  accessToken: string;
}

/**
 * Busca todos os templates paginando via cursor. Retorna lista flat.
 * Usa fetch nativo — roda tanto em route handler como em cron.
 */
export async function fetchAllMetaTemplates(
  creds: MetaCredentials,
  opts: { limit?: number; fetchFn?: typeof fetch } = {},
): Promise<MetaTemplate[]> {
  const limit = opts.limit ?? 100;
  const doFetch = opts.fetchFn ?? fetch;
  const results: MetaTemplate[] = [];

  let url =
    `${GRAPH_BASE}/${encodeURIComponent(creds.wabaId)}/message_templates` +
    `?limit=${limit}` +
    `&fields=id,name,language,status,category,components,rejected_reason,quality_score`;

  // Meta paga paginação por cursor — limitamos a 20 páginas de segurança
  for (let page = 0; page < 20; page++) {
    const res = await doFetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `[meta-templates] Graph API ${res.status}: ${text.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as MetaTemplatesListResponse;
    if (Array.isArray(json.data)) results.push(...json.data);
    if (!json.paging?.next) break;
    url = json.paging.next;
  }

  return results;
}

// ───────────────────────────────────────────────────────────────
// Extração de variáveis do BODY (ex: "Olá {{1}}") → array de slots
// ───────────────────────────────────────────────────────────────

/**
 * Extrai variáveis `{{n}}` do componente BODY e retorna quantos slots existem.
 * Exemplo: "Olá {{1}}, {{2}}" → 2
 */
export function countTemplateVariables(components: MetaComponent[]): number {
  const body = components.find((c) => c.type === "BODY");
  if (!body || body.type !== "BODY") return 0;
  const matches = body.text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return 0;
  const nums = matches
    .map((m) => Number(m.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length > 0 ? Math.max(...nums) : 0;
}

/**
 * Renderiza o template substituindo {{1}}, {{2}}... pelas variáveis.
 * Uso: preview no grid + validação antes de enviar.
 */
export function renderTemplateBody(
  components: MetaComponent[],
  variables: string[],
): string {
  const body = components.find((c) => c.type === "BODY");
  if (!body || body.type !== "BODY") return "";
  return body.text.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const i = Number(idx) - 1;
    return variables[i] ?? `{{${idx}}}`;
  });
}
