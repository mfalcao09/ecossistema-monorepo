-- Migration: skills_registry
-- Criado em: 2026-04-17 · V9 Fase 0 · Sessão S04
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Referência: MASTERPLAN-V9 Parte XII (packages/skills-registry) + briefing S04

create table if not exists skills_registry (
    id              uuid primary key default gen_random_uuid(),
    business_id     text not null default 'ecosystem',
    name            text not null,
    version         text not null default '1.0.0',
    description     text not null,
    tags            text[] default '{}',
    input_schema    jsonb,
    output_schema   jsonb,
    tool_refs       jsonb default '[]'::jsonb,
    author          text,
    markdown_path   text,
    is_active       boolean default true,
    usage_count     bigint default 0,
    last_used_at    timestamptz,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now(),
    constraint uq_skill_name_version unique (business_id, name, version)
);

create index if not exists skills_tags_idx     on skills_registry using gin(tags);
create index if not exists skills_name_idx     on skills_registry (name);
create index if not exists skills_business_idx on skills_registry (business_id, is_active);

-- RLS
alter table skills_registry enable row level security;

create policy skills_read_all      on skills_registry for select using (true);
create policy skills_service_role  on skills_registry for all to service_role using (true) with check (true);
create policy skills_write_admin   on skills_registry for insert
  with check (current_setting('app.is_ecosystem_admin', true) = 'true');
create policy skills_update_admin  on skills_registry for update
  using (current_setting('app.is_ecosystem_admin', true) = 'true')
  with check (current_setting('app.is_ecosystem_admin', true) = 'true');

-- updated_at trigger
create or replace function update_skills_registry_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_skills_registry_updated
  before update on skills_registry
  for each row execute function update_skills_registry_updated_at();

-- ============================================================
-- Seed: skills Instagram já existentes em anthropic-skills
-- ============================================================
insert into skills_registry (name, description, tags, author) values
  ('lead-miner',       'Coleta e qualificação de leads Instagram',           array['instagram','leads','marketing'],       'marcelo'),
  ('sales-strategist', 'Estratégia comercial para vendas Instagram',         array['instagram','sales','marketing'],       'marcelo'),
  ('trend-hunter',     'Descoberta de tendências com potencial engajamento', array['instagram','content','marketing'],     'marcelo'),
  ('true-copywriter',  'Escrita persuasiva para conversão digital',          array['copywriting','marketing'],             'marcelo')
on conflict (business_id, name, version) do nothing;

comment on table skills_registry is
  'V9 Parte XII — Registry central de skills. Descobrimento por tags e matching por input_schema.';
