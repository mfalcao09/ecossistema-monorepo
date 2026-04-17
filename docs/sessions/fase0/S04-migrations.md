# S4 ⭐ — Migrations Coordenadas (slot DB do Dia 1)

**Sessão:** S04 · **Dia:** 1 · **Worktree:** `eco-migrations-d1` · **Branch:** `feature/migrations-d1`
**Duração estimada:** 1 dia (6-8h) · **Dependências:** nenhuma
**Slot bloqueante:** ⚠️ **Slot de DB do Dia 1 — nenhuma outra sessão pode aplicar migration em ECOSYSTEM hoje**

**Bloqueia ou destrava:**
- Destrava S7 (Memory package), S8 (Edge Functions), S11 (C-Suite templates — usa skills_registry)
- Bloqueia demais sessões de escrever DDL no ECOSYSTEM hoje

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte XI** (Modelo de Dados), **Parte VII** (SC-29 schema), **Parte VIII § 32** (pgvector 3-tier)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — seções mem0 e phantom (schemas)
3. `research-repos/phantom/src/memory/episodic.ts`, `semantic.ts`, `procedural.ts` — schemas de referência
4. `research-repos/mem0/mem0/memory/storage.py` — SQLiteManager (pattern, adaptar para Postgres)
5. Supabase Vault docs: tabelas `vault.secrets`, `vault.decrypted_secrets`
6. Histórico: últimas migrations já aplicadas em `infra/supabase/migrations/` (não conflitar)

---

## Objetivo

Aplicar 4 migrations canônicas no Supabase **ECOSYSTEM** (`gqckbunsfjgerbuiyzvn`) via MCP Supabase, com rollback scripts e seeds prontos.

---

## Migrations a aplicar

### 1. `20260416010000_memory_3tier.sql` — pgvector 3-tier

**Tabelas:** `memory_episodic`, `memory_semantic`, `memory_procedural`

```sql
-- Extensão
create extension if not exists vector;
create extension if not exists pg_trgm;  -- trigram para BM25 complementar

-- ===============================================================
-- MEMORY_EPISODIC — tasks, conversations, outcomes com named vectors
-- ===============================================================
create table if not exists memory_episodic (
    id              uuid primary key default gen_random_uuid(),
    business_id     text not null,           -- 'ecosystem'|'fic'|'klesis'|'intentus'|'splendori'|'nexvy'
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

create index mem_episodic_summary_vec_idx on memory_episodic 
  using ivfflat (summary_vec vector_cosine_ops) with (lists = 100);
create index mem_episodic_detail_vec_idx on memory_episodic 
  using ivfflat (detail_vec vector_cosine_ops) with (lists = 100);
create index mem_episodic_tsv_idx on memory_episodic using gin(tsv);
create index mem_episodic_scope_idx on memory_episodic (business_id, agent_id, user_id, type);
create index mem_episodic_run_idx on memory_episodic (run_id);
create index mem_episodic_importance_idx on memory_episodic (importance desc, last_accessed desc);
create index mem_episodic_entities_idx on memory_episodic using gin(entities);

-- ===============================================================
-- MEMORY_SEMANTIC — atomic facts (subject/predicate/object)
-- ===============================================================
create table if not exists memory_semantic (
    id                   uuid primary key default gen_random_uuid(),
    business_id          text not null,
    agent_id             text not null,
    user_id              text,
    subject              text not null,
    predicate            text not null,
    object               text not null,
    natural_language     text not null,      -- formulação em PT-BR
    nl_vec               vector(768),
    confidence           real default 1.0 check (confidence >= 0 and confidence <= 1),
    source_episodic_id   uuid references memory_episodic(id),
    supersedes_id        uuid references memory_semantic(id),  -- versioning (contradiction resolution)
    valid_from           timestamptz default now(),
    valid_until          timestamptz,        -- null = ainda válido
    metadata             jsonb default '{}'::jsonb,
    created_at           timestamptz default now(),
    constraint uq_sem_fact unique (business_id, agent_id, user_id, subject, predicate, valid_from)
);

create index mem_semantic_nl_vec_idx on memory_semantic
  using ivfflat (nl_vec vector_cosine_ops) with (lists = 50);
create index mem_semantic_scope_idx on memory_semantic (business_id, agent_id, user_id);
create index mem_semantic_subject_idx on memory_semantic (subject);
create index mem_semantic_valid_idx on memory_semantic (valid_until) where valid_until is null;

-- ===============================================================
-- MEMORY_PROCEDURAL — workflows com outcome tracking
-- ===============================================================
create table if not exists memory_procedural (
    id               uuid primary key default gen_random_uuid(),
    business_id      text not null,
    agent_id         text not null,
    name             text not null,
    description      text,
    steps            jsonb not null,         -- [{tool, input_schema, expected_output, retry_policy}, ...]
    preconditions    jsonb default '[]'::jsonb,
    postconditions   jsonb default '[]'::jsonb,
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

create index mem_procedural_desc_vec_idx on memory_procedural
  using ivfflat (desc_vec vector_cosine_ops) with (lists = 30);
create index mem_procedural_tags_idx on memory_procedural using gin(tags);
create index mem_procedural_scope_idx on memory_procedural (business_id, agent_id);

-- ===============================================================
-- RLS — isolation cross-business (MP-04 + SC-09)
-- ===============================================================
alter table memory_episodic enable row level security;
alter table memory_semantic enable row level security;
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

-- ===============================================================
-- Trigger auto-embedding (Fase B canônica — usa pg_net + Edge Function)
-- ===============================================================
create or replace function trigger_embed_memory()
returns trigger as $$
begin
    perform net.http_post(
        url := current_setting('app.embedding_edge_function_url'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
            'table', tg_table_name,
            'id', new.id,
            'fields', case tg_table_name
                when 'memory_episodic'  then jsonb_build_object('summary', new.summary, 'detail', new.detail)
                when 'memory_semantic'  then jsonb_build_object('natural_language', new.natural_language)
                when 'memory_procedural' then jsonb_build_object('description', new.description)
            end
        )
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger embed_episodic_insert after insert on memory_episodic
  for each row execute function trigger_embed_memory();
create trigger embed_semantic_insert after insert on memory_semantic
  for each row execute function trigger_embed_memory();
create trigger embed_procedural_insert after insert on memory_procedural
  for each row execute function trigger_embed_memory();
```

### 2. `20260416020000_ecosystem_credentials_v2_acl.sql`

Upgrade da tabela `ecosystem_credentials` existente (de s094) para SC-29 v2:

```sql
-- Adiciona ACL granular + rate_limit
alter table ecosystem_credentials
  add column if not exists acl jsonb not null default '[]'::jsonb,  -- lista de agent_ids autorizados
  add column if not exists rate_limit jsonb default '{"rpm": 60, "rph": 1000}'::jsonb,
  add column if not exists proxy_only boolean default false,  -- força Modo B
  add column if not exists last_used_at timestamptz,
  add column if not exists usage_count bigint default 0;

-- Seed ACL default para credenciais existentes
update ecosystem_credentials
  set acl = jsonb_build_array(
    jsonb_build_object(
      'agent_pattern', project || '-*',
      'allowed_scopes', array['read','proxy']
    )
  )
  where acl = '[]'::jsonb;

-- Refatora credential_access_log adicionando campos V9
alter table credential_access_log
  add column if not exists mode text default 'A' check (mode in ('A','B')),  -- Modo A/B
  add column if not exists api_endpoint text,   -- endpoint chamado (Modo B)
  add column if not exists latency_ms int,
  add column if not exists cost_usd numeric(10,6);

-- Trigger append-only (reafirma MP-08)
create or replace function prevent_credential_log_mutation()
returns trigger as $$
begin
    raise exception 'credential_access_log é append-only (Art. IV + MP-08)';
end;
$$ language plpgsql;

drop trigger if exists credential_log_no_update on credential_access_log;
drop trigger if exists credential_log_no_delete on credential_access_log;
create trigger credential_log_no_update before update on credential_access_log
    for each row execute function prevent_credential_log_mutation();
create trigger credential_log_no_delete before delete on credential_access_log
    for each row execute function prevent_credential_log_mutation();
```

### 3. `20260416030000_skills_registry.sql`

```sql
create table if not exists skills_registry (
    id              uuid primary key default gen_random_uuid(),
    business_id     text not null default 'ecosystem',
    name            text not null,              -- 'bank-boleto-emissao'
    version         text not null default '1.0.0',
    description     text not null,
    tags            text[] default '{}',
    input_schema    jsonb,                      -- JSON Schema validável por Art. XVIII
    output_schema   jsonb,
    tool_refs       jsonb default '[]'::jsonb,  -- tools que a skill consome
    author          text,
    markdown_path   text,                       -- ex: 'skills/bank-boleto-emissao/SKILL.md'
    is_active       boolean default true,
    usage_count     bigint default 0,
    last_used_at    timestamptz,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now(),
    constraint uq_skill_name_version unique (business_id, name, version)
);

create index skills_tags_idx on skills_registry using gin(tags);
create index skills_name_idx on skills_registry (name);
create index skills_business_idx on skills_registry (business_id, is_active);

-- RLS
alter table skills_registry enable row level security;
create policy skills_read_all on skills_registry for select using (true);
create policy skills_write_admin on skills_registry for all
  using (current_setting('app.is_ecosystem_admin', true) = 'true');

-- Seed com skills já existentes (Anthropic Skills Instagram)
insert into skills_registry (name, description, tags, author) values
  ('lead-miner',       'Coleta e qualificação de leads Instagram',          array['instagram','leads','marketing'], 'marcelo'),
  ('sales-strategist', 'Estratégia comercial para vendas Instagram',        array['instagram','sales','marketing'], 'marcelo'),
  ('trend-hunter',     'Descoberta de tendências com potencial engajamento', array['instagram','content','marketing'], 'marcelo'),
  ('true-copywriter',  'Escrita persuasiva para conversão digital',          array['copywriting','marketing'], 'marcelo')
on conflict (business_id, name, version) do nothing;
```

### 4. `20260416040000_audit_log_v9.sql`

Upgrade da `audit_log` existente:

```sql
-- Caso não exista, criar; caso exista, upgrade
create table if not exists audit_log (
    id              bigserial primary key,
    business_id     text not null default 'ecosystem',
    agent_id        text not null,
    user_id         text,
    run_id          uuid,
    trace_id        text,                        -- OTel trace correlation
    tool_name       text,
    action          text not null,               -- 'tool_call'|'decision'|'handoff'|'violation'
    tool_input_hash text,                        -- SHA-256 (LGPD-safe)
    result_hash     text,
    success         boolean not null default true,
    severity        text default 'info' check (severity in ('info','warning','error','critical')),
    article_ref     text,                        -- ex: 'Art.II', 'Art.XIV' (se violação)
    decision        text,                        -- 'allow'|'block' (hook result)
    reason          text,
    metadata        jsonb default '{}'::jsonb,
    duration_ms     int,
    cost_usd        numeric(10,6),
    created_at      timestamptz default now()
);

create index audit_business_agent_idx on audit_log (business_id, agent_id, created_at desc);
create index audit_run_idx on audit_log (run_id);
create index audit_severity_idx on audit_log (severity, created_at desc) where severity in ('error','critical');
create index audit_article_idx on audit_log (article_ref) where article_ref is not null;

-- Trigger append-only
create or replace function prevent_audit_mutation()
returns trigger as $$
begin
    raise exception 'audit_log é append-only (MP-08)';
end;
$$ language plpgsql;

drop trigger if exists audit_no_update on audit_log;
drop trigger if exists audit_no_delete on audit_log;
create trigger audit_no_update before update on audit_log for each row execute function prevent_audit_mutation();
create trigger audit_no_delete before delete on audit_log for each row execute function prevent_audit_mutation();

-- RLS
alter table audit_log enable row level security;
create policy audit_select_own on audit_log for select
  using (
    business_id = current_setting('app.current_business', true)
    or current_setting('app.is_ecosystem_admin', true) = 'true'
  );
create policy audit_insert_any on audit_log for insert with check (true);  -- qualquer agente pode inserir
```

---

## Rollback scripts

Criar espelho em `infra/supabase/migrations/rollback/`:

```
rollback/
├── 20260416010000_memory_3tier.down.sql       # drop 3 tables + triggers
├── 20260416020000_ecosystem_credentials_v2_acl.down.sql  # remove columns (preservando dados)
├── 20260416030000_skills_registry.down.sql
└── 20260416040000_audit_log_v9.down.sql        # CUIDADO: audit_log preservar dados
```

**Regra:** rollback nunca perde dados de audit (Art. IV). Drop é só de tabelas novas ou colunas novas vazias.

---

## Protocolo de aplicação

Usa **MCP Supabase** (`mcp__05dc4b38-c201-4b12-8638-a3497e112721__apply_migration`):

```bash
# Dry-run em branch primeiro
supabase db branch create test-v9-migrations
supabase db branch switch test-v9-migrations

# Aplicar cada migration
for m in 20260416{010000_memory_3tier,020000_ecosystem_credentials_v2_acl,030000_skills_registry,040000_audit_log_v9}.sql; do
  mcp__supabase__apply_migration --project_id gqckbunsfjgerbuiyzvn --name "$(basename $m .sql)" --query "$(cat infra/supabase/migrations/$m)"
done

# Validações (ver seção abaixo)
# Se passou tudo, merge para main branch e aplica em produção
supabase db branch switch main
# Repete as aplicações
```

---

## Validações obrigatórias pós-aplicação

Execute via `mcp__supabase__execute_sql`:

```sql
-- 1. Tabelas criadas
select table_name from information_schema.tables 
  where table_schema = 'public' 
    and table_name in ('memory_episodic','memory_semantic','memory_procedural','skills_registry','audit_log');
-- Esperado: 5 linhas

-- 2. Extensão vector ativa
select * from pg_extension where extname = 'vector';

-- 3. RLS ativo
select tablename, rowsecurity from pg_tables 
  where schemaname = 'public' 
    and tablename in ('memory_episodic','memory_semantic','memory_procedural','audit_log','skills_registry');

-- 4. Índices vetoriais
select indexname from pg_indexes 
  where tablename = 'memory_episodic' and indexname like '%vec%';

-- 5. Trigger append-only funciona
begin;
insert into audit_log (agent_id, action) values ('test', 'tool_call');
update audit_log set action = 'hacked' where agent_id = 'test';  -- deve falhar
rollback;

-- 6. Seed de skills
select count(*) from skills_registry where business_id = 'ecosystem';  -- esperado: 4

-- 7. ACL em credentials
select name, acl from ecosystem_credentials limit 5;

-- 8. Auto-embedding trigger existe
select trigger_name from information_schema.triggers
  where event_object_table in ('memory_episodic','memory_semantic','memory_procedural');
-- Esperado: 3 linhas
```

---

## Testes de integração

Insert de teste em cada tabela (+ assert de RLS):

```sql
-- Set context
set app.current_business = 'fic';
set app.is_ecosystem_admin = 'false';

-- Insert válido
insert into memory_episodic (business_id, agent_id, type, summary)
values ('fic', 'cfo-fic', 'task', 'teste insert');
-- OK

-- Insert em outro business deve falhar RLS
insert into memory_episodic (business_id, agent_id, type, summary)
values ('intentus', 'cfo-intentus', 'task', 'teste cross-business');
-- Esperado: error ou 0 rows (dependendo da política exata)

-- Limpa
set app.is_ecosystem_admin = 'true';
delete from memory_episodic where summary = 'teste insert';
```

---

## Seeds iniciais

### `infra/supabase/seeds/ecosystem_credentials_seed.sql`

Popular com credenciais já conhecidas (só os metadados, valores ficam no Vault):

```sql
insert into ecosystem_credentials (name, project, environment, provider, description, vault_key, acl)
values
  ('INTER_CLIENT_ID', 'fic', 'prod', 'inter', 'Banco Inter client id para FIC',
   'inter_client_id_fic',
   '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb),
  -- ... outras (BRy, OpenRouter, Anthropic, etc)
on conflict (name, project, environment) do nothing;
```

---

## Critério de sucesso

- [ ] 4 migrations aplicadas sem erro
- [ ] Todas as 8 validações passam
- [ ] Testes de integração (insert/RLS) passam
- [ ] Rollback scripts existem e foram **testados** em branch
- [ ] Seeds carregados em ECOSYSTEM
- [ ] Trigger append-only funcional (tentativa de update lança exception)
- [ ] Auto-embedding dispara (verifique logs da Edge Function `embed-on-insert`)
- [ ] Documentação em `infra/supabase/migrations/README.md` explicando cada migration
- [ ] Commit semântico: `feat(db): migrations D1 — memory 3-tier + credentials V9 + skills registry + audit V9`
- [ ] PR com checklist de validações

---

## ⚠️ Avisos importantes

1. **Branch Supabase primeiro**. Nunca aplicar direto em main sem passar por branch.
2. **NÃO dropar `ecosystem_memory` existente.** Se a tabela antiga e a nova `memory_episodic` convivem, migrar dados depois em sessão dedicada.
3. **NÃO dropar credential_access_log existente** — dados de s094 em diante são imutáveis.
4. **audit_log** pode já existir parcial — se sim, use `alter table` em vez de `create table`.
5. **Auto-embedding** usa Edge Function `embed-on-insert` já deployada (s093). Confirme que URL em `app.embedding_edge_function_url` aponta correto.

---

## Handoff

- **S7 (Memory package)** depende dessas 3 tabelas
- **S8 (Edge Functions)** usa `audit_log` em todas as EFs + `skills_registry` na EF SC-04 + `ecosystem_credentials` na SC-29 v2
- **S11 (C-Suite templates)** consome `skills_registry` para listar skills disponíveis por role

---

**Boa sessão. Este é o alicerce de dados da V9 inteira. Capricho obrigatório.**
