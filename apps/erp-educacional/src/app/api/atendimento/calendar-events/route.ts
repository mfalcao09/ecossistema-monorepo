/**
 * GET  /api/atendimento/calendar-events?from=&to=   — lista local
 * POST /api/atendimento/calendar-events              — cria evento no Microsoft Graph + local
 *
 * Refactor Etapa 2-B: Google Calendar → Microsoft Graph (app-only).
 * Não há mais fluxo OAuth por-usuário — o ERP chama Graph como o app
 * `ecossistema-agentes-fic` e cria o evento no mailbox do atendente
 * logado (`auth.users.email` = UPN no tenant FIC).
 *
 * Body POST: { summary, description?, contact_id?, deal_id?, conversation_id?,
 *   start_at, end_at, timezone?, attendees?: string[], create_meet? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarEvent } from "@/lib/atendimento/calendar-provider";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const createSchema = z.object({
  summary: z.string().min(1).max(512),
  description: z.string().optional(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
  timezone: z.string().default("America/Campo_Grande"),
  attendees: z.array(z.string().email()).default([]),
  create_meet: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const q = request.nextUrl.searchParams;

  let query = admin
    .from("atendimento_calendar_events")
    .select(
      "id, summary, description, location, start_at, end_at, timezone, meeting_url, attendees, status, " +
        "contact_id, deal_id, conversation_id, provider, provider_event_id, organizer_email, created_at",
    )
    .order("start_at", { ascending: true })
    .limit(500);

  const from = q.get("from");
  const to = q.get("to");
  if (from) query = query.gte("start_at", from);
  if (to) query = query.lte("start_at", to);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // O mailbox do organizador = email do supabase user. Assume que esse email
  // bate com o UPN do usuário no tenant FIC (P-163).
  const organizerEmail = user.email;
  if (!organizerEmail) {
    return NextResponse.json(
      {
        error: "user_without_email",
        message:
          "Usuário logado sem e-mail — não é possível determinar o mailbox M365.",
      },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const admin = createAdminClient();

  let graphEvent: Awaited<ReturnType<typeof createCalendarEvent>>;
  try {
    graphEvent = await createCalendarEvent(organizerEmail, {
      subject: d.summary,
      bodyHtml: d.description,
      startIso: d.start_at,
      endIso: d.end_at,
      timezone: d.timezone,
      attendees: d.attendees.map((email) => ({ email })),
      createOnlineMeeting: d.create_meet,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[calendar-events] Graph API erro organizer=${organizerEmail}: ${msg}`,
    );
    return NextResponse.json(
      { error: "graph_api_error", message: msg },
      { status: 502 },
    );
  }

  const { data: inserted, error: insErr } = await admin
    .from("atendimento_calendar_events")
    .insert({
      summary: d.summary,
      description: d.description,
      provider: "microsoft",
      provider_event_id: graphEvent.id,
      provider_calendar_id: "primary",
      organizer_email: organizerEmail,
      start_at: d.start_at,
      end_at: d.end_at,
      timezone: d.timezone,
      meeting_url: graphEvent.onlineMeetingJoinUrl ?? null,
      attendees: d.attendees.map((email) => ({
        email,
        responseStatus: "needsAction",
      })),
      contact_id: d.contact_id ?? null,
      deal_id: d.deal_id ?? null,
      conversation_id: d.conversation_id ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (insErr) {
    return NextResponse.json(
      { error: "failed_to_save_event", details: insErr.message },
      { status: 500 },
    );
  }
  return NextResponse.json(
    {
      event: inserted,
      graph: { id: graphEvent.id, webLink: graphEvent.webLink },
    },
    { status: 201 },
  );
}
