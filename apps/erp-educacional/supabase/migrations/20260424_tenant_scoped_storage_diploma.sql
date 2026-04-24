-- =============================================================================
-- Migration: tenant_scoped_storage_diploma
-- Contexto (2026-04-23):
--   PR #89 (fix acesso compartilhado a sessões dentro do tenant) removeu o
--   filtro `usuario_id = auth.uid()` dos endpoints de extracao_sessoes, mas os
--   arquivos no Storage continuaram bloqueados pela policy RLS antiga que
--   exigia `(storage.foldername(name))[1] = auth.uid()`. Resultado: Marcelo
--   abria uma sessão iniciada pela Aleciana, mas o preview dos PDFs vinha em
--   "Object not found" (mascara do Supabase para RLS bloqueando SELECT).
--
-- Decisão:
--   Tenant = FIC (emissora) é dono dos atos acadêmicos, incluindo diploma.
--   Storage path migra de {user_id}/... para {tenant_id}/{user_id}/... e a
--   policy valida membership via public.usuario_papeis. Mantenedora
--   (Vale do Aporé) fica ligada à FIC via instituicoes.mantenedora_id como
--   preparatório para o módulo regulatório (prerrogativa da mantenedora).
--
-- O que esta migration faz:
--   1) Adiciona instituicoes.mantenedora_id + backfill FIC → Vale do Aporé
--   2) Adiciona extracao_sessoes.tenant_id + backfill = FIC + NOT NULL + index
--   3) Seeda papel "Diretoria" na FIC + grants pra Marcelo e Aleciana
--   4) Cria policies tenant-scoped processo_arquivos_tenant_*
--   5) Dropa policies antigas processo_arquivos_*_own (baseadas em auth.uid())
--
-- Esta migration NÃO toca nos arquivos físicos do Storage. O rename dos
-- legados (storage.objects.name e storage_path no JSONB) é feito na migration
-- seguinte: 20260424_tenant_scoped_storage_diploma_legacy_data.sql (ordem
-- importa em repo fresh: rodar a legacy_data DEPOIS desta).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Parte 1 — instituicoes.mantenedora_id (preparatório para módulo regulatório)
-- -----------------------------------------------------------------------------
alter table public.instituicoes
  add column if not exists mantenedora_id uuid
    references public.instituicoes(id) on delete set null;

comment on column public.instituicoes.mantenedora_id is
  'Mantenedora da IES (pessoa jurídica que mantém a mantida). Null para mantenedoras. '
  'Usado em atos regulatórios — não em atos acadêmicos.';

create index if not exists idx_instituicoes_mantenedora
  on public.instituicoes(mantenedora_id)
  where mantenedora_id is not null;

-- Backfill: FIC (emissora) → SOCIEDADE EDUCACIONAL VALE DO APORE LTDA (mantenedora)
update public.instituicoes
set mantenedora_id = 'e1acc318-d643-41c8-b311-392a28d91945'
where id = '1dc67914-fdbc-4a07-9154-703a474c5f93'
  and mantenedora_id is null;

-- -----------------------------------------------------------------------------
-- Parte 2 — Seed papel "Diretoria" na FIC + grants
-- -----------------------------------------------------------------------------
-- Papel determinístico (id fixo) para idempotência
insert into public.papeis (id, tenant_id, nome, descricao, tipo, cor, ativo)
values (
  'f2d1a8b4-1c4d-4e1f-9c9e-000000000001',
  '1dc67914-fdbc-4a07-9154-703a474c5f93',
  'Diretoria',
  'Direção da IES — acesso transversal aos atos acadêmicos',
  'custom',
  '#f97316',
  true
)
on conflict (nome, tenant_id) do nothing;

-- Grant: Marcelo (Diretor Presidente) + Aleciana (Diretora Acadêmica) na FIC
insert into public.usuario_papeis
  (user_id, papel_id, tenant_id, atribuido_por, data_inicio)
select
  u.id,
  'f2d1a8b4-1c4d-4e1f-9c9e-000000000001'::uuid,
  '1dc67914-fdbc-4a07-9154-703a474c5f93'::uuid,
  'a45d403a-2329-4289-9f73-c32c3657b69e'::uuid,
  current_date
from (values
  ('a45d403a-2329-4289-9f73-c32c3657b69e'::uuid),
  ('606ec2c3-98e0-4e7d-be65-cd09d020e010'::uuid)
) as u(id)
on conflict (user_id, papel_id, tenant_id) do nothing;

-- -----------------------------------------------------------------------------
-- Parte 3 — extracao_sessoes.tenant_id
-- -----------------------------------------------------------------------------
alter table public.extracao_sessoes
  add column if not exists tenant_id uuid
    references public.instituicoes(id) on delete restrict;

comment on column public.extracao_sessoes.tenant_id is
  'IES dona da sessão de extração (sempre a emissora do diploma, não a mantenedora).';

-- Backfill: todas as 25 sessões existentes pertencem à FIC
update public.extracao_sessoes
set tenant_id = '1dc67914-fdbc-4a07-9154-703a474c5f93'
where tenant_id is null;

-- Trava NOT NULL após backfill
alter table public.extracao_sessoes
  alter column tenant_id set not null;

create index if not exists idx_extracao_sessoes_tenant
  on public.extracao_sessoes(tenant_id);

-- -----------------------------------------------------------------------------
-- Parte 4 — Policies tenant-scoped
-- -----------------------------------------------------------------------------
-- Remove policies antigas (baseadas em auth.uid() == foldername[1]).
-- Em repo fresh, os arquivos já nascem com path {tenant_id}/..., então as
-- policies tenant-scoped abaixo governam tudo. Em produção, esta migration foi
-- aplicada em 2026-04-23 depois do data migration (legacy_data) concluído.
drop policy if exists "processo_arquivos_select_own" on storage.objects;
drop policy if exists "processo_arquivos_insert_own" on storage.objects;
drop policy if exists "processo_arquivos_update_own" on storage.objects;
drop policy if exists "processo_arquivos_delete_own" on storage.objects;

-- Padrão: primeiro segmento do path = tenant_id; usuário autenticado precisa
-- ter papel ativo (data_fim nula ou futura) nesse tenant.

create policy "processo_arquivos_tenant_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'processo-arquivos'
  and exists (
    select 1 from public.usuario_papeis up
    where up.user_id = auth.uid()
      and up.tenant_id::text = (storage.foldername(name))[1]
      and (up.data_fim is null or up.data_fim >= current_date)
  )
);

create policy "processo_arquivos_tenant_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'processo-arquivos'
  and exists (
    select 1 from public.usuario_papeis up
    where up.user_id = auth.uid()
      and up.tenant_id::text = (storage.foldername(name))[1]
      and (up.data_fim is null or up.data_fim >= current_date)
  )
);

create policy "processo_arquivos_tenant_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'processo-arquivos'
  and exists (
    select 1 from public.usuario_papeis up
    where up.user_id = auth.uid()
      and up.tenant_id::text = (storage.foldername(name))[1]
      and (up.data_fim is null or up.data_fim >= current_date)
  )
)
with check (
  bucket_id = 'processo-arquivos'
  and exists (
    select 1 from public.usuario_papeis up
    where up.user_id = auth.uid()
      and up.tenant_id::text = (storage.foldername(name))[1]
      and (up.data_fim is null or up.data_fim >= current_date)
  )
);

create policy "processo_arquivos_tenant_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'processo-arquivos'
  and exists (
    select 1 from public.usuario_papeis up
    where up.user_id = auth.uid()
      and up.tenant_id::text = (storage.foldername(name))[1]
      and (up.data_fim is null or up.data_fim >= current_date)
  )
);
