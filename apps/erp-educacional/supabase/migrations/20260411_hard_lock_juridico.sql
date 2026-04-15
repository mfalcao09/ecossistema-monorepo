-- ============================================================
-- EPIC 1.4: HARD LOCK JURÍDICO — Imutabilidade Pós-Registro
-- ERP Educacional FIC — Sprint 1 Segurança — Sessão 057
-- Data: 2026-04-11
--
-- Propósito: Após um diploma atingir status 'registrado' (ou
-- qualquer status posterior), os dados acadêmicos e jurídicos
-- ficam TRAVADOS. Somente metadados de publicação e o campo
-- status podem ser alterados (para avançar o fluxo).
--
-- Desbloqueio excepcional: via RPC desbloquear_diploma_para_edicao()
-- que exige justificativa ≥ 10 chars, grava em validacao_overrides
-- e cria janela temporária de 5 minutos para edição.
--
-- Princípio Override Humano: nenhum bloqueio é absoluto —
-- operador pode desbloquear com justificativa auditada.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. Extensão hstore (comparação genérica de campos no trigger)
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS hstore SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────
-- 1. Tabela de janelas de desbloqueio temporário
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diploma_unlock_windows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diploma_id UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,
  override_id UUID NOT NULL REFERENCES validacao_overrides(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  justificativa TEXT NOT NULL CHECK (length(trim(justificativa)) >= 10),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,              -- preenchido quando o UPDATE acontece
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unlock_windows_diploma
  ON diploma_unlock_windows(diploma_id);
CREATE INDEX IF NOT EXISTS idx_unlock_windows_expires
  ON diploma_unlock_windows(expires_at DESC);

-- RLS (regra canônica: ON + policy authenticated)
ALTER TABLE diploma_unlock_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read unlock windows"
  ON diploma_unlock_windows FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only service role can insert unlock windows"
  ON diploma_unlock_windows FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No deletes on unlock windows"
  ON diploma_unlock_windows FOR DELETE
  USING (false);

COMMENT ON TABLE diploma_unlock_windows IS
  'Janelas temporárias de desbloqueio para diplomas registrados. Cada janela dura 5 minutos e permite UMA edição nos dados travados.';

-- ─────────────────────────────────────────────────────────────
-- 2. Trigger de imutabilidade na tabela diplomas
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_hard_lock_diploma()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public', 'extensions'
LANGUAGE plpgsql AS $$
DECLARE
  v_unlock_id UUID;
  v_campos_livres TEXT[] := ARRAY[
    -- Metadados de publicação e fluxo (SEMPRE editáveis)
    'status',
    'updated_at',
    'pdf_url',
    'qrcode_url',
    'url_verificacao',
    'data_publicacao',
    'xml_url',
    'codigo_validacao',
    'codigo_validacao_historico'
  ];
  v_col TEXT;
  v_campo_protegido_alterado BOOLEAN := FALSE;
BEGIN
  -- ── Bypass: só aplica se o status ANTERIOR era pós-registro ──
  IF OLD.status NOT IN ('registrado', 'gerando_rvdd', 'rvdd_gerado', 'publicado') THEN
    RETURN NEW;
  END IF;

  -- ── Verificar retrocesso de status ──
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('registrado', 'gerando_rvdd', 'rvdd_gerado', 'publicado') THEN
      -- Retrocesso: exige unlock window ativa
      SELECT id INTO v_unlock_id
        FROM diploma_unlock_windows
        WHERE diploma_id = OLD.id
          AND used_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1;

      IF v_unlock_id IS NULL THEN
        RAISE EXCEPTION 'HARD_LOCK: Diploma % está registrado (status=%). Retrocesso de status para "%" bloqueado. Use desbloquear_diploma_para_edicao() com justificativa.',
          OLD.id, OLD.status, NEW.status;
      END IF;

      -- Consome a janela
      UPDATE diploma_unlock_windows SET used_at = NOW() WHERE id = v_unlock_id;
      RETURN NEW;
    END IF;
    -- Transição forward (registrado→gerando_rvdd→...): sempre permitida
  END IF;

  -- ── Verificar campos protegidos alterados via hstore diff ──
  FOR v_col IN
    SELECT key FROM each(hstore(NEW) - hstore(OLD))
  LOOP
    IF v_col = ANY(v_campos_livres) THEN
      CONTINUE;
    END IF;

    -- Encontrou campo protegido alterado
    v_campo_protegido_alterado := TRUE;
    EXIT; -- Basta encontrar um
  END LOOP;

  -- Só campos livres mudaram → permitir
  IF NOT v_campo_protegido_alterado THEN
    RETURN NEW;
  END IF;

  -- ── Campos protegidos mudaram → precisa de unlock window ──
  SELECT id INTO v_unlock_id
    FROM diploma_unlock_windows
    WHERE diploma_id = OLD.id
      AND used_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_unlock_id IS NULL THEN
    RAISE EXCEPTION 'HARD_LOCK: Campos protegidos do diploma % estão travados (status=%). Use desbloquear_diploma_para_edicao() com justificativa.',
      OLD.id, OLD.status;
  END IF;

  -- Consome a janela de desbloqueio
  UPDATE diploma_unlock_windows SET used_at = NOW() WHERE id = v_unlock_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_hard_lock_diploma IS
  'Trigger BEFORE UPDATE em diplomas: bloqueia alteração de campos protegidos quando status é pós-registro (registrado/gerando_rvdd/rvdd_gerado/publicado). Desbloqueio via diploma_unlock_windows com janela de 5 min.';

-- Criar o trigger (BEFORE UPDATE para poder bloquear)
DROP TRIGGER IF EXISTS trg_hard_lock_diploma ON diplomas;
CREATE TRIGGER trg_hard_lock_diploma
  BEFORE UPDATE ON diplomas
  FOR EACH ROW
  EXECUTE FUNCTION fn_hard_lock_diploma();

-- ─────────────────────────────────────────────────────────────
-- 3. RPC: desbloquear_diploma_para_edicao
--    Cria uma janela de 5 minutos para edição + grava override
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION desbloquear_diploma_para_edicao(
  p_diploma_id UUID,
  p_justificativa TEXT,
  p_campos_a_editar TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = 'public'
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_diploma RECORD;
  v_override_id UUID;
  v_window_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Obter usuário atual
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'HARD_LOCK: Usuário não autenticado.';
  END IF;

  -- Validar justificativa
  IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 10 THEN
    RAISE EXCEPTION 'HARD_LOCK: Justificativa obrigatória (mínimo 10 caracteres). Recebido: % chars.',
      COALESCE(length(trim(p_justificativa)), 0);
  END IF;

  -- Buscar diploma
  SELECT id, status INTO v_diploma
    FROM diplomas
    WHERE id = p_diploma_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HARD_LOCK: Diploma % não encontrado.', p_diploma_id;
  END IF;

  -- Verificar se está em status travado
  IF v_diploma.status NOT IN ('registrado', 'gerando_rvdd', 'rvdd_gerado', 'publicado') THEN
    RAISE EXCEPTION 'HARD_LOCK: Diploma % não está em status pós-registro (status=%). Desbloqueio não necessário.',
      p_diploma_id, v_diploma.status;
  END IF;

  -- Verificar se já existe janela ativa (evitar acúmulo)
  IF EXISTS(
    SELECT 1 FROM diploma_unlock_windows
    WHERE diploma_id = p_diploma_id
      AND used_at IS NULL
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'HARD_LOCK: Já existe janela de desbloqueio ativa para diploma %. Aguarde expirar ou use-a.',
      p_diploma_id;
  END IF;

  -- 1. Gravar override (auditoria permanente)
  INSERT INTO validacao_overrides (
    entidade_tipo,
    entidade_id,
    regra_codigo,
    valores_originais,
    justificativa,
    usuario_id
  ) VALUES (
    'diploma',
    p_diploma_id::TEXT,
    'HARD_LOCK_DESBLOQUEIO_POS_REGISTRO',
    jsonb_build_object(
      'status_atual', v_diploma.status,
      'campos_solicitados', p_campos_a_editar,
      'ip', current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'
    ),
    p_justificativa,
    v_user_id
  )
  RETURNING id INTO v_override_id;

  -- 2. Criar janela de 5 minutos
  v_expires_at := NOW() + INTERVAL '5 minutes';

  INSERT INTO diploma_unlock_windows (
    diploma_id,
    override_id,
    usuario_id,
    justificativa,
    expires_at
  ) VALUES (
    p_diploma_id,
    v_override_id,
    v_user_id,
    p_justificativa,
    v_expires_at
  )
  RETURNING id INTO v_window_id;

  -- 3. Registrar na cadeia de custódia
  INSERT INTO cadeia_custodia_diplomas (
    diploma_id,
    etapa,
    status,
    usuario_id,
    detalhes
  ) VALUES (
    p_diploma_id,
    'desbloqueio_excepcional',
    'sucesso',
    v_user_id,
    jsonb_build_object(
      'override_id', v_override_id,
      'window_id', v_window_id,
      'justificativa', p_justificativa,
      'campos_solicitados', p_campos_a_editar,
      'expires_at', v_expires_at
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'window_id', v_window_id,
    'override_id', v_override_id,
    'expires_at', v_expires_at,
    'mensagem', format('Janela de edição aberta até %s (5 minutos). Realize a edição agora.', v_expires_at)
  );
END;
$$;

COMMENT ON FUNCTION desbloquear_diploma_para_edicao IS
  'Abre janela de 5 minutos para editar campos protegidos de diploma pós-registro. Exige justificativa ≥ 10 chars. Grava em validacao_overrides + cadeia_custodia.';

-- ─────────────────────────────────────────────────────────────
-- 4. RPC auxiliar: verificar_lock_diploma
--    Retorna se um diploma está travado e se há janela ativa
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verificar_lock_diploma(p_diploma_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = 'public'
LANGUAGE plpgsql AS $$
DECLARE
  v_diploma RECORD;
  v_locked BOOLEAN;
  v_window RECORD;
  v_total_overrides INT;
BEGIN
  SELECT id, status INTO v_diploma
    FROM diplomas WHERE id = p_diploma_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'Diploma não encontrado');
  END IF;

  v_locked := v_diploma.status IN ('registrado', 'gerando_rvdd', 'rvdd_gerado', 'publicado');

  -- Buscar janela ativa
  SELECT id, expires_at, created_at INTO v_window
    FROM diploma_unlock_windows
    WHERE diploma_id = p_diploma_id
      AND used_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

  -- Total de overrides passados
  SELECT COUNT(*) INTO v_total_overrides
    FROM validacao_overrides
    WHERE entidade_tipo = 'diploma'
      AND entidade_id = p_diploma_id::TEXT
      AND regra_codigo = 'HARD_LOCK_DESBLOQUEIO_POS_REGISTRO';

  RETURN jsonb_build_object(
    'diploma_id', p_diploma_id,
    'status', v_diploma.status,
    'locked', v_locked,
    'unlock_window_active', v_window.id IS NOT NULL,
    'unlock_window_expires', v_window.expires_at,
    'total_overrides_historico', v_total_overrides
  );
END;
$$;

COMMENT ON FUNCTION verificar_lock_diploma IS
  'Consulta se diploma está travado (pós-registro) e se há janela de desbloqueio ativa.';

-- ─────────────────────────────────────────────────────────────
-- 5. Garantir RLS nas tabelas envolvidas
-- ─────────────────────────────────────────────────────────────

-- validacao_overrides (já existe, garantir RLS)
ALTER TABLE validacao_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'validacao_overrides' AND policyname = 'Authenticated can read overrides'
  ) THEN
    CREATE POLICY "Authenticated can read overrides"
      ON validacao_overrides FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'validacao_overrides' AND policyname = 'Authenticated can insert overrides'
  ) THEN
    CREATE POLICY "Authenticated can insert overrides"
      ON validacao_overrides FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
