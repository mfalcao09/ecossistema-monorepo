-- Migration: whatsapp_schema
-- Criado em: 2026-04-19 · ADR-017 · Fase C1
-- DB alvo: Supabase jarvis-pessoal (nasabljhngsxwdcprwme)
-- Referência: docs/adr/017-whatsapp-pairing-baileys-direto.md
--
-- Cria o schema completo da camada WhatsApp pra o gateway Baileys:
-- - whatsapp_instances      — 1 linha por número WhatsApp pareado
-- - whatsapp_auth_state     — credenciais Baileys (creds + keys); RLS service_role only
-- - whatsapp_contacts       — cache de contatos (LID ↔ phone resolver)
-- - whatsapp_chats          — threads
-- - whatsapp_messages       — mensagens inbound/outbound
--
-- Trigger updated_at, RLS por role, publicação Realtime.

-- ============================================================
-- 1. whatsapp_instances
-- ============================================================
create table if not exists whatsapp_instances (
  id                      uuid primary key default gen_random_uuid(),
  label                   text not null,                          -- "Pessoal Marcelo", "Comercial FIC"
  phone_number            text,                                   -- preenchido pós-conexão, E.164 sem '+' (ex: '556781119511')
  status                  text not null default 'pending'
    check (status in ('pending','qr','connecting','connected','disconnected','banned','logged_out')),
  current_qr              text,                                   -- base64 PNG temporário; limpo após connection=open
  current_qr_expires_at   timestamptz,                            -- QR expira ~60s
  disconnect_reason       text,
  last_connected_at       timestamptz,
  last_seen_at            timestamptz,
  metadata                jsonb not null default '{}'::jsonb,     -- user agent, device, tenant hint, etc
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists whatsapp_instances_status_idx
  on whatsapp_instances (status);
create unique index if not exists whatsapp_instances_phone_uidx
  on whatsapp_instances (phone_number) where phone_number is not null;

comment on table  whatsapp_instances is 'Cada linha = 1 número WhatsApp pareado. Baileys abre 1 socket por instância.';
comment on column whatsapp_instances.phone_number
  is 'E.164 sem prefixo + (ex: 556781119511). Preenchido após primeiro connection=open.';
comment on column whatsapp_instances.current_qr
  is 'Base64 PNG do QR atual. Limpo quando status vira connected.';

-- ============================================================
-- 2. whatsapp_auth_state — substitui useMultiFileAuthState do Baileys
-- ============================================================
-- Container Railway é efêmero; filesystem não persiste. Auth state precisa ir no DB.
-- Se essa linha vazar, a conta WhatsApp é comprometida. RLS service_role only.
create table if not exists whatsapp_auth_state (
  instance_id  uuid primary key references whatsapp_instances(id) on delete cascade,
  creds        jsonb,                                              -- noise keys, registration info, me, signed identity
  keys         jsonb not null default '{}'::jsonb,                 -- prekeys, sessions, sender keys, app state sync keys
  updated_at   timestamptz not null default now()
);

comment on table whatsapp_auth_state
  is 'Baileys auth state (creds + keys). Substitui useMultiFileAuthState. RLS service_role-only. Vazamento = conta comprometida.';

-- ============================================================
-- 3. whatsapp_contacts — LID ↔ phone resolver
-- ============================================================
-- Desde 2024 WhatsApp envia remetentes como @lid anonimizado.
-- Gateway resolve via sock.onWhatsApp() e persiste aqui pra lookup O(1).
create table if not exists whatsapp_contacts (
  id                   uuid primary key default gen_random_uuid(),
  instance_id          uuid not null references whatsapp_instances(id) on delete cascade,
  jid                  text not null,                             -- "55X@s.whatsapp.net" ou "107...@lid"
  phone_number         text,                                      -- resolved do LID, se disponível
  name                 text,                                      -- nome do contato (se salvo)
  push_name            text,                                      -- push name que a pessoa setou
  profile_picture_url  text,
  is_business          boolean not null default false,
  last_seen_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (instance_id, jid)
);

create index if not exists whatsapp_contacts_phone_idx
  on whatsapp_contacts (instance_id, phone_number) where phone_number is not null;

-- ============================================================
-- 4. whatsapp_chats — threads
-- ============================================================
create table if not exists whatsapp_chats (
  id                     uuid primary key default gen_random_uuid(),
  instance_id            uuid not null references whatsapp_instances(id) on delete cascade,
  jid                    text not null,
  contact_id             uuid references whatsapp_contacts(id) on delete set null,
  name                   text,                                    -- subject (se grupo) ou nome do contato
  is_group               boolean not null default false,
  last_message_at        timestamptz,
  last_message_preview   text,                                    -- snippet (primeiros 120 chars) pra UI
  unread_count           int not null default 0 check (unread_count >= 0),
  archived               boolean not null default false,
  pinned                 boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (instance_id, jid)
);

create index if not exists whatsapp_chats_last_msg_idx
  on whatsapp_chats (instance_id, last_message_at desc nulls last);

-- ============================================================
-- 5. whatsapp_messages
-- ============================================================
create table if not exists whatsapp_messages (
  id                               uuid primary key default gen_random_uuid(),
  instance_id                      uuid not null references whatsapp_instances(id) on delete cascade,
  chat_id                          uuid not null references whatsapp_chats(id) on delete cascade,
  external_id                      text not null,                 -- msg.key.id do WhatsApp
  direction                        text not null check (direction in ('in','out')),
  from_jid                         text not null,
  to_jid                           text not null,
  kind                             text not null
    check (kind in ('text','image','audio','video','document','sticker','location','contact','reaction','system','unsupported')),
  body                             text,                          -- texto puro ou caption de mídia
  media_url                        text,                          -- Supabase Storage path (bucket privado)
  media_mimetype                   text,
  media_size_bytes                 bigint,
  media_duration_seconds           int,                           -- pra audio/video
  reply_to_external_id             text,                          -- se é reply
  reaction_target_external_id      text,                          -- se é reação (kind='reaction')
  sent_at                          timestamptz not null,          -- msg.messageTimestamp
  status                           text not null default 'received'
    check (status in ('received','sent','delivered','read','failed','error')),
  raw                              jsonb,                         -- payload cru (debug; pode ser podado via job depois)
  created_at                       timestamptz not null default now(),
  unique (instance_id, external_id)
);

create index if not exists whatsapp_messages_chat_sent_idx
  on whatsapp_messages (chat_id, sent_at desc);
create index if not exists whatsapp_messages_instance_sent_idx
  on whatsapp_messages (instance_id, sent_at desc);

comment on column whatsapp_messages.sent_at
  is 'Timestamp da mensagem vindo do WhatsApp (msg.messageTimestamp). Em UTC.';
comment on column whatsapp_messages.raw
  is 'Payload Baileys inteiro. Útil pra debug; pode ser podado por job após 30-90 dias.';

-- ============================================================
-- 6. Trigger genérico updated_at
-- ============================================================
create or replace function _wa_set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists wa_instances_set_updated_at   on whatsapp_instances;
drop trigger if exists wa_auth_state_set_updated_at  on whatsapp_auth_state;
drop trigger if exists wa_contacts_set_updated_at    on whatsapp_contacts;
drop trigger if exists wa_chats_set_updated_at       on whatsapp_chats;

create trigger wa_instances_set_updated_at
  before update on whatsapp_instances
  for each row execute function _wa_set_updated_at();
create trigger wa_auth_state_set_updated_at
  before update on whatsapp_auth_state
  for each row execute function _wa_set_updated_at();
create trigger wa_contacts_set_updated_at
  before update on whatsapp_contacts
  for each row execute function _wa_set_updated_at();
create trigger wa_chats_set_updated_at
  before update on whatsapp_chats
  for each row execute function _wa_set_updated_at();

-- ============================================================
-- 7. RLS
-- ============================================================
-- service_role (gateway backend): full access em tudo
-- authenticated (web inbox logado): read em tudo MENOS auth_state
-- anon: nenhum acesso
alter table whatsapp_instances  enable row level security;
alter table whatsapp_auth_state enable row level security;
alter table whatsapp_contacts   enable row level security;
alter table whatsapp_chats      enable row level security;
alter table whatsapp_messages   enable row level security;

-- service_role ALL
drop policy if exists service_role_all on whatsapp_instances;
create policy service_role_all on whatsapp_instances
  for all to service_role using (true) with check (true);

drop policy if exists service_role_all on whatsapp_auth_state;
create policy service_role_all on whatsapp_auth_state
  for all to service_role using (true) with check (true);

drop policy if exists service_role_all on whatsapp_contacts;
create policy service_role_all on whatsapp_contacts
  for all to service_role using (true) with check (true);

drop policy if exists service_role_all on whatsapp_chats;
create policy service_role_all on whatsapp_chats
  for all to service_role using (true) with check (true);

drop policy if exists service_role_all on whatsapp_messages;
create policy service_role_all on whatsapp_messages
  for all to service_role using (true) with check (true);

-- authenticated SELECT (exceto auth_state)
drop policy if exists authenticated_read on whatsapp_instances;
create policy authenticated_read on whatsapp_instances
  for select to authenticated using (true);

drop policy if exists authenticated_read on whatsapp_contacts;
create policy authenticated_read on whatsapp_contacts
  for select to authenticated using (true);

drop policy if exists authenticated_read on whatsapp_chats;
create policy authenticated_read on whatsapp_chats
  for select to authenticated using (true);

drop policy if exists authenticated_read on whatsapp_messages;
create policy authenticated_read on whatsapp_messages
  for select to authenticated using (true);

-- whatsapp_auth_state: ZERO policy pra authenticated/anon → RLS bloqueia tudo exceto service_role

-- ============================================================
-- 8. Realtime publication
-- ============================================================
-- Web inbox escuta eventos de chats/messages/instances via Realtime.
-- auth_state e contacts NÃO vão pra Realtime (privacidade + ruído).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table whatsapp_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'whatsapp_chats'
  ) then
    alter publication supabase_realtime add table whatsapp_chats;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'whatsapp_instances'
  ) then
    alter publication supabase_realtime add table whatsapp_instances;
  end if;
end$$;
