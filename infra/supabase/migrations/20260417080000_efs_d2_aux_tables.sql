-- ===============================================================
-- S8 EFs Dia 2 — tabelas auxiliares para webhook-hardening + dual-write
-- Complementa S4 (que cobriu memory_3tier, credentials_v2, skills_registry, audit_log).
-- Estas tabelas são escopo natural das 5 EFs deployadas em S8.
-- ===============================================================

-- ---------------------------------------------------------------
-- webhook_targets — onde encaminhar cada provider após hardening
-- ---------------------------------------------------------------
create table if not exists webhook_targets (
    provider        text primary key,       -- 'inter'|'bry'|'stripe'|'evolution'|...
    target_url      text not null,          -- endpoint interno (EF, Railway, etc.)
    secret_key      text,                   -- nome da credential em ecosystem_credentials para HMAC
    signature_header text not null default 'x-signature',  -- header onde o provider envia a assinatura
    hmac_algo       text not null default 'sha256' check (hmac_algo in ('sha256','sha1','sha512')),
    rate_limit_rpm  int not null default 100,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    metadata        jsonb not null default '{}'::jsonb
);
comment on table webhook_targets is 'SC-10: configuração por provider para webhook-hardening EF.';

-- ---------------------------------------------------------------
-- webhook_idempotency — body hashes vistos nas últimas 24h
-- ---------------------------------------------------------------
create table if not exists webhook_idempotency (
    provider        text not null,
    body_hash       text not null,          -- sha256 hex
    first_seen_at   timestamptz not null default now(),
    expires_at      timestamptz not null default (now() + interval '24 hours'),
    status          text not null default 'processed' check (status in ('processed','forwarded','ignored')),
    target_status   int,
    primary key (provider, body_hash)
);
create index if not exists webhook_idempotency_expires_idx on webhook_idempotency (expires_at);
comment on table webhook_idempotency is 'SC-10: deduplicação de webhooks por (provider, body_hash) em 24h.';

-- ---------------------------------------------------------------
-- rate_limit_buckets — contadores por chave (provider+ip ou agent+credential)
-- ---------------------------------------------------------------
create table if not exists rate_limit_buckets (
    bucket_key      text not null,          -- 'webhook:inter:1.2.3.4' | 'cred:INTER_CLIENT_ID:cfo-fic'
    window_start    timestamptz not null,   -- truncado ao minuto ou à hora
    window_kind     text not null check (window_kind in ('rpm','rph','rpd')),
    count           int not null default 0,
    limit_value     int not null,
    primary key (bucket_key, window_kind, window_start)
);
create index if not exists rate_limit_buckets_gc_idx on rate_limit_buckets (window_start);
comment on table rate_limit_buckets is 'SC-10 + SC-29: rate limiting leve via tabela (não requer Redis).';

-- RPC atomic increment + check
create or replace function rate_limit_hit(
    p_key text,
    p_kind text,
    p_window_start timestamptz,
    p_limit int
) returns boolean
language plpgsql
as $$
declare
    v_count int;
begin
    insert into rate_limit_buckets (bucket_key, window_kind, window_start, count, limit_value)
    values (p_key, p_kind, p_window_start, 1, p_limit)
    on conflict (bucket_key, window_kind, window_start)
    do update set count = rate_limit_buckets.count + 1
    returning count into v_count;

    return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------
-- dual_write_log — registro de writes idempotentes (SC-03)
-- ---------------------------------------------------------------
create table if not exists dual_write_log (
    idempotency_key text primary key,       -- sha256 do payload normalizado
    pipeline_id     text not null,
    primary_project text not null,
    primary_table   text not null,
    mirror_project  text,
    mirror_table    text,
    primary_status  text not null check (primary_status in ('ok','fail')),
    mirror_status   text check (mirror_status in ('ok','fail','queued','skipped')),
    primary_error   text,
    mirror_error    text,
    started_at      timestamptz not null default now(),
    completed_at    timestamptz
);
create index if not exists dual_write_log_pipeline_idx on dual_write_log (pipeline_id, started_at desc);
comment on table dual_write_log is 'SC-03: audit idempotente de dual-write. Key TTL natural: 24h via policy externa.';

-- ---------------------------------------------------------------
-- dual_write_queue — mirrors pendentes de retry (on_mirror_failure=queue)
-- ---------------------------------------------------------------
create table if not exists dual_write_queue (
    id              uuid primary key default gen_random_uuid(),
    idempotency_key text not null references dual_write_log(idempotency_key),
    pipeline_id     text not null,
    mirror_project  text not null,
    mirror_table    text not null,
    mirror_op       text not null check (mirror_op in ('insert','upsert','update','delete')),
    mirror_payload  jsonb not null,
    attempts        int not null default 0,
    last_error      text,
    next_attempt_at timestamptz not null default (now() + interval '1 minute'),
    status          text not null default 'pending' check (status in ('pending','processing','done','failed')),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists dual_write_queue_next_idx on dual_write_queue (status, next_attempt_at) where status in ('pending','processing');
comment on table dual_write_queue is 'SC-03: fila de retry para mirror writes que falharam.';

-- ---------------------------------------------------------------
-- RLS: todas service-role apenas (EFs usam service key)
-- ---------------------------------------------------------------
alter table webhook_targets enable row level security;
alter table webhook_idempotency enable row level security;
alter table rate_limit_buckets enable row level security;
alter table dual_write_log enable row level security;
alter table dual_write_queue enable row level security;

-- Policies vazias = negam tudo menos service_role (bypass RLS)
-- EFs sempre usam SUPABASE_SERVICE_ROLE_KEY internamente.

-- ---------------------------------------------------------------
-- RPC: vault secret read helper (service-role only via EF)
-- ---------------------------------------------------------------
-- Lê vault.decrypted_secrets via função SECURITY DEFINER.
-- Só service_role pode invocar.
create or replace function get_vault_secret_by_key(p_key text)
returns text
language plpgsql
security definer
set search_path = vault, public
as $$
declare
    v_value text;
begin
    select decrypted_secret into v_value
    from vault.decrypted_secrets
    where name = p_key
    limit 1;
    return v_value;
end;
$$;

revoke all on function get_vault_secret_by_key(text) from public, anon, authenticated;
grant execute on function get_vault_secret_by_key(text) to service_role;

-- ---------------------------------------------------------------
-- RPC: skills_registry full-text matcher
-- ---------------------------------------------------------------
create or replace function match_skills_fts(
    q   text,
    biz text,
    lim int default 5
)
returns table (
    id          uuid,
    business_id text,
    name        text,
    version     text,
    description text,
    tags        text[],
    input_schema jsonb,
    output_schema jsonb,
    tool_refs   jsonb,
    markdown_path text,
    score       real
)
language sql
stable
as $$
    select
        s.id, s.business_id, s.name, s.version, s.description, s.tags,
        s.input_schema, s.output_schema, s.tool_refs, s.markdown_path,
        ts_rank_cd(
            to_tsvector('portuguese',
                coalesce(s.name,'') || ' ' ||
                coalesce(s.description,'') || ' ' ||
                coalesce(array_to_string(s.tags, ' '),'')
            ),
            plainto_tsquery('portuguese', q)
        )::real as score
    from skills_registry s
    where s.is_active
      and s.business_id in (biz, 'ecosystem')
      and (
        to_tsvector('portuguese',
            coalesce(s.name,'') || ' ' ||
            coalesce(s.description,'') || ' ' ||
            coalesce(array_to_string(s.tags, ' '),'')
        ) @@ plainto_tsquery('portuguese', q)
        or s.tags && string_to_array(lower(q), ' ')
      )
    order by score desc nulls last, s.usage_count desc
    limit lim;
$$;

grant execute on function match_skills_fts(text, text, int) to service_role, authenticated;

-- ---------------------------------------------------------------
-- GC job (pg_cron) — limpar rate_limit_buckets e webhook_idempotency expirados
-- Idempotente: drop + recreate
-- ---------------------------------------------------------------
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        if exists (select 1 from cron.job where jobname = 'gc_rate_limit_buckets') then
            perform cron.unschedule('gc_rate_limit_buckets');
        end if;
        if exists (select 1 from cron.job where jobname = 'gc_webhook_idempotency') then
            perform cron.unschedule('gc_webhook_idempotency');
        end if;
        perform cron.schedule('gc_rate_limit_buckets', '*/10 * * * *',
            $gc$delete from rate_limit_buckets where window_start < now() - interval '2 hours';$gc$);
        perform cron.schedule('gc_webhook_idempotency', '0 * * * *',
            $gc$delete from webhook_idempotency where expires_at < now();$gc$);
    end if;
end $$;
