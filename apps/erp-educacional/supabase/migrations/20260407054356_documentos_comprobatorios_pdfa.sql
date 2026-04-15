-- Bug #F — Documentos Comprobatórios PDF/A
-- Sessão 023 / 2026-04-07
--
-- Cria a tabela diploma_documentos_comprobatorios + bucket documentos-pdfa + enums.
-- Esta migração já foi aplicada no Supabase em 2026-04-07 05:43:56 UTC; o arquivo
-- é commitado agora (sessão 024) só para que o repo fique em sync com o estado real.
--
-- ⚠️ ATENÇÃO: o enum tipo_documento_comprobatorio criado AQUI tem 5 valores
-- (RG/CNH/Passaporte/CertidaoNascimento/Outro) que NÃO correspondem ao XSD v1.05.
-- A migração 20260407065629_fix_tipo_documento_comprobatorio_enum_xsd_v105.sql
-- corrige o enum para os 9 valores oficiais. Sempre rodar as duas em sequência.

DO $$ BEGIN
  CREATE TYPE tipo_documento_comprobatorio AS ENUM ('RG','CNH','Passaporte','CertidaoNascimento','Outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pdfa_engine AS ENUM ('ghostscript','cloudconvert','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.diploma_documentos_comprobatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos_emissao(id) ON DELETE CASCADE,
  arquivo_origem_id UUID NOT NULL REFERENCES public.processo_arquivos(id) ON DELETE RESTRICT,
  diploma_id UUID REFERENCES public.documentos_digitais(id) ON DELETE SET NULL,
  tipo_xsd tipo_documento_comprobatorio NOT NULL,
  numero_documento TEXT,
  orgao_emissor TEXT,
  uf_emissor CHAR(2),
  data_expedicao DATE,
  pdfa_storage_path TEXT,
  pdfa_sha256 TEXT,
  pdfa_tamanho_bytes BIGINT,
  pdfa_engine pdfa_engine,
  pdfa_engine_version TEXT,
  pdfa_converted_at TIMESTAMPTZ,
  pdfa_validation_ok BOOLEAN,
  pdfa_validation_errors JSONB,
  r2_backup_path TEXT,
  r2_backed_up_at TIMESTAMPTZ,
  selecionado_por UUID REFERENCES auth.users(id),
  selecionado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ddc_pdfa_coerencia CHECK (
    (pdfa_storage_path IS NULL AND pdfa_sha256 IS NULL AND pdfa_converted_at IS NULL)
    OR
    (pdfa_storage_path IS NOT NULL AND pdfa_sha256 IS NOT NULL AND pdfa_converted_at IS NOT NULL)
  ),
  CONSTRAINT ddc_tamanho_razoavel CHECK (
    pdfa_tamanho_bytes IS NULL OR (pdfa_tamanho_bytes > 0 AND pdfa_tamanho_bytes <= 15728640)
  )
);

CREATE INDEX IF NOT EXISTS idx_ddc_processo ON public.diploma_documentos_comprobatorios(processo_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ddc_arquivo_origem ON public.diploma_documentos_comprobatorios(arquivo_origem_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ddc_diploma ON public.diploma_documentos_comprobatorios(diploma_id) WHERE deleted_at IS NULL AND diploma_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ddc_processo_arquivo ON public.diploma_documentos_comprobatorios(processo_id, arquivo_origem_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ddc_backup_pendente ON public.diploma_documentos_comprobatorios(pdfa_converted_at) WHERE r2_backed_up_at IS NULL AND pdfa_storage_path IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.ddc_set_updated_at() RETURNS TRIGGER AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ddc_updated_at ON public.diploma_documentos_comprobatorios;
CREATE TRIGGER trg_ddc_updated_at BEFORE UPDATE ON public.diploma_documentos_comprobatorios
  FOR EACH ROW EXECUTE FUNCTION public.ddc_set_updated_at();

ALTER TABLE public.diploma_documentos_comprobatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ddc_authenticated_select ON public.diploma_documentos_comprobatorios;
CREATE POLICY ddc_authenticated_select ON public.diploma_documentos_comprobatorios FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ddc_authenticated_insert ON public.diploma_documentos_comprobatorios;
CREATE POLICY ddc_authenticated_insert ON public.diploma_documentos_comprobatorios FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS ddc_authenticated_update ON public.diploma_documentos_comprobatorios;
CREATE POLICY ddc_authenticated_update ON public.diploma_documentos_comprobatorios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ddc_authenticated_delete ON public.diploma_documentos_comprobatorios;
CREATE POLICY ddc_authenticated_delete ON public.diploma_documentos_comprobatorios FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos-pdfa','documentos-pdfa',false,15728640,ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "pdfa_read" ON storage.objects;
CREATE POLICY "pdfa_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-pdfa');

DROP POLICY IF EXISTS "pdfa_write_service" ON storage.objects;
CREATE POLICY "pdfa_write_service" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'documentos-pdfa');

DROP POLICY IF EXISTS "pdfa_update_service" ON storage.objects;
CREATE POLICY "pdfa_update_service" ON storage.objects FOR UPDATE TO service_role USING (bucket_id = 'documentos-pdfa');

DROP POLICY IF EXISTS "pdfa_delete_service" ON storage.objects;
CREATE POLICY "pdfa_delete_service" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'documentos-pdfa');

COMMENT ON TABLE public.diploma_documentos_comprobatorios IS 'Bug #F — Documentos comprobatorios em PDF/A-2 para <DocumentacaoComprobatoria> do XML. Reaproveita uploads de processo_arquivos. Conversao lazy via microservico Ghostscript Railway. Backup em Cloudflare R2 por 10 anos.';
COMMENT ON COLUMN public.diploma_documentos_comprobatorios.arquivo_origem_id IS 'FK para o arquivo original em processo_arquivos (upload da Fase 1 — extracao). NUNCA e mexido; apenas lido para gerar o PDF/A.';
COMMENT ON COLUMN public.diploma_documentos_comprobatorios.tipo_xsd IS 'Tipo conforme enum TTipoDocumentacao do XSD v1.05 (ver migration 20260407065629).';
COMMENT ON COLUMN public.diploma_documentos_comprobatorios.pdfa_storage_path IS 'Path no bucket documentos-pdfa. NULL enquanto conversao nao foi rodada (cache miss).';
COMMENT ON COLUMN public.diploma_documentos_comprobatorios.r2_backup_path IS 'Path no Cloudflare R2 apos replicacao pelo job Trigger.dev mensal. Retencao: 10 anos conforme IN SESU/MEC.';
