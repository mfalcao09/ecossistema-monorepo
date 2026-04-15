-- ============================================================
-- SECURITY EVENTS TABLE — Logging centralizado de eventos
-- ERP Educacional FIC
--
-- Armazena todos os eventos de segurança em estrutura otimizada
-- para query e análise de incidentes.
-- ============================================================

-- ── Criar tabela principal de eventos de segurança ───────────
CREATE TABLE IF NOT EXISTS public.security_events (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Evento
  tipo VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Usuário e IP
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip INET NOT NULL,
  user_agent TEXT,

  -- Requisição
  rota VARCHAR(255) NOT NULL,
  metodo VARCHAR(10) NOT NULL,
  status_code INTEGER,

  -- Risco
  risco VARCHAR(20) NOT NULL CHECK (risco IN ('baixo', 'medio', 'alto', 'critico')),

  -- Detalhes flexíveis em JSON
  detalhes JSONB,

  -- Metadados
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Comentários para documentação ──────────────────────────
COMMENT ON TABLE public.security_events IS 'Eventos de segurança capturados em tempo real: autenticação, acesso, rate limits, inputs suspeitos, LGPD, etc.';
COMMENT ON COLUMN public.security_events.tipo IS 'Tipo de evento: AUTH_SUCCESS, AUTH_FAILURE, PERMISSION_DENIED, etc.';
COMMENT ON COLUMN public.security_events.risco IS 'Nível de risco do evento: baixo, medio, alto, critico';
COMMENT ON COLUMN public.security_events.detalhes IS 'Dados estruturados do evento em JSON (flexível por tipo)';

-- ── Índices para performance ────────────────────────────────

-- Índice primário: tipo + timestamp (queries mais comuns)
CREATE INDEX idx_security_events_tipo_timestamp
  ON public.security_events(tipo, timestamp DESC);

-- Índice por usuário + timestamp (auditorias por user)
CREATE INDEX idx_security_events_usuario_timestamp
  ON public.security_events(usuario_id, timestamp DESC);

-- Índice por IP + timestamp (análise de IPs suspeitos)
CREATE INDEX idx_security_events_ip_timestamp
  ON public.security_events(ip, timestamp DESC);

-- Índice por risco + timestamp (alertas de eventos críticos)
CREATE INDEX idx_security_events_risco_timestamp
  ON public.security_events(risco, timestamp DESC)
  WHERE risco IN ('alto', 'critico');

-- Índice por rota + timestamp (análise por endpoint)
CREATE INDEX idx_security_events_rota_timestamp
  ON public.security_events(rota, timestamp DESC);

-- Índice BRIN para timestamp (otimizado para dados time-series)
CREATE INDEX idx_security_events_timestamp_brin
  ON public.security_events USING BRIN(timestamp);

-- ── Particionamento por mês (para otimizar volumes altos) ────
-- Nota: Aplicar após 30 dias de dados
-- ALTER TABLE public.security_events
--   PARTITION BY RANGE (DATE_TRUNC('month', timestamp));

-- ── Política de retenção de dados (90 dias) ────────────────
-- Tabela para rastrear última limpeza
CREATE TABLE IF NOT EXISTS public.security_events_cleanup_log (
  id SERIAL PRIMARY KEY,
  ultima_limpeza TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  registros_removidos BIGINT,
  dias_retencao INTEGER DEFAULT 90
);

-- Função para remover eventos antigos (90 dias)
CREATE OR REPLACE FUNCTION public.limpar_security_events_antigos()
RETURNS TABLE(registros_removidos BIGINT) AS $$
DECLARE
  v_deletados BIGINT;
BEGIN
  -- Deletar eventos com mais de 90 dias
  DELETE FROM public.security_events
  WHERE timestamp < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deletados = ROW_COUNT;

  -- Registrar limpeza
  INSERT INTO public.security_events_cleanup_log(registros_removidos, ultima_limpeza)
  VALUES (v_deletados, NOW());

  RETURN QUERY SELECT v_deletados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC para análise de eventos suspeitos ────────────────────
CREATE OR REPLACE FUNCTION public.analisar_eventos_suspeitos(
  p_horas INTEGER DEFAULT 1,
  p_limite_falhas INTEGER DEFAULT 5
)
RETURNS TABLE(
  ip INET,
  total_falhas INTEGER,
  tipos_evento TEXT[],
  primeiro_evento TIMESTAMP,
  ultimo_evento TIMESTAMP,
  risco_calculado VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.ip,
    COUNT(*)::INTEGER as total_falhas,
    ARRAY_AGG(DISTINCT se.tipo) as tipos_evento,
    MIN(se.timestamp) as primeiro_evento,
    MAX(se.timestamp) as ultimo_evento,
    CASE
      WHEN COUNT(*) >= p_limite_falhas * 2 THEN 'critico'
      WHEN COUNT(*) >= p_limite_falhas THEN 'alto'
      ELSE 'medio'
    END as risco_calculado
  FROM public.security_events se
  WHERE
    se.timestamp > NOW() - (p_horas || ' hours')::INTERVAL
    AND se.risco IN ('medio', 'alto', 'critico')
  GROUP BY se.ip
  HAVING COUNT(*) >= p_limite_falhas
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- ── RPC para auditoria por usuário ──────────────────────────
CREATE OR REPLACE FUNCTION public.auditoria_usuario(
  p_usuario_id UUID,
  p_dias INTEGER DEFAULT 7,
  p_limite INTEGER DEFAULT 100
)
RETURNS TABLE(
  timestamp TIMESTAMP WITH TIME ZONE,
  tipo VARCHAR,
  rota VARCHAR,
  metodo VARCHAR,
  ip INET,
  risco VARCHAR,
  detalhes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.timestamp,
    se.tipo,
    se.rota,
    se.metodo,
    se.ip,
    se.risco,
    se.detalhes
  FROM public.security_events se
  WHERE
    se.usuario_id = p_usuario_id
    AND se.timestamp > NOW() - (p_dias || ' days')::INTERVAL
  ORDER BY se.timestamp DESC
  LIMIT p_limite;
END;
$$ LANGUAGE plpgsql;

-- ── RPC para estatísticas de segurança ──────────────────────
CREATE OR REPLACE FUNCTION public.estatisticas_seguranca(
  p_horas INTEGER DEFAULT 24
)
RETURNS TABLE(
  tipo VARCHAR,
  total INTEGER,
  critico INTEGER,
  alto INTEGER,
  medio INTEGER,
  baixo INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.tipo,
    COUNT(*)::INTEGER as total,
    COUNT(*) FILTER (WHERE se.risco = 'critico')::INTEGER as critico,
    COUNT(*) FILTER (WHERE se.risco = 'alto')::INTEGER as alto,
    COUNT(*) FILTER (WHERE se.risco = 'medio')::INTEGER as medio,
    COUNT(*) FILTER (WHERE se.risco = 'baixo')::INTEGER as bajo
  FROM public.security_events se
  WHERE se.timestamp > NOW() - (p_horas || ' hours')::INTERVAL
  GROUP BY se.tipo
  ORDER BY total DESC;
END;
$$ LANGUAGE plpgsql;

-- ── RPC para buscar eventos por tipo ────────────────────────
CREATE OR REPLACE FUNCTION public.buscar_eventos_seguranca(
  p_tipo VARCHAR DEFAULT NULL,
  p_risco VARCHAR DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_desde TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_ate TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limite INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  tipo VARCHAR,
  timestamp TIMESTAMP WITH TIME ZONE,
  usuario_id UUID,
  ip INET,
  rota VARCHAR,
  metodo VARCHAR,
  status_code INTEGER,
  risco VARCHAR,
  detalhes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.tipo,
    se.timestamp,
    se.usuario_id,
    se.ip,
    se.rota,
    se.metodo,
    se.status_code,
    se.risco,
    se.detalhes
  FROM public.security_events se
  WHERE
    (p_tipo IS NULL OR se.tipo = p_tipo)
    AND (p_risco IS NULL OR se.risco = p_risco)
    AND (p_usuario_id IS NULL OR se.usuario_id = p_usuario_id)
    AND (p_desde IS NULL OR se.timestamp >= p_desde)
    AND (p_ate IS NULL OR se.timestamp <= p_ate)
  ORDER BY se.timestamp DESC
  LIMIT p_limite;
END;
$$ LANGUAGE plpgsql;

-- ── RLS (Row Level Security) para segurança de dados ─────────
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Política: admins podem ler todos os eventos
CREATE POLICY "Admins can view all security events"
  ON public.security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Política: usuários podem ver apenas seus próprios eventos
CREATE POLICY "Users can view their own security events"
  ON public.security_events
  FOR SELECT
  USING (usuario_id = auth.uid());

-- ── Grant permissions ──────────────────────────────────────
GRANT SELECT ON public.security_events TO authenticated;
GRANT SELECT ON public.security_events TO service_role;
GRANT INSERT ON public.security_events TO service_role;
GRANT EXECUTE ON FUNCTION public.limpar_security_events_antigos() TO service_role;
GRANT EXECUTE ON FUNCTION public.analisar_eventos_suspeitos(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_usuario(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estatisticas_seguranca(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_eventos_seguranca(VARCHAR, VARCHAR, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER) TO authenticated;
