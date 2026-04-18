-- Migration: consolidator
-- Criado em: 2026-04-18 · V9 Fase 0 · Sessão S14
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Propósito: RPCs + tabela daily_briefings para o Memory Consolidator Worker.
--
-- Reversibilidade: CREATE OR REPLACE FUNCTION + CREATE TABLE IF NOT EXISTS.
-- Rollback: ver rollback/20260418000000_consolidator.down.sql

-- ============================================================
-- daily_briefings — briefings diários gerados pelo consolidator
-- ============================================================
create table if not exists daily_briefings (
    id           uuid primary key default gen_random_uuid(),
    date         date not null,
    -- null = briefing consolidado multi-business; valor = briefing por negócio
    business_id  text,
    content      text not null,
    metadata     jsonb default '{}'::jsonb,
    created_at   timestamptz default now(),
    constraint uq_daily_briefing unique (date, coalesce(business_id, ''))
);

create index if not exists daily_briefings_date_idx on daily_briefings (date desc);

comment on table daily_briefings is 'S14 — briefings diários gerados pelo Memory Consolidator Worker.';

-- ============================================================
-- get_unprocessed_episodic
--   Retorna episódicos que o consolidator ainda não processou.
--   Filtra por metadata->>'consolidator_processed' IS NULL ou != 'true'.
-- ============================================================
create or replace function get_unprocessed_episodic(p_limit int default 500)
returns setof memory_episodic
language sql stable as $$
    select *
      from memory_episodic
     where (metadata->>'consolidator_processed') is null
        or (metadata->>'consolidator_processed') <> 'true'
     order by created_at asc
     limit p_limit;
$$;

comment on function get_unprocessed_episodic is 'S14 — retorna episódicos não processados pelo consolidator.';

-- ============================================================
-- mark_episodic_processed
--   JSONB merge seguro: não sobrescreve outros campos de metadata.
-- ============================================================
create or replace function mark_episodic_processed(p_ids uuid[])
returns void
language sql as $$
    update memory_episodic
       set metadata = metadata || '{"consolidator_processed": "true"}'::jsonb
     where id = any(p_ids);
$$;

comment on function mark_episodic_processed is 'S14 — merge flag consolidator_processed no metadata (não sobrescreve outros campos).';

-- ============================================================
-- decay_memory_importance
--   Reduz importance de episódicos não acessados há N dias.
--   Usa coalesce(last_accessed, created_at) como referência.
--   Retorna quantas linhas foram atualizadas.
-- ============================================================
create or replace function decay_memory_importance(
    p_decay_factor  real default 0.9,
    p_min_idle_days int  default 30
)
returns int
language sql as $$
    with updated as (
        update memory_episodic
           set importance = greatest(importance * p_decay_factor, 0)
         where coalesce(last_accessed, created_at) < now() - (p_min_idle_days || ' days')::interval
           and importance > 0
        returning 1
    )
    select count(*)::int from updated;
$$;

comment on function decay_memory_importance is 'S14 — decai importance de episódicos ociosos (Art. XXII).';

-- ============================================================
-- cleanup_stale_memories
--   Soft-archive (não DELETE para evitar FK com memory_semantic):
--   seta importance=0 + metadata.archived=true em memórias antigas e pouco importantes.
--   Retorna quantas linhas foram arquivadas.
-- ============================================================
create or replace function cleanup_stale_memories(
    p_min_importance real default 0.05,
    p_min_idle_days  int  default 90
)
returns int
language sql as $$
    with archived as (
        update memory_episodic
           set importance = 0,
               metadata   = metadata || '{"archived": "true"}'::jsonb
         where importance < p_min_importance
           and coalesce(last_accessed, created_at) < now() - (p_min_idle_days || ' days')::interval
           and (metadata->>'archived') is distinct from 'true'
        returning 1
    )
    select count(*)::int from archived;
$$;

comment on function cleanup_stale_memories is 'S14 — soft-archive de memórias obsoletas (importance=0, archived=true). Não deleta para preservar FK.';

-- ============================================================
-- detect_workflow_patterns
--   Detecta sequências de tools_used recorrentes em episódicos bem-sucedidos.
--   Retorna padrões com >= p_min_occurrences ocorrências nos últimos p_since_days dias.
-- ============================================================
create or replace function detect_workflow_patterns(
    p_min_occurrences int default 3,
    p_since_days      int default 30
)
returns table (
    tools_used_pattern jsonb,
    occurrences        int,
    examples           jsonb
)
language sql stable as $$
    with base as (
        select tools_used,
               count(*)::int as cnt,
               jsonb_agg(
                   jsonb_build_object(
                       'id',          id::text,
                       'business_id', business_id,
                       'agent_id',    agent_id,
                       'summary',     summary,
                       'outcome',     outcome,
                       'tools_used',  tools_used,
                       'created_at',  created_at
                   ) order by created_at desc
               ) as examples
          from memory_episodic
         where created_at > now() - (p_since_days || ' days')::interval
           and outcome = 'success'
           and tools_used is not null
           and jsonb_typeof(tools_used) = 'array'
           and jsonb_array_length(tools_used) > 0
         group by tools_used
        having count(*) >= p_min_occurrences
    )
    select tools_used  as tools_used_pattern,
           cnt         as occurrences,
           examples
      from base
     order by cnt desc;
$$;

comment on function detect_workflow_patterns is 'S14 — detecta padrões de workflow recorrentes para registrar em memory_procedural.';

-- ============================================================
-- pg_cron — schedule consolidator jobs
--   Executar APENAS após confirmar vars no Supabase:
--   app.consolidator_url e app.consolidator_token em project settings.
--   Requer extensão pg_cron + pg_net ativas no projeto.
-- ============================================================
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron')
    and exists (select 1 from pg_extension where extname = 'pg_net') then

        -- 02:00 — consolidação noturna (extract + dedupe + decay + detect)
        perform cron.schedule(
            'memory-consolidator-morning',
            '0 2 * * *',
            $sql$
                select net.http_post(
                    url     := current_setting('app.consolidator_url') || '/jobs/morning',
                    headers := jsonb_build_object(
                        'Authorization', 'Bearer ' || current_setting('app.consolidator_token')
                    )
                );
            $sql$
        );

        -- 07:00 — briefing diário para Marcelo
        perform cron.schedule(
            'memory-consolidator-briefing',
            '0 7 * * *',
            $sql$
                select net.http_post(
                    url     := current_setting('app.consolidator_url') || '/jobs/daily-briefing',
                    headers := jsonb_build_object(
                        'Authorization', 'Bearer ' || current_setting('app.consolidator_token')
                    )
                );
            $sql$
        );

        raise notice 'pg_cron: memory-consolidator-morning e memory-consolidator-briefing agendados.';
    else
        raise notice 'pg_cron ou pg_net não disponíveis — cron jobs NÃO agendados. Configurar manualmente.';
    end if;
end;
$$;
