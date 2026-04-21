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
import { syncInboxTemplates } from "@/lib/atendimento/sync-templates";

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
