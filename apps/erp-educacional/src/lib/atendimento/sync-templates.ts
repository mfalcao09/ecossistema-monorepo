/**
 * Atendimento — Sync de templates WABA do Meta → Supabase.
 *
 * Extraído de `app/api/atendimento/templates/sync/route.ts` porque Next.js 15
 * App Router só permite exports canônicos (GET/POST/etc/config) em arquivos
 * `route.ts` — funções utilitárias precisam viver em `lib/`.
 *
 * Consumidores:
 *   - `POST/GET /api/atendimento/templates/sync` — manual pelo admin
 *   - `/api/cron/sync-meta-templates` — cron a cada 30min via Vercel (schedule
 *     "0,30 * * * *" no vercel.json)
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAllMetaTemplates,
  mapMetaTemplateToRow,
} from "@/lib/atendimento/meta-templates";
import { loadWabaCredentials } from "@/lib/atendimento/waba-credentials";

export interface SyncResult {
  inbox_id: string;
  fetched: number;
  upserted: number;
  errors: number;
  error_message?: string;
}

export async function syncInboxTemplates(inboxId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  try {
    const creds = await loadWabaCredentials(admin, inboxId);
    const templates = await fetchAllMetaTemplates({
      wabaId: creds.wabaId,
      accessToken: creds.accessToken,
    });

    if (templates.length === 0) {
      return { inbox_id: inboxId, fetched: 0, upserted: 0, errors: 0 };
    }

    const rows = templates.map((t) => mapMetaTemplateToRow(t, inboxId));
    const { error, count } = await admin
      .from("atendimento_whatsapp_templates")
      .upsert(rows, {
        onConflict: "inbox_id,meta_template_id",
        count: "exact",
      });

    if (error) {
      return {
        inbox_id: inboxId,
        fetched: templates.length,
        upserted: 0,
        errors: rows.length,
        error_message: error.message,
      };
    }

    return {
      inbox_id: inboxId,
      fetched: templates.length,
      upserted: count ?? rows.length,
      errors: 0,
    };
  } catch (err) {
    return {
      inbox_id: inboxId,
      fetched: 0,
      upserted: 0,
      errors: 1,
      error_message: err instanceof Error ? err.message : String(err),
    };
  }
}
