-- Rollback: ecosystem_credentials v2 ACL
-- CUIDADO: credential_access_log é append-only por design.
-- Este rollback REMOVE colunas novas e restaura unique(name).
-- Dados de audit (linhas existentes) são preservados — só as colunas extras somem.

-- 1. Drop triggers append-only
drop trigger if exists credential_log_no_update on credential_access_log;
drop trigger if exists credential_log_no_delete on credential_access_log;
drop function if exists prevent_credential_log_mutation();

-- 2. Drop constraint e restaura unique(name)
alter table ecosystem_credentials drop constraint if exists uq_cred_name_project_env;
alter table ecosystem_credentials add constraint ecosystem_credentials_name_key unique (name);

-- 3. Restaura check antigo de action
alter table credential_access_log drop constraint if exists credential_access_log_action_check;
alter table credential_access_log
  add constraint credential_access_log_action_check
  check (action in ('read','rotate','create','deactivate','update'));

-- 4. Drop índices novos
drop index if exists cal_mode_idx;
drop index if exists cal_project_idx;
drop index if exists ec_provider_idx;
drop index if exists ec_project_env_idx;

-- 5. Remove colunas novas de credential_access_log
alter table credential_access_log
  drop column if exists reason,
  drop column if exists metadata,
  drop column if exists cost_usd,
  drop column if exists latency_ms,
  drop column if exists api_endpoint,
  drop column if exists mode,
  drop column if exists project;

-- 6. Remove colunas novas de ecosystem_credentials
alter table ecosystem_credentials
  drop column if exists usage_count,
  drop column if exists last_used_at,
  drop column if exists proxy_only,
  drop column if exists rate_limit,
  drop column if exists acl,
  drop column if exists provider,
  drop column if exists environment,
  drop column if exists project;
