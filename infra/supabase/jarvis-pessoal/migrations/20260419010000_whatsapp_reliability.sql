-- Migration: whatsapp_reliability
-- Criado em: 2026-04-19 · Fase C3 — defesas de estabilidade
-- DB alvo: Supabase jarvis-pessoal (nasabljhngsxwdcprwme)
-- Referência: docs/adr/017-whatsapp-pairing-baileys-direto.md
--
-- 3 tabelas novas:
--   - whatsapp_auth_state_snapshots : snapshots rolantes pra rollback em caso de corrupção
--   - whatsapp_outbound_queue       : fila durável de msgs outbound (não perde se offline)
--   - whatsapp_health_checks        : histórico de heartbeat/canary/socket_ping
-- 1 RPC: whatsapp_prune_auth_snapshots — limpa snapshots antigos (manter N mais recentes)

-- ============================================================
-- 1. whatsapp_auth_state_snapshots
-- ============================================================
create table if not exists whatsapp_auth_state_snapshots (
  id           uuid primary key default gen_random_uuid(),
  instance_id  uuid not null references whatsapp_instances(id) on delete cascade,
  creds        jsonb,
  keys         jsonb not null default '{}'::jsonb,
  reason       text not null check (reason in ('periodic','pre_reconnect','manual','pre_update')),
  created_at   timestamptz not null default now()
);

create index if not exists wa_auth_snapshots_instance_created_idx
  on whatsapp_auth_state_snapshots (instance_id, created_at desc);

comment on table whatsapp_auth_state_snapshots
  is 'Snapshot rolante do auth_state. Usado pra rollback se update corrompe. Manter no máximo 3 por instância via cleanup job.';

-- ============================================================
-- 2. whatsapp_outbound_queue
-- ============================================================
create table if not exists whatsapp_outbound_queue (
  id               uuid primary key default gen_random_uuid(),
  instance_id      uuid not null references whatsapp_instances(id) on delete cascade,
  payload          jsonb not null,
  status           text not null default 'pending'
    check (status in ('pending','processing','sent','failed','dead')),
  attempts         int not null default 0 check (attempts >= 0),
  max_attempts     int not null default 5,
  last_error       text,
  next_attempt_at  timestamptz not null default now(),
  sent_message_id  uuid references whatsapp_messages(id) on delete set null,
  priority         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists wa_outbound_pending_idx
  on whatsapp_outbound_queue (instance_id, next_attempt_at, priority desc)
  where status in ('pending','processing');

create index if not exists wa_outbound_status_idx
  on whatsapp_outbound_queue (status);

comment on table whatsapp_outbound_queue
  is 'Fila durável de mensagens outbound. Worker drena em background com backoff exponencial.';

-- ============================================================
-- 3. whatsapp_health_checks
-- ============================================================
create table if not exists whatsapp_health_checks (
  id           uuid primary key default gen_random_uuid(),
  instance_id  uuid not null references whatsapp_instances(id) on delete cascade,
  kind         text not null check (kind in ('heartbeat','canary','socket_ping','reconnect')),
  success      boolean not null,
  latency_ms   int,
  details      jsonb,
  checked_at   timestamptz not null default now()
);

create index if not exists wa_health_instance_checked_idx
  on whatsapp_health_checks (instance_id, checked_at desc);
create index if not exists wa_health_kind_success_idx
  on whatsapp_health_checks (kind, success, checked_at desc);

comment on table whatsapp_health_checks
  is 'Heartbeat=a cada 60s; canary=msg pra si mesmo /1h mede ACK; socket_ping=WS ping /30s; reconnect=log de tentativa.';

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================
drop trigger if exists wa_outbound_queue_set_updated_at on whatsapp_outbound_queue;
create trigger wa_outbound_queue_set_updated_at
  before update on whatsapp_outbound_queue
  for each row execute function _wa_set_updated_at();

-- ============================================================
-- 5. RLS
-- ============================================================
alter table whatsapp_auth_state_snapshots enable row level security;
alter table whatsapp_outbound_queue       enable row level security;
alter table whatsapp_health_checks        enable row level security;

drop policy if exists service_role_all on whatsapp_auth_state_snapshots;
create policy service_role_all on whatsapp_auth_state_snapshots
  for all to service_role using (true) with check (true);

drop policy if exists service_role_all on whatsapp_outbound_queue;
create policy service_role_all on whatsapp_outbound_queue
  for all to service_role using (true) with check (true);

drop policy if exists service_role_all on whatsapp_health_checks;
create policy service_role_all on whatsapp_health_checks
  for all to service_role using (true) with check (true);

-- auth_state_snapshots: ZERO policy pra authenticated/anon (secret)
drop policy if exists authenticated_read on whatsapp_outbound_queue;
create policy authenticated_read on whatsapp_outbound_queue
  for select to authenticated using (true);

drop policy if exists authenticated_read on whatsapp_health_checks;
create policy authenticated_read on whatsapp_health_checks
  for select to authenticated using (true);

-- ============================================================
-- 6. Realtime
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and tablename='whatsapp_outbound_queue'
  ) then
    alter publication supabase_realtime add table whatsapp_outbound_queue;
  end if;
end$$;

-- ============================================================
-- 7. RPC cleanup
-- ============================================================
create or replace function whatsapp_prune_auth_snapshots(p_keep int default 3)
returns int
language plpgsql
security definer
as $$
declare
  v_deleted int;
begin
  with ranked as (
    select id,
           row_number() over (partition by instance_id order by created_at desc) as rn
      from whatsapp_auth_state_snapshots
  )
  delete from whatsapp_auth_state_snapshots
   where id in (select id from ranked where rn > p_keep);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function whatsapp_prune_auth_snapshots(int) from public, anon, authenticated;
grant execute on function whatsapp_prune_auth_snapshots(int) to service_role;
