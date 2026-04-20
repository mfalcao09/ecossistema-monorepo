-- ============================================================================
-- idempotency_cache — cache genérico usado por @ecossistema/billing e outros
-- packages. Separado de webhook_idempotency (SC-10) porque aquele é estrito de
-- dedupe HTTP de webhooks; aqui é idempotência semântica (ex.: mesmo aluno +
-- mesmo mesRef = mesmo boleto).
-- F1-S02 (Fase 1) — docs/sessions/BRIEFING-SESSAO-D-billing.md
-- ============================================================================

create table if not exists idempotency_cache (
    key         text primary key,
    result      jsonb not null,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null
);

create index if not exists idempotency_cache_expires_idx
    on idempotency_cache (expires_at);

comment on table idempotency_cache is
    'F1-S02: cache de idempotência semântica (ex.: boleto:alunoId:mesRef). Service-role only.';

-- RLS: apenas service_role (as EFs e o orchestrator usam service key).
alter table idempotency_cache enable row level security;

-- Nenhuma policy pública = default deny para authenticated/anon; service_role
-- faz bypass de RLS por padrão.

-- GC via pg_cron — roda 1x/hora removendo entradas expiradas.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        if exists (select 1 from cron.job where jobname = 'gc_idempotency_cache') then
            perform cron.unschedule('gc_idempotency_cache');
        end if;
        perform cron.schedule('gc_idempotency_cache', '15 * * * *',
            $gc$delete from idempotency_cache where expires_at < now();$gc$);
    end if;
end $$;
