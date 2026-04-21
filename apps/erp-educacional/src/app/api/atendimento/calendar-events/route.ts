/**
 * GET  /api/atendimento/calendar-events?from=&to=   — lista local
 * POST /api/atendimento/calendar-events              — cria evento no Google + local
 *
 * Body POST: { summary, description?, contact_id?, deal_id?, conversation_id?,
 *   start_at, end_at, timezone?, attendees?: string[], create_meet? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/atendimento/google-oauth";

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
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const q = request.nextUrl.searchParams;

  let query = admin
    .from("atendimento_calendar_events")
    .select(
      "id, summary, description, location, start_at, end_at, timezone, meeting_url, attendees, status, " +
        "contact_id, deal_id, conversation_id, google_event_id, created_at",
    )
    .order("start_at", { ascending: true })
    .limit(500);

  const from = q.get("from");
  const to = q.get("to");
  if (from) query = query.gte("start_at", from);
  if (to) query = query.lte("start_at", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const accessToken = await getValidAccessToken(admin, user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "google_not_connected", connect_url: "/api/auth/google/connect" },
      { status: 428 },
    );
  }

  const d = parsed.data;
  const eventBody: Record<string, unknown> = {
    summary: d.summary,
    description: d.description,
    start: { dateTime: d.start_at, timeZone: d.timezone },
    end: { dateTime: d.end_at, timeZone: d.timezone },
    attendees: d.attendees.map((email) => ({ email })),
  };
  if (d.create_meet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `atnd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const googleRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    },
  );

  const googleJson = await googleRes.json().catch(() => ({}));
  if (!googleRes.ok) {
    console.error("[calendar-events] Google API erro", googleRes.status, googleJson);
    return NextResponse.json(
      { error: "google_api_error", status: googleRes.status, google: googleJson },
      { status: 502 },
    );
  }

  const meetingUrl: string | undefined =
    googleJson.hangoutLink ??
    googleJson.conferenceData?.entryPoints?.find(
      (e: { entryPointType?: string }) => e.entryPointType === "video",
    )?.uri;

  const { data: inserted, error: insErr } = await admin
    .from("atendimento_calendar_events")
    .insert({
      summary: d.summary,
      description: d.description,
      google_event_id: googleJson.id,
      google_calendar_id: "primary",
      start_at: d.start_at,
      end_at: d.end_at,
      timezone: d.timezone,
      meeting_url: meetingUrl,
      attendees: d.attendees.map((email) => ({ email, responseStatus: "needsAction" })),
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
  return NextResponse.json({ event: inserted }, { status: 201 });
}
