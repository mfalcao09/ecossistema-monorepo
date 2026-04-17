-- Rollback: skills_registry
-- Destroi tabela nova inteira. Nenhum dado pré-existente.

drop trigger if exists trg_skills_registry_updated on skills_registry;
drop function if exists update_skills_registry_updated_at();

drop policy if exists skills_update_admin on skills_registry;
drop policy if exists skills_write_admin  on skills_registry;
drop policy if exists skills_service_role on skills_registry;
drop policy if exists skills_read_all     on skills_registry;

drop table if exists skills_registry;
