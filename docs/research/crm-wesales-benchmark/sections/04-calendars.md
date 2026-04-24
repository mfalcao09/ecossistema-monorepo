# 04 — Calendars

**URL:** `/calendars/view`

## Subnav

- **Calendar View** (active) — `/calendars/view`
- **Appointment List View** — `/calendars/appointments`
- **Calendar Settings** (CTA)

## Estado capturado
Conta sem calendários configurados → main area vazia; no-data state esperado.

## CTAs detectados
- `Go to Calendar Settings`

## Observações
- Sidebar renderizou com **tema escuro** aqui vs. tema claro no dashboard — provável que Calendars use skin diferente ou que o usuário fez toggle de tema entre navegações.
- Sem iframes (rendering nativo na SPA).

## Features inferidas (GHL-based)
- [x] Calendar View (month/week/day)
- [x] Appointment List View (lista tabular)
- [x] Calendar Settings (tipos de calendário: Round Robin, Class, Service, Collective, Personal, Event)
- [x] Integrations com Google Calendar / Outlook (padrão GHL)
- [x] Team calendars (shared)
- [x] Booking pages públicas (padrão GHL)

## Gap
- Se conta estivesse populada: filtros por staff, tipos de appointment, booking widgets
- Requer piloto com dados pra fidelidade total
