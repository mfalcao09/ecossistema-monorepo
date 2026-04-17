-- Migration: ecosystem_credentials v2 (ACL + V9 schema alignment)
-- Criado em: 2026-04-17 · V9 Fase 0 · Sessão S04
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Referência: MASTERPLAN-V9 Parte VII §22 + briefing S04
--
-- Nota: o schema em produção diverge do briefing original.
-- Este migration ADICIONA as colunas V9 (project, environment, provider, acl,
-- rate_limit, proxy_only, last_used_at, usage_count), faz backfill dos
-- 7 registros existentes e substitui unique(name) por unique(name, project, environment).

-- ============================================================
-- 1. Adiciona colunas novas (nullable inicialmente)
-- ============================================================
alter table ecosystem_credentials
  add column if not exists project      text,
  add column if not exists environment  text,
  add column if not exists provider     text,
  add column if not exists acl          jsonb not null default '[]'::jsonb,
  add column if not exists rate_limit   jsonb default '{"rpm": 60, "rph": 1000}'::jsonb,
  add column if not exists proxy_only   boolean default false,
  add column if not exists last_used_at timestamptz,
  add column if not exists usage_count  bigint default 0;

-- ============================================================
-- 2. Backfill (regra combinada com Marcelo em 2026-04-17)
--    - provider  := service
--    - environment := 'prod' (todas as 7 são de produção)
--    - project   := scope (com 'erp' → 'fic')
-- ============================================================
update ecosystem_credentials
   set provider    = coalesce(provider, service),
       environment = coalesce(environment, 'prod'),
       project     = coalesce(project,
                              case when scope = 'erp' then 'fic' else scope end)
 where provider is null or environment is null or project is null;

-- ============================================================
-- 3. Seed ACL default para credenciais existentes (sem ACL ainda)
-- ============================================================
update ecosystem_credentials
   set acl = jsonb_build_array(
       jsonb_build_object(
         'agent_pattern', project || '-*',
         'allowed_scopes', array['read','proxy']
       )
     )
 where acl = '[]'::jsonb;

-- ============================================================
-- 4. Enforce NOT NULL após backfill
-- ============================================================
alter table ecosystem_credentials
  alter column project set not null,
  alter column environment set not null,
  alter column provider set not null,
  alter column environment set default 'prod';

-- ============================================================
-- 5. Swap unique constraint: unique(name) → unique(name, project, environment)
-- ============================================================
do $$
declare
  old_uq text;
begin
  -- descobre nome do unique antigo em (name)
  select conname into old_uq
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
   where r.relname = 'ecosystem_credentials'
     and c.contype = 'u'
     and array_length(c.conkey, 1) = 1;
  if old_uq is not null then
    execute format('alter table ecosystem_credentials drop constraint %I', old_uq);
  end if;
end$$;

alter table ecosystem_credentials
  add constraint uq_cred_name_project_env unique (name, project, environment);

-- ============================================================
-- 6. Upgrade credential_access_log (campos V9 Modo A/B)
-- ============================================================
alter table credential_access_log
  add column if not exists project      text,
  add column if not exists mode         text default 'A' check (mode in ('A','B')),
  add column if not exists api_endpoint text,
  add column if not exists latency_ms   int,
  add column if not exists cost_usd     numeric(10,6),
  add column if not exists metadata     jsonb default '{}'::jsonb,
  add column if not exists reason       text;

-- Expande CHECK de action para incluir 'proxy', 'denied', 'revoke'
alter table credential_access_log drop constraint if exists credential_access_log_action_check;
alter table credential_access_log
  add constraint credential_access_log_action_check
  check (action in ('read','proxy','rotate','create','deactivate','update','denied','revoke'));

-- ============================================================
-- 7. Trigger append-only (MP-08 + Art. IV)
-- ============================================================
create or replace function prevent_credential_log_mutation()
returns trigger as $$
begin
    raise exception 'credential_access_log é append-only (Art. IV + MP-08)';
end;
$$ language plpgsql;

drop trigger if exists credential_log_no_update on credential_access_log;
drop trigger if exists credential_log_no_delete on credential_access_log;

create trigger credential_log_no_update
  before update on credential_access_log
  for each row execute function prevent_credential_log_mutation();

create trigger credential_log_no_delete
  before delete on credential_access_log
  for each row execute function prevent_credential_log_mutation();

-- ============================================================
-- 8. Índices novos
-- ============================================================
create index if not exists ec_project_env_idx on ecosystem_credentials (project, environment);
create index if not exists ec_provider_idx    on ecosystem_credentials (provider);
create index if not exists cal_project_idx    on credential_access_log (project, accessed_at desc);
create index if not exists cal_mode_idx       on credential_access_log (mode);

comment on column ecosystem_credentials.project     is 'V9 §22: ecosystem|fic|klesis|intentus|splendori|nexvy';
comment on column ecosystem_credentials.environment is 'V9 §22: prod|staging|dev';
comment on column ecosystem_credentials.provider    is 'V9 §22: inter|bry|anthropic|openrouter|gemini|stripe|supabase|github|internal|...';
comment on column ecosystem_credentials.acl         is 'V9 §22: [{agent_pattern, allowed_scopes}] — lista de agentes autorizados';
comment on column ecosystem_credentials.proxy_only  is 'V9 §21: se true, força Modo B (proxy). Agente nunca recebe secret.';
