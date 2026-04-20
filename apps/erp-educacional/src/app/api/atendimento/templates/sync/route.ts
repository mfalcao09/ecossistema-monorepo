/**
 * POST /api/atendimento/templates/sync
 * GET  /api/atendimento/templates/sync  (conveniência para chamar do browser)
 *
 * Dispara sync de templates WABA → Supabase para todos os inboxes WhatsApp
 * habilitados, ou para um inbox específico via ?inbox_id=...
 *
 * Resposta:
 *   { ok, synced_inboxes, totals: { fetched, upserted, skipped, errors } }
 *
 * Autenticação: sessão Supabase (usuário logado no ERP).
 * O worker cron chama `syncInboxTemplates()` via rota interna (/api/cron/sync-meta-templates).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
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

async function handler(request: NextRequest) {
  // Autenticação via sessão (usuário admin logado)
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const inboxIdParam = request.nextUrl.searchParams.get("inbox_id");
  const admin = createAdminClient();

  let inboxIds: string[];
  if (inboxIdParam) {
    inboxIds = [inboxIdParam];
  } else {
    const { data, error } = await admin
      .from("atendimento_inboxes")
      .select("id")
      .eq("channel_type", "whatsapp")
      .eq("enabled", true);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    inboxIds = (data ?? []).map((r) => r.id);
  }

  const results = await Promise.all(inboxIds.map(syncInboxTemplates));

  const totals = results.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      upserted: acc.upserted + r.upserted,
      errors: acc.errors + r.errors,
    }),
    { fetched: 0, upserted: 0, errors: 0 },
  );

  return NextResponse.json({
    ok: totals.errors === 0,
    synced_inboxes: results,
    totals,
  });
}

export const GET = handler;
export const POST = handler;
