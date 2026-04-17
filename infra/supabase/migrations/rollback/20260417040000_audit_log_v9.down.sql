-- Rollback: audit_log V9
-- CUIDADO: audit_log é append-only por design (MP-08 + Art. IV).
-- Este rollback dropa a tabela recém-criada. Se houver dados de auditoria,
-- EXPORTAR antes de rodar este rollback.

-- Safety check: aborta se existirem dados (remover a linha abaixo só se for intencional)
do $$ begin
  if exists (select 1 from audit_log limit 1) then
    raise exception 'audit_log contém dados — exporte antes de dropar. Veja runbook de audit export.';
  end if;
end $$;

drop trigger if exists audit_no_update on audit_log;
drop trigger if exists audit_no_delete on audit_log;
drop function if exists prevent_audit_mutation();

drop policy if exists audit_insert_any   on audit_log;
drop policy if exists audit_service_role on audit_log;
drop policy if exists audit_select_own   on audit_log;

drop table if exists audit_log;
