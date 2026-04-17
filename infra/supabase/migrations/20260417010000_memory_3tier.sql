-- Migration: memory_3tier (Episodic / Semantic / Procedural)
-- Criado em: 2026-04-17 · V9 Fase 0 · Sessão S04
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Referência: MASTERPLAN-V9 Parte XI §40 + briefing S04
--
-- NOTA: triggers de auto-embedding NÃO são criados aqui.
-- A EF `embed-on-insert` atual só aceita `ecosystem_memory`.
-- S07 (Memory package) / S08 (Edge Functions) adicionam triggers
-- depois que a EF for generalizada para aceitar {table, id, fields}.

-- ============================================================
-- Extensões
-- ============================================================
create extension if not exists vector;      -- nome correto da extensão pgvector
create extension if not exists pg_trgm;     -- trigram (BM25 complementar)

-- ============================================================
-- MEMORY_EPISODIC — tasks, conversations, outcomes (named vectors)
-- ============================================================
create table if not exists memory_episodic (
    id              uuid primary key default gen_random_uuid(),
    business_id     text not null,
    agent_id        text not null,
    user_id         text,
    run_id          uuid,
    parent_id       uuid references memory_episodic(id),
    type            text not null check (type in ('task','conversation','decision','incident')),
    outcome         text check (outcome in ('success','failure','partial','in_progress')),
    summary         text not null,
    detail          text,
    summary_vec     vector(768),
    detail_vec      vector(768),
    tsv             tsvector generated always as (
                      to_tsvector('portuguese',
                        coalesce(summary, '') || ' ' || coalesce(detail, ''))
                    ) stored,
    entities        jsonb default '[]'::jsonb,
    tools_used      jsonb default '[]'::jsonb,
    files_touched   jsonb default '[]'::jsonb,
    metadata        jsonb default '{}'::jsonb,
    importance      real default 0.5 check (importance >= 0 and importance <= 1),
    access_count    int default 0,
    started_at      timestamptz default now(),
    ended_at        timestamptz,
    last_accessed   timestamptz,
    created_at      timestamptz default now()
);

create index if not exists mem_episodic_summary_vec_idx on memory_episodic
  using ivfflat (summary_vec vector_cosine_ops) with (lists = 100);
create index if not exists mem_episodic_detail_vec_idx on memory_episodic
  using ivfflat (detail_vec vector_cosine_ops) with (lists = 100);
create index if not exists mem_episodic_tsv_idx on memory_episodic using gin(tsv);
create index if not exists mem_episodic_scope_idx on memory_episodic (business_id, agent_id, user_id, type);
create index if not exists mem_episodic_run_idx on memory_episodic (run_id);
create index if not exists mem_episodic_importance_idx on memory_episodic (importance desc, last_accessed desc);
create index if not exists mem_episodic_entities_idx on memory_episodic using gin(entities);

-- ============================================================
-- MEMORY_SEMANTIC — atomic facts (subject/predicate/object)
-- ============================================================
create table if not exists memory_semantic (
    id                   uuid primary key default gen_random_uuid(),
    business_id          text not null,
    agent_id             text not null,
    user_id              text,
    subject              text not null,
    predicate            text not null,
    object               text not null,
    natural_language     text not null,
    nl_vec               vector(768),
    confidence           real default 1.0 check (confidence >= 0 and confidence <= 1),
    source_episodic_id   uuid references memory_episodic(id),
    supersedes_id        uuid references memory_semantic(id),
    valid_from           timestamptz default now(),
    valid_until          timestamptz,
    metadata             jsonb default '{}'::jsonb,
    created_at           timestamptz default now(),
    constraint uq_sem_fact unique (business_id, agent_id, user_id, subject, predicate, valid_from)
);

create index if not exists mem_semantic_nl_vec_idx on memory_semantic
  using ivfflat (nl_vec vector_cosine_ops) with (lists = 50);
create index if not exists mem_semantic_scope_idx on memory_semantic (business_id, agent_id, user_id);
create index if not exists mem_semantic_subject_idx on memory_semantic (subject);
create index if not exists mem_semantic_valid_idx on memory_semantic (valid_until) where valid_until is null;

-- ============================================================
-- MEMORY_PROCEDURAL — workflows + outcome tracking
-- ============================================================
create table if not exists memory_procedural (
    id               uuid primary key default gen_random_uuid(),
    business_id      text not null,
    agent_id         text not null,
    name             text not null,
    description      text,
    steps            jsonb not null,
    preconditions    jsonb default '[]'::jsonb,
    postconditions  jsonb default '[]'::jsonb,
    desc_vec         vector(768),
    success_count    int default 0,
    failure_count    int default 0,
    last_success     timestamptz,
    last_failure     timestamptz,
    tags             text[] default '{}',
    version          int default 1,
    supersedes_id    uuid references memory_procedural(id),
    created_at       timestamptz default now(),
    updated_at       timestamptz default now(),
    constraint uq_proc_name unique (business_id, agent_id, name, version)
);

create index if not exists mem_procedural_desc_vec_idx on memory_procedural
  using ivfflat (desc_vec vector_cosine_ops) with (lists = 30);
create index if not exists mem_procedural_tags_idx on memory_procedural using gin(tags);
create index if not exists mem_procedural_scope_idx on memory_procedural (business_id, agent_id);

-- ============================================================
-- RLS — business isolation (MP-04 + SC-09)
-- ============================================================
alter table memory_episodic   enable row level security;
alter table memory_semantic   enable row level security;
alter table memory_procedural enable row level security;

create policy mem_ep_business_isolation on memory_episodic
  using (
    business_id = current_setting('app.current_business', true)
    or current_setting('app.is_ecosystem_admin', true) = 'true'
  );

create policy mem_sem_business_isolation on memory_semantic
  using (
    business_id = current_setting('app.current_business', true)
    or current_setting('app.is_ecosystem_admin', true) = 'true'
  );

create policy mem_proc_business_isolation on memory_procedural
  using (
    business_id = current_setting('app.current_business', true)
    or current_setting('app.is_ecosystem_admin', true) = 'true'
  );

-- service_role bypassa sempre
create policy mem_ep_service_role   on memory_episodic   for all to service_role using (true) with check (true);
create policy mem_sem_service_role  on memory_semantic   for all to service_role using (true) with check (true);
create policy mem_proc_service_role on memory_procedural for all to service_role using (true) with check (true);

-- ============================================================
-- updated_at trigger (só em memory_procedural — única com updated_at)
-- ============================================================
create or replace function update_memory_procedural_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_memory_procedural_updated
  before update on memory_procedural
  for each row execute function update_memory_procedural_updated_at();

comment on table memory_episodic   is 'V9 §40 — Episodic: tasks, conversations, decisions com named vectors. Art. XXII.';
comment on table memory_semantic   is 'V9 §40 — Semantic: atomic facts com versioning. supersedes_id resolve contradições.';
comment on table memory_procedural is 'V9 §40 — Procedural: workflows com outcome tracking.';
