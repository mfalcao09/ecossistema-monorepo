/**
 * calendar-provider.ts — Etapa 2-B
 *
 * Wrapper semântico para criação/atualização/remoção de eventos de
 * calendário via Microsoft Graph app-only.
 *
 * Mailbox alvo é sempre explícito (parâmetro `organizerEmail`) — o ERP
 * identifica o atendente logado via `auth.users.email` e cria o evento
 * no calendário dele. Requer que o email do Supabase bata com o UPN do
 * usuário no tenant FIC (ver P-163).
 *
 * Online meetings: criados automaticamente como Teams meeting
 * (`onlineMeetingProvider: 'teamsForBusiness'`) quando `createOnlineMeeting`
 * for true — substitui o Google Meet do fluxo antigo.
 *
 * Graph docs: https://learn.microsoft.com/graph/api/user-post-events
 */

import "server-only";
import { getGraphClient } from "./microsoft-graph-client";

export interface CalendarAttendee {
  email: string;
  name?: string;
  type?: "required" | "optional";
}

export interface CreateCalendarEventInput {
  subject: string;
  bodyHtml?: string;
  /** ISO-8601 com offset (ex: "2026-04-23T14:00:00-04:00") */
  startIso: string;
  /** ISO-8601 com offset */
  endIso: string;
  /** IANA timezone (ex: "America/Campo_Grande") */
  timezone: string;
  location?: string;
  attendees?: CalendarAttendee[];
  createOnlineMeeting?: boolean;
}

export interface CalendarEventResult {
  /** Graph event id */
  id: string;
  /** Link para abrir no OWA/Outlook */
  webLink?: string;
  /** URL pra entrar na reunião Teams (se online) */
  onlineMeetingJoinUrl?: string;
}

/**
 * Cria evento no calendário do `organizerEmail` via Graph.
 *
 * @param organizerEmail UPN/email do atendente (mailbox do tenant FIC)
 * @param input         dados do evento
 */
export async function createCalendarEvent(
  organizerEmail: string,
  input: CreateCalendarEventInput,
): Promise<CalendarEventResult> {
  const client = await getGraphClient();

  const body: Record<string, unknown> = {
    subject: input.subject,
    start: { dateTime: input.startIso, timeZone: input.timezone },
    end: { dateTime: input.endIso, timeZone: input.timezone },
  };

  if (input.bodyHtml) {
    body.body = { contentType: "HTML", content: input.bodyHtml };
  }
  if (input.location) {
    body.location = { displayName: input.location };
  }
  if (input.attendees && input.attendees.length > 0) {
    body.attendees = input.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name },
      type: a.type ?? "required",
    }));
  }
  if (input.createOnlineMeeting) {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = "teamsForBusiness";
  }

  interface GraphEventResponse {
    id: string;
    webLink?: string;
    onlineMeeting?: { joinUrl?: string };
  }

  const res = (await client
    .api(`/users/${encodeURIComponent(organizerEmail)}/events`)
    .post(body)) as GraphEventResponse;

  return {
    id: res.id,
    webLink: res.webLink,
    onlineMeetingJoinUrl: res.onlineMeeting?.joinUrl,
  };
}

/**
 * Remove evento do calendário do organizador. Idempotente: 404 é engolido.
 */
export async function deleteCalendarEvent(
  organizerEmail: string,
  eventId: string,
): Promise<void> {
  const client = await getGraphClient();
  try {
    await client
      .api(
        `/users/${encodeURIComponent(organizerEmail)}/events/${encodeURIComponent(eventId)}`,
      )
      .delete();
  } catch (err) {
    // 404 = já foi deletado. Outras falhas propagam.
    const maybeStatus = (err as { statusCode?: number })?.statusCode;
    if (maybeStatus !== 404) throw err;
  }
}

export interface UpdateCalendarEventInput {
  subject?: string;
  bodyHtml?: string;
  startIso?: string;
  endIso?: string;
  timezone?: string;
  location?: string;
}

/**
 * Atualiza campos parciais de um evento. Body omite campos não informados.
 */
export async function updateCalendarEvent(
  organizerEmail: string,
  eventId: string,
  patch: UpdateCalendarEventInput,
): Promise<void> {
  const client = await getGraphClient();
  const body: Record<string, unknown> = {};

  if (patch.subject !== undefined) body.subject = patch.subject;
  if (patch.bodyHtml !== undefined) {
    body.body = { contentType: "HTML", content: patch.bodyHtml };
  }
  if (patch.location !== undefined) {
    body.location = { displayName: patch.location };
  }
  if (patch.startIso && patch.timezone) {
    body.start = { dateTime: patch.startIso, timeZone: patch.timezone };
  }
  if (patch.endIso && patch.timezone) {
    body.end = { dateTime: patch.endIso, timeZone: patch.timezone };
  }

  if (Object.keys(body).length === 0) return;

  await client
    .api(
      `/users/${encodeURIComponent(organizerEmail)}/events/${encodeURIComponent(eventId)}`,
    )
    .patch(body);
}
