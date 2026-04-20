-- Migration: vault_tokens + ecosystem_credentials vault columns
-- Criado em: 2026-04-17 · V9 Fase 0 · Sessão S12
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Referência: MASTERPLAN-V9 § 26 (Padrão 3 — AES-256-GCM Vault + Magic Link)
--
-- Implementa o Phantom Magic Link Vault:
-- credenciais NUNCA fluem via chat. Agent gera URL → usuário preenche form →
-- secret é cifrado no browser com AES-256-GCM → servidor armazena ciphertext.

-- ============================================================
-- 1. vault_tokens — tokens one-time para coleta de credenciais
-- ============================================================
create table if not exists vault_tokens (
    token             text primary key,            -- 32+ chars random url-safe
    credential_name   text not null,               -- ex: INTER_CLIENT_SECRET
    project           text not null                -- ecosystem|fic|klesis|intentus|splendori|nexvy
                        check (project in ('ecosystem','fic','klesis','intentus','splendori','nexvy')),
    scope             text,                        -- descrição humana ("Inter Client Secret FIC")
    dek_wrapped       bytea,                       -- DEK cifrada pela KEK (Supabase Vault)
    requested_by      text not null,               -- agent_id que solicitou
    created_at        timestamptz default now(),
    expires_at        timestamptz not null,
    used              boolean default false,
    used_at           timestamptz,
    used_from_ip      inet,
    used_from_ua      text,

    constraint vault_tokens_expires_check check (expires_at > created_at)
);

-- índice para lookup eficiente de tokens válidos
create index if not exists vault_tokens_exp_idx
    on vault_tokens (expires_at)
    where used = false;

-- índice para limpeza por projeto
create index if not exists vault_tokens_project_idx
    on vault_tokens (project, created_at desc);

-- ============================================================
-- 2. Colunas vault em ecosystem_credentials (Modo B — proxy decrypt)
-- ============================================================
alter table ecosystem_credentials
    add column if not exists vault_key       text,       -- ciphertext AES-256-GCM (base64)
    add column if not exists vault_iv        text,       -- IV 12 bytes (base64)
    add column if not exists vault_algorithm text        -- ex: 'AES-256-GCM'
                                             default 'AES-256-GCM',
    add column if not exists dek_wrapped     bytea;      -- DEK cifrada pela KEK para future decrypt

comment on column ecosystem_credentials.vault_key       is 'S12: ciphertext AES-256-GCM cifrado no browser — NUNCA o plaintext';
comment on column ecosystem_credentials.vault_iv        is 'S12: IV 96-bit (12 bytes) base64 para AES-GCM';
comment on column ecosystem_credentials.vault_algorithm is 'S12: algoritmo de cifração (default AES-256-GCM)';
comment on column ecosystem_credentials.dek_wrapped     is 'S12: DEK cifrada pela KEK do Supabase Vault para SC-29 Modo B';

-- ============================================================
-- 3. RLS em vault_tokens
-- ============================================================
alter table vault_tokens enable row level security;

-- apenas service_role pode inserir/ler/atualizar tokens
create policy vault_tokens_service_role on vault_tokens for all to service_role
    using (true) with check (true);

-- anon pode ler apenas token VÁLIDO para validação no form
-- (o handler da EF usa service_role, mas por segurança em depth)
create policy vault_tokens_anon_validate on vault_tokens for select to anon
    using (
        used = false
        and expires_at > now()
    );

-- ============================================================
-- 4. pg_cron — purge automático de tokens expirados (7 dias)
-- ============================================================
-- NOTA: requer pg_cron habilitado no projeto Supabase.
-- Executa diariamente às 02:00 UTC.
-- Descomente após confirmar que pg_cron está ativo:
--
-- select cron.schedule(
--     'purge-vault-tokens',
--     '0 2 * * *',
--     $$
--         delete from vault_tokens
--          where (used = true or expires_at < now())
--            and created_at < now() - interval '7 days';
--     $$
-- );

-- ============================================================
-- 5. Comentários de tabela
-- ============================================================
comment on table vault_tokens is
    'S12 § 26 — tokens one-time para Magic Link Vault. TTL 15min por padrão. '
    'Secret nunca flui via chat — agent gera URL → user preenche form → browser cifra AES-256-GCM.';
