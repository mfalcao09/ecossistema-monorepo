-- Sessão 2026-04-26: tabela append-only `processo_arquivo_versoes` registra
-- TODAS as versões de cada arquivo de comprobatório. Substitui o modelo
-- destrutivo (sobrescrever storage_path em processo_arquivos) por um modelo
-- versionado: cada substituição cria nova versão com `ativa=true` e marca
-- a anterior como `ativa=false`. Permite restauração de versões anteriores
-- e auditoria forense completa.
--
-- O `processo_arquivos.storage_path` continua sendo a fonte rápida para a
-- versão ativa (queries existentes não quebram), mas a verdade canônica
-- do histórico vive nesta tabela.

CREATE TABLE IF NOT EXISTS processo_arquivo_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_arquivo_id uuid NOT NULL REFERENCES processo_arquivos(id) ON DELETE CASCADE,
  versao int NOT NULL,
  storage_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'processo-arquivos',
  nome_original text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint,
  ativa boolean NOT NULL DEFAULT false,
  criada_em timestamptz NOT NULL DEFAULT now(),
  criada_por uuid,
  -- 'upload_inicial' | 'substituicao' | 'restauracao'
  origem text NOT NULL DEFAULT 'substituicao',
  -- Quando origem = 'restauracao', aponta para a versão que foi clonada
  origem_versao_id uuid REFERENCES processo_arquivo_versoes(id) ON DELETE SET NULL,
  observacao text,
  CONSTRAINT uq_processo_arquivo_versao UNIQUE (processo_arquivo_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_processo_arquivo_versoes_processo_arquivo_id
  ON processo_arquivo_versoes(processo_arquivo_id, versao DESC);

-- Constraint chave: APENAS UMA versão pode estar ativa por arquivo.
-- Implementada via partial unique index (Postgres trick).
CREATE UNIQUE INDEX IF NOT EXISTS uq_processo_arquivo_unica_versao_ativa
  ON processo_arquivo_versoes (processo_arquivo_id) WHERE ativa = true;

-- RLS — espelha o padrão de outras tabelas do diploma
ALTER TABLE processo_arquivo_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read versoes"
  ON processo_arquivo_versoes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can insert versoes"
  ON processo_arquivo_versoes FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update versoes"
  ON processo_arquivo_versoes FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "No deletes on versoes"
  ON processo_arquivo_versoes FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE processo_arquivo_versoes IS
  'Versões append-only de cada arquivo de comprobatório. Cada linha = 1 upload
   (inicial, substituição ou restauração). Apenas 1 versão tem ativa=true por
   processo_arquivo_id. Garante recuperação de versões e auditoria forense.';

-- Backfill: pra cada processo_arquivos existente (incluindo legados), cria
-- versão 1 com `ativa = true` apontando pro storage_path atual. Usa
-- ON CONFLICT DO NOTHING pra ser idempotente (caso a migration rode 2x).
INSERT INTO processo_arquivo_versoes
  (processo_arquivo_id, versao, storage_path, bucket, nome_original,
   mime_type, tamanho_bytes, ativa, criada_em, criada_por,
   origem, observacao)
SELECT
  pa.id,
  1,
  pa.storage_path,
  'processo-arquivos',
  pa.nome_original,
  pa.mime_type,
  pa.tamanho_bytes,
  true,
  COALESCE(pa.created_at, now()),
  pa.uploaded_by,
  'upload_inicial',
  'Versão inicial reconstruída por backfill (Sessão 2026-04-26)'
FROM processo_arquivos pa
ON CONFLICT (processo_arquivo_id, versao) DO NOTHING;
