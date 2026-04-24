-- =============================================================================
-- Data migration: rename de arquivos legados do bucket processo-arquivos
--
-- Complemento de 20260424_tenant_scoped_storage_diploma.sql. Esta migration
-- renomeia os arquivos legados que usavam o path {user_id}/... para o novo
-- formato {tenant_id}/{user_id}/... e atualiza todos os storage_path dentro
-- do JSONB extracao_sessoes.arquivos.
--
-- Idempotente: só renomeia o que ainda não tem o prefixo do tenant.
--
-- Aplicada em produção: 2026-04-23 (480 objetos + 398 refs atualizadas, FIC).
-- Em repo fresh, rodar sempre DEPOIS da migration de schema/policies acima.
--
-- Escopo atual: apenas a FIC (tenant 1dc67914-…). Caso futuros tenants precisem
-- do mesmo rename, replicar o padrão mudando o tenant_id alvo.
-- =============================================================================

begin;

-- Passo 1: rename dos objetos no Storage
update storage.objects
set name = '1dc67914-fdbc-4a07-9154-703a474c5f93/' || name
where bucket_id = 'processo-arquivos'
  and name not like '1dc67914-fdbc-4a07-9154-703a474c5f93/%';

-- Passo 2: atualizar storage_path no JSONB extracao_sessoes.arquivos
-- WITH ORDINALITY preserva a ordem original — o frontend usa arquivo_index
-- para correlacionar elementos do array.
with recompute as (
  select
    s.id,
    jsonb_agg(
      case
        when (arq.value->>'storage_path') like '1dc67914-fdbc-4a07-9154-703a474c5f93/%'
          then arq.value
        else jsonb_set(
          arq.value,
          '{storage_path}',
          to_jsonb('1dc67914-fdbc-4a07-9154-703a474c5f93/' || (arq.value->>'storage_path'))
        )
      end
      order by arq.idx
    ) as novos
  from public.extracao_sessoes s,
       jsonb_array_elements(s.arquivos) with ordinality arq(value, idx)
  where s.arquivos is not null
    and jsonb_array_length(s.arquivos) > 0
  group by s.id
)
update public.extracao_sessoes s
set arquivos = r.novos
from recompute r
where s.id = r.id
  and s.arquivos is distinct from r.novos;

commit;
