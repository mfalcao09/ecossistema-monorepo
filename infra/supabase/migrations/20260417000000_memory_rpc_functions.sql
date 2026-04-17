-- Migration: memory_rpc_functions
-- Criado em: 2026-04-17 · Fase 0 Sessão S7 (@ecossistema/memory)
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Propósito: RPCs SQL que o cliente `@ecossistema/memory` usa para
--   dense (pgvector cosine) + sparse (tsvector / ts_rank_cd) retrieval.
--
-- Reversibilidade: somente CREATE OR REPLACE FUNCTION. Nada é dropado.
-- Rollback: ver `rollback/20260417000000_memory_rpc_functions.down.sql`.

-- ============================================================================
-- match_memory_episodic
-- ============================================================================
create or replace function match_memory_episodic(
  p_query_embedding vector(768),
  p_query_text      text,
  p_business_id     text,
  p_agent_id        text,
  p_user_id         text default null,
  p_tier_types      text[] default null,      -- optional: ['task','conversation',...]
  p_k               int default 30
)
returns table (
  id            uuid,
  business_id   text,
  agent_id      text,
  user_id       text,
  type          text,
  outcome       text,
  summary       text,
  detail        text,
  entities      jsonb,
  tools_used    jsonb,
  files_touched jsonb,
  metadata      jsonb,
  importance    real,
  access_count  int,
  created_at    timestamptz,
  dense_score   real,
  sparse_score  real
)
language sql stable as $$
  with dense as (
    select m.id,
           case when p_query_embedding is null or m.summary_vec is null
                then 0::real
                else (1 - (m.summary_vec <=> p_query_embedding))::real
           end as score
      from memory_episodic m
     where m.business_id = p_business_id
       and m.agent_id    = p_agent_id
       and (p_user_id is null or m.user_id is null or m.user_id = p_user_id)
       and (p_tier_types is null or m.type = any(p_tier_types))
     order by case when p_query_embedding is null then 0 else m.summary_vec <=> p_query_embedding end
     limit p_k
  ),
  sparse as (
    select m.id,
           coalesce(ts_rank_cd(m.tsv, plainto_tsquery('portuguese', p_query_text)), 0)::real as score
      from memory_episodic m
     where m.business_id = p_business_id
       and m.agent_id    = p_agent_id
       and (p_user_id is null or m.user_id is null or m.user_id = p_user_id)
       and (p_tier_types is null or m.type = any(p_tier_types))
       and (p_query_text is not null
            and m.tsv @@ plainto_tsquery('portuguese', p_query_text))
     order by score desc
     limit p_k
  ),
  candidates as (
    select id from dense union select id from sparse
  )
  select m.id, m.business_id, m.agent_id, m.user_id, m.type, m.outcome,
         m.summary, m.detail, m.entities, m.tools_used, m.files_touched,
         m.metadata, m.importance, m.access_count, m.created_at,
         coalesce(d.score, 0)::real as dense_score,
         coalesce(s.score, 0)::real as sparse_score
    from candidates c
    join memory_episodic m on m.id = c.id
    left join dense d on d.id = c.id
    left join sparse s on s.id = c.id;
$$;

-- ============================================================================
-- match_memory_semantic
-- ============================================================================
create or replace function match_memory_semantic(
  p_query_embedding vector(768),
  p_query_text      text,
  p_business_id     text,
  p_agent_id        text,
  p_user_id         text default null,
  p_only_valid      boolean default true,
  p_k               int default 30
)
returns table (
  id               uuid,
  business_id      text,
  agent_id         text,
  user_id          text,
  subject          text,
  predicate        text,
  object           text,
  natural_language text,
  confidence       real,
  valid_from       timestamptz,
  valid_until      timestamptz,
  metadata         jsonb,
  created_at       timestamptz,
  dense_score      real,
  sparse_score     real
)
language sql stable as $$
  with base as (
    select m.*
      from memory_semantic m
     where m.business_id = p_business_id
       and m.agent_id    = p_agent_id
       and (p_user_id is null or m.user_id is null or m.user_id = p_user_id)
       and (not p_only_valid or m.valid_until is null)
  ),
  dense as (
    select b.id,
           case when p_query_embedding is null or b.nl_vec is null
                then 0::real
                else (1 - (b.nl_vec <=> p_query_embedding))::real
           end as score
      from base b
     order by case when p_query_embedding is null then 0 else b.nl_vec <=> p_query_embedding end
     limit p_k
  ),
  sparse as (
    select b.id,
           coalesce(ts_rank_cd(
             to_tsvector('portuguese', coalesce(b.natural_language, '')),
             plainto_tsquery('portuguese', p_query_text)
           ), 0)::real as score
      from base b
     where (p_query_text is not null
            and to_tsvector('portuguese', coalesce(b.natural_language, ''))
                @@ plainto_tsquery('portuguese', p_query_text))
     order by score desc
     limit p_k
  ),
  candidates as (
    select id from dense union select id from sparse
  )
  select m.id, m.business_id, m.agent_id, m.user_id,
         m.subject, m.predicate, m.object, m.natural_language,
         m.confidence, m.valid_from, m.valid_until,
         m.metadata, m.created_at,
         coalesce(d.score, 0)::real as dense_score,
         coalesce(s.score, 0)::real as sparse_score
    from candidates c
    join memory_semantic m on m.id = c.id
    left join dense d on d.id = c.id
    left join sparse s on s.id = c.id;
$$;

-- ============================================================================
-- match_memory_procedural
-- ============================================================================
create or replace function match_memory_procedural(
  p_query_embedding vector(768),
  p_query_text      text,
  p_business_id     text,
  p_agent_id        text,
  p_k               int default 30
)
returns table (
  id             uuid,
  business_id    text,
  agent_id       text,
  name           text,
  description    text,
  steps          jsonb,
  tags           text[],
  success_count  int,
  failure_count  int,
  version        int,
  created_at     timestamptz,
  dense_score    real,
  sparse_score   real
)
language sql stable as $$
  with base as (
    select m.*
      from memory_procedural m
     where m.business_id = p_business_id
       and m.agent_id    = p_agent_id
  ),
  dense as (
    select b.id,
           case when p_query_embedding is null or b.desc_vec is null
                then 0::real
                else (1 - (b.desc_vec <=> p_query_embedding))::real
           end as score
      from base b
     order by case when p_query_embedding is null then 0 else b.desc_vec <=> p_query_embedding end
     limit p_k
  ),
  sparse as (
    select b.id,
           coalesce(ts_rank_cd(
             to_tsvector('portuguese', coalesce(b.name, '') || ' ' || coalesce(b.description, '')),
             plainto_tsquery('portuguese', p_query_text)
           ), 0)::real as score
      from base b
     where (p_query_text is not null
            and to_tsvector('portuguese', coalesce(b.name, '') || ' ' || coalesce(b.description, ''))
                @@ plainto_tsquery('portuguese', p_query_text))
     order by score desc
     limit p_k
  ),
  candidates as (
    select id from dense union select id from sparse
  )
  select m.id, m.business_id, m.agent_id, m.name, m.description,
         m.steps, m.tags, m.success_count, m.failure_count, m.version, m.created_at,
         coalesce(d.score, 0)::real as dense_score,
         coalesce(s.score, 0)::real as sparse_score
    from candidates c
    join memory_procedural m on m.id = c.id
    left join dense d on d.id = c.id
    left join sparse s on s.id = c.id;
$$;

-- ============================================================================
-- memory_episodic_bump_access
--   helper para incrementar access_count + last_accessed quando um hit é servido
-- ============================================================================
create or replace function memory_episodic_bump_access(p_ids uuid[])
returns void
language sql as $$
  update memory_episodic
     set access_count = access_count + 1,
         last_accessed = now()
   where id = any(p_ids);
$$;

comment on function match_memory_episodic      is 'V9 §32 — hybrid retrieval (dense+sparse) para memory_episodic. Cliente TS faz RRF.';
comment on function match_memory_semantic      is 'V9 §32 — hybrid retrieval (dense+sparse) para memory_semantic. p_only_valid filtra supersedidos.';
comment on function match_memory_procedural    is 'V9 §32 — hybrid retrieval (dense+sparse) para memory_procedural.';
comment on function memory_episodic_bump_access is 'V9 §40 — incrementa access_count/last_accessed dos hits servidos.';
