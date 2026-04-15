-- ============================================================================
-- Migration: outbox_assinaturas
-- Sessão: 059
-- Descrição: Tabela para rastrear cada passo de assinatura digital BRy
--            no fluxo Initialize → Sign (extensão) → Finalize
-- ============================================================================

-- Enum para tipos de assinante conforme API BRy Diploma Digital
CREATE TYPE tipo_assinante_bry AS ENUM (
  'Representantes',
  'IESEmissoraDadosDiploma',
  'IESEmissoraRegistro',
  'IESRegistradora'
);

-- Enum para status de cada passo de assinatura
CREATE TYPE status_assinatura_bry AS ENUM (
  'pendente',           -- aguardando início
  'inicializado',       -- POST /initialize feito, aguardando extensão
  'assinado_extensao',  -- extensão cifrou, aguardando finalize
  'finalizado',         -- POST /finalize OK, XML assinado obtido
  'erro'                -- falha em qualquer etapa
);

-- Enum para perfil de assinatura (política)
CREATE TYPE perfil_assinatura_bry AS ENUM (
  'ADRT',  -- AD com Referência Temporal (assinaturas intermediárias)
  'ADRA'   -- AD com Referência de Arquivamento (envelope final)
);

CREATE TABLE outbox_assinaturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo com o diploma e XML
  diploma_id      UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  xml_gerado_id   UUID NOT NULL REFERENCES xml_gerados(id) ON DELETE CASCADE,

  -- Identificação do passo de assinatura
  passo           SMALLINT NOT NULL,  -- 1, 2, 3... (ordem sequencial)
  tipo_assinante  tipo_assinante_bry NOT NULL,
  perfil          perfil_assinatura_bry NOT NULL DEFAULT 'ADRT',
  specific_node   TEXT,  -- 'DadosDiploma', 'DadosRegistro', ou NULL (envelope)

  -- Status e dados do fluxo Initialize/Finalize
  status          status_assinatura_bry NOT NULL DEFAULT 'pendente',
  nonce           TEXT,  -- nonce usado na requisição BRy

  -- Dados retornados pelo Initialize (Step 1)
  signed_attributes     TEXT,  -- base64 retornado por BRy para cifrar
  initialized_document  TEXT,  -- blob retornado por BRy para enviar no finalize

  -- Dados retornados pela extensão (Step 2)
  signature_value TEXT,  -- signedAttributes cifrado com chave privada
  certificate     TEXT,  -- chave pública do certificado usado (base64)

  -- Resultado do Finalize (Step 3)
  xml_assinado_base64   TEXT,  -- XML assinado retornado pelo BRy
  download_url          TEXT,  -- link de download se BRy retornar

  -- Controle de erro
  erro_mensagem   TEXT,
  erro_detalhes   JSONB,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  initialized_at  TIMESTAMPTZ,  -- quando o Initialize retornou
  signed_at       TIMESTAMPTZ,  -- quando a extensão cifrou
  finalized_at    TIMESTAMPTZ,  -- quando o Finalize retornou
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT outbox_assinaturas_passo_unico
    UNIQUE (xml_gerado_id, passo)
);

-- Índices
CREATE INDEX idx_outbox_assinaturas_diploma ON outbox_assinaturas(diploma_id);
CREATE INDEX idx_outbox_assinaturas_xml ON outbox_assinaturas(xml_gerado_id);
CREATE INDEX idx_outbox_assinaturas_status ON outbox_assinaturas(status);

-- RLS (padrão ERP: authenticated pode acessar)
ALTER TABLE outbox_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_outbox_assinaturas_select"
  ON outbox_assinaturas FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_outbox_assinaturas_insert"
  ON outbox_assinaturas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_outbox_assinaturas_update"
  ON outbox_assinaturas FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION trigger_outbox_assinaturas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_outbox_assinaturas_updated_at
  BEFORE UPDATE ON outbox_assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION trigger_outbox_assinaturas_updated_at();

-- Comentários
COMMENT ON TABLE outbox_assinaturas IS 'Rastreia cada passo de assinatura digital BRy (Initialize → Extensão → Finalize)';
COMMENT ON COLUMN outbox_assinaturas.passo IS 'Ordem sequencial: 1=Representante PF, 2=IES PJ em DadosDiploma, 3=Envelope AD-RA';
COMMENT ON COLUMN outbox_assinaturas.signed_attributes IS 'Base64 retornado pelo BRy Initialize — deve ser cifrado pela extensão BRy';
COMMENT ON COLUMN outbox_assinaturas.initialized_document IS 'Blob retornado pelo BRy Initialize — enviado no Finalize';
COMMENT ON COLUMN outbox_assinaturas.signature_value IS 'signed_attributes cifrado pela chave privada do Token A3 via BryWebExtension.sign()';
