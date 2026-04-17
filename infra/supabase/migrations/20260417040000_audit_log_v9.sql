-- Migration: audit_log V9
-- Criado em: 2026-04-17 · V9 Fase 0 · Sessão S04
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Referência: MASTERPLAN-V9 Parte VII (append-only) + Art. IV (rastreabilidade) + MP-08
--
-- audit_log é a pista de auditoria canônica para tool_calls, decisions,
-- handoffs e violações constitucionais em todos os agentes do ecossistema.

create table if not exists audit_log (
    id              bigserial primary key,
    business_id     text not null default 'ecosystem',
    agent_id        text not null,
    user_id         text,
    run_id          uuid,
    trace_id        text,
    tool_name       text,
    action          text not null check (action in ('tool_call','decision','handoff','violation','hook','memory_op','credential_op')),
    tool_input_hash text,
    result_hash     text,
    success         boolean not null default true,
    severity        text default 'info' check (severity in ('info','warning','error','critical')),
    article_ref     text,
    decision        text check (decision in ('allow','block','warn') or decision is null),
    reason          text,
    metadata        jsonb default '{}'::jsonb,
    duration_ms     int,
    cost_usd        numeric(10,6),
    created_at      timestamptz default now()
);

create index if not exists audit_business_agent_idx on audit_log (business_id, agent_id, created_at desc);
create index if not exists audit_run_idx            on audit_log (run_id);
create index if not exists audit_trace_idx          on audit_log (trace_id);
create index if not exists audit_severity_idx       on audit_log (severity, created_at desc)
  where severity in ('error','critical');
create index if not exists audit_article_idx        on audit_log (article_ref)
  where article_ref is not null;
create index if not exists audit_action_idx         on audit_log (action, created_at desc);

-- ============================================================
-- Trigger append-only (MP-08 + Art. IV)
-- ============================================================
create or replace function prevent_audit_mutation()
returns trigger as $$
begin
    raise exception 'audit_log é append-only (MP-08)';
end;
$$ language plpgsql;

drop trigger if exists audit_no_update on audit_log;
drop trigger if exists audit_no_delete on audit_log;

create trigger audit_no_update before update on audit_log
  for each row execute function prevent_audit_mutation();
create trigger audit_no_delete before delete on audit_log
  for each row execute function prevent_audit_mutation();

-- ============================================================
-- RLS
-- ============================================================
alter table audit_log enable row level security;

create policy audit_select_own on audit_log for select
  using (
    business_id = current_setting('app.current_business', true)
    or current_setting('app.is_ecosystem_admin', true) = 'true'
  );

create policy audit_service_role on audit_log for all to service_role
  using (true) with check (true);

-- Qualquer agente autenticado pode inserir (o hook é quem popula)
create policy audit_insert_any on audit_log for insert with check (true);

comment on table audit_log is
  'V9 Art. IV + MP-08 — Audit trail append-only canônico do ecossistema. Toda tool_call/decision/handoff/violation passa por aqui.';
