-- Migration corretiva: enum tipo_documento_comprobatorio para os 9 valores reais
-- do XSD v1.05 (TTipoDocumentacao). Tabela diploma_documentos_comprobatorios
-- está vazia (criada na sessão 023), portanto sem dados a migrar.
--
-- Ver: leiautedocumentacaoacademicaregistrodiplomadigital_v1-05.xsd, linhas 272-288
-- Já aplicada no Supabase em 2026-04-07 06:56:29 UTC. Commit no repo (sessão 024)
-- só para sincronizar histórico de migrações.

-- 1. Converter coluna para text temporariamente
ALTER TABLE diploma_documentos_comprobatorios
  ALTER COLUMN tipo_xsd TYPE text;

-- 2. Drop enum antigo (valores inválidos: RG, CNH, Passaporte, CertidaoNascimento, Outro)
DROP TYPE IF EXISTS tipo_documento_comprobatorio;

-- 3. Criar enum correto com os 9 valores oficiais do XSD v1.05
--    (TTipoDocumentacao em leiautedocumentacaoacademicaregistrodiplomadigital_v1-05.xsd, linhas 272-288)
CREATE TYPE tipo_documento_comprobatorio AS ENUM (
  'DocumentoIdentidadeDoAluno',
  'ProvaConclusaoEnsinoMedio',
  'ProvaColacao',
  'ComprovacaoEstagioCurricular',
  'CertidaoNascimento',
  'CertidaoCasamento',
  'TituloEleitor',
  'AtoNaturalizacao',
  'Outros'
);

-- 4. Recolocar tipo na coluna (cast seguro: tabela vazia)
ALTER TABLE diploma_documentos_comprobatorios
  ALTER COLUMN tipo_xsd TYPE tipo_documento_comprobatorio
  USING tipo_xsd::tipo_documento_comprobatorio;

-- 5. Comentários explicando uso
COMMENT ON TYPE tipo_documento_comprobatorio IS
  'Categorias funcionais de documentos comprobatórios conforme TTipoDocumentacao do XSD v1.05 do Diploma Digital MEC. NÃO são tipos físicos (RG/CNH) — são categorias do que o documento prova.';

COMMENT ON COLUMN diploma_documentos_comprobatorios.tipo_xsd IS
  'Categoria XSD do documento (vai como atributo tipo="..." no <Documento> do XML). Os campos numero_documento, orgao_emissor, uf_emissor, data_expedicao são metadata interna do ERP e NÃO vão pro XML.';
