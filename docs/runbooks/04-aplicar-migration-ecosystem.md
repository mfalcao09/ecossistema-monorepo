# Runbook 04 — Aplicar migration em ECOSYSTEM

> **Quando:** schema change em Supabase de produção (ECOSYSTEM, ERP-FIC, Intentus).
> **Dono:** D-Infra + dono da sessão de migração do dia.
> **Fontes canônicas:** ADR-016 Regra 5 (slot único por dia), V9 § Parte XIV §44.

## Pré-requisitos

- [ ] Slot de migração do dia verificado: **apenas 1 sessão/dia por DB de produção**
- [ ] Lock em `agent_tasks` (depois de S02)
- [ ] Migração revisada por outra sessão OU por Marcelo
- [ ] Rollback SQL preparado
- [ ] Ambiente de branch Supabase disponível

## Passo-a-passo

### 1. Verificar slot do dia

```sql
-- Em ECOSYSTEM
select * from agent_tasks
where task_type = 'migration'
  and target_db = '<ecosystem|erp_fic|intentus>'
  and scheduled_for::date = current_date
  and status in ('locked','running');
```

Se já houver lock: **pausar e pegar outra task** (ADR-016 Regra 3).

### 2. Adquirir lock

```sql
insert into agent_tasks (id, task_type, target_db, assigned_to, status, scheduled_for)
values (gen_random_uuid(), 'migration', '<db>', 'session_<X>', 'locked', now());
```

### 3. Criar arquivo de migration

```
infra/supabase/migrations/YYYYMMDDHHMMSS_<nome_canonico>.sql
```

Padrão do arquivo:

```sql
-- migration: <descrição em 1 linha>
-- author: session_<X>
-- date: YYYY-MM-DD

begin;

-- DDL aqui
-- Não usar DROP sem WHERE em tabelas com dados
-- Prefer: add column nullable; backfill; alter not null

commit;
```

### 4. Criar rollback

```
infra/supabase/migrations/rollback/YYYYMMDDHHMMSS_<nome>.down.sql
```

O rollback DEVE ser executável manualmente se a migração falhar em prod.

### 5. Testar em branch Supabase

```bash
supabase db branch create migration-test-<nome>
supabase db push --project-ref <branch_ref>
```

### 6. Checklist de queries de validação

Cada migration deve incluir em comentário no topo:

```sql
-- VALIDATION QUERIES:
-- 1. <query que deve retornar N rows>
-- 2. <query que deve retornar 0 rows (caso sem duplicatas)>
-- 3. explain analyze <query crítica> -> p95 < Xms
```

Rodar todas contra a branch.

### 7. Code review + CI

PR para `main` com migration + rollback + validation queries + entry em `CHANGELOG-DB.md` (se existir).

### 8. Merge para main

Após CI green + review.

### 9. Apply em prod

```bash
supabase db push --project-ref gqckbunsfjgerbuiyzvn  # ECOSYSTEM
# ou:
supabase db push --project-ref ifdnjieklngcfodmtied  # ERP-FIC
# ou:
supabase db push --project-ref bvryaopfjiyxjgsuhjsb  # Intentus
```

### 10. Testar novamente em prod

Rodar as VALIDATION QUERIES contra prod.

### 11. Liberar lock

```sql
update agent_tasks set status = 'done', completed_at = now()
where id = '<task_id>';
```

### 12. Atualizar briefing

Menção em `docs/sessions/logs/LOG-YYYY-MM-DD-*.md`: "Migration `<nome>` aplicada em `<db>`, validation OK."

## Rollback

Se validação em prod (passo 10) falhar:

```bash
psql -h <host> -U postgres -d postgres -f infra/supabase/migrations/rollback/<nome>.down.sql
```

Notificar imediatamente D-Infra + Marcelo (runbook 05 se severity P1+).

## Critérios de sucesso

- [ ] Migration aplicada sem erros em prod
- [ ] Validation queries passam
- [ ] Lock liberado
- [ ] Entry no changelog/briefing
- [ ] Nenhuma regressão em `audit_log` nas próximas 2h
