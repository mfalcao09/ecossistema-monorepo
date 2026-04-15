-- =======================================================================
-- Sprint 1 — Fluxo Novo Processo + Gate FIC (Sessão 028) — VERSÃO ADITIVA
-- =======================================================================
-- Referência: memory/projects/plano-tecnico-fluxo-novo-processo-sessao-028-v2.md
-- Tabelas legadas:  memory/projects/tabelas-legadas-extracao-processo-arquivos.md
--
-- IMPORTANTE: as tabelas `extracao_sessoes` e `processo_arquivos` JÁ EXISTEM
-- desde 21/03/2026 e 06/04/2026 respectivamente (módulo de emissão IA + RAG
-- de skills fixas). Esta migration é ADITIVA: apenas adiciona as colunas
-- novas exigidas pelo plano v2, mantendo o legado intacto.
--
-- A consolidação (depreciar tipo_documento → tipo_xsd, promovido_acervo →
-- destino_acervo, etc.) é tech-debt registrada para sprint futura.
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. extracao_sessoes — colunas novas do plano v2
-- -----------------------------------------------------------------------
ALTER TABLE public.extracao_sessoes
  ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS arquivos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Expandir CHECK de status para incluir os novos estados do fluxo v2
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'extracao_sessoes'
      AND constraint_name = 'extracao_sessoes_status_check'
  ) THEN
    ALTER TABLE public.extracao_sessoes DROP CONSTRAINT extracao_sessoes_status_check;
  END IF;
END $$;

ALTER TABLE public.extracao_sessoes
  ADD CONSTRAINT extracao_sessoes_status_check
  CHECK (status IN (
    'pendente', 'processando', 'rascunho', 'concluido',
    'descartado', 'erro', 'aguardando_revisao', 'revisado'
  ));

CREATE INDEX IF NOT EXISTS idx_extracao_sessoes_usuario_id
  ON public.extracao_sessoes(usuario_id);

COMMENT ON COLUMN public.extracao_sessoes.version IS
  'Optimistic locking: UPDATE só acontece se WHERE version = :expected_version. Cliente recebe 409 em caso de conflito. (Patch 2.3 do plano v2 — sessão 028.)';
COMMENT ON COLUMN public.extracao_sessoes.usuario_id IS
  'FK para auth.users — adicionada na sessão 028 (plano v2). Pode ser NULL para sessões legadas.';
COMMENT ON COLUMN public.extracao_sessoes.arquivos IS
  'Lista de arquivos da sessão antes de virar processo. Estrutura JSON livre — sessão 028.';


-- -----------------------------------------------------------------------
-- 2. processo_arquivos — colunas novas do plano v2
-- -----------------------------------------------------------------------
-- IMPORTANTE: NÃO criamos hash_sha256 nem acervo_documento_id porque o
-- legado já tem `sha256` e `acervo_doc_id`. Reusar reduz a sobreposição.
-- -----------------------------------------------------------------------
ALTER TABLE public.processo_arquivos
  ADD COLUMN IF NOT EXISTS sessao_id uuid REFERENCES public.extracao_sessoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destino_processo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS destino_xml boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS destino_acervo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_xsd text,
  ADD COLUMN IF NOT EXISTS ddc_id uuid REFERENCES public.diploma_documentos_comprobatorios(id) ON DELETE SET NULL;

-- Sincroniza destino_acervo com a coluna legada promovido_acervo
UPDATE public.processo_arquivos
   SET destino_acervo = true
 WHERE promovido_acervo = true
   AND destino_acervo = false;

-- CHECK constraints (idempotentes via DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'processo_arquivos'
      AND constraint_name = 'chk_destino_processo_sempre_true'
  ) THEN
    ALTER TABLE public.processo_arquivos
      ADD CONSTRAINT chk_destino_processo_sempre_true
      CHECK (destino_processo = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'processo_arquivos'
      AND constraint_name = 'chk_tipo_xsd_enum'
  ) THEN
    ALTER TABLE public.processo_arquivos
      ADD CONSTRAINT chk_tipo_xsd_enum
      CHECK (tipo_xsd IS NULL OR tipo_xsd IN (
        'DocumentoIdentidadeDoAluno',
        'ProvaConclusaoEnsinoMedio',
        'ProvaColacao',
        'ComprovacaoEstagioCurricular',
        'CertidaoNascimento',
        'CertidaoCasamento',
        'TituloEleitor',
        'AtoNaturalizacao',
        'Outros'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'processo_arquivos'
      AND constraint_name = 'chk_xml_requer_tipo'
  ) THEN
    ALTER TABLE public.processo_arquivos
      ADD CONSTRAINT chk_xml_requer_tipo
      CHECK (
        (destino_xml = false) OR
        (destino_xml = true AND tipo_xsd IS NOT NULL)
      );
  END IF;
END $$;

-- Índices novos
CREATE INDEX IF NOT EXISTS idx_processo_arquivos_sessao_id
  ON public.processo_arquivos(sessao_id)
  WHERE sessao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processo_arquivos_ddc_id
  ON public.processo_arquivos(ddc_id)
  WHERE ddc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processo_arquivos_destino_xml
  ON public.processo_arquivos(processo_id, destino_xml)
  WHERE destino_xml = true;

CREATE INDEX IF NOT EXISTS idx_processo_arquivos_destino_acervo
  ON public.processo_arquivos(processo_id, destino_acervo)
  WHERE destino_acervo = true;

-- Comentários
COMMENT ON COLUMN public.processo_arquivos.sessao_id IS
  'FK opcional para extracao_sessoes — vincula o arquivo à sessão de extração que o originou. Sessão 028.';
COMMENT ON COLUMN public.processo_arquivos.destino_processo IS
  'Sempre true (CHECK). O arquivo SEMPRE fica no processo. Regra dos 3 destinos — sessão 024.';
COMMENT ON COLUMN public.processo_arquivos.destino_xml IS
  'Marca para inclusão no XML DocumentacaoComprobatoria. Quando true, tipo_xsd é obrigatório.';
COMMENT ON COLUMN public.processo_arquivos.destino_acervo IS
  'Marca para envio ao Acervo Acadêmico Digital (Decreto 10.278). Substitui a coluna legada promovido_acervo (consolidação tech-debt).';
COMMENT ON COLUMN public.processo_arquivos.tipo_xsd IS
  'Tipo XSD v1.05 (TTipoDocumentacao) — só obrigatório quando destino_xml=true. Substitui tipo_documento (text livre legado) — consolidação tech-debt.';
COMMENT ON COLUMN public.processo_arquivos.ddc_id IS
  'FK unidirecional → diploma_documentos_comprobatorios (Patch 2.1 do plano v2). Sem FK reversa.';
