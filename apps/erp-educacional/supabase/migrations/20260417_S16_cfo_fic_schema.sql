-- ============================================================
-- Migration: S16 CFO-FIC — Schema additions para agent tools
-- DB alvo: FIC / ERP-Educacional (ifdnjieklngcfodmtied)
-- Data: 2026-04-17
-- Sessão: S16 (Piloto CFO-FIC E2E)
--
-- O que faz:
--   1. alunos: adiciona whatsapp_jid (generated), bairro, endereco_numero
--   2. comunicacoes: adiciona estagio, message_id; expande status CHECK
--   3. idempotency_cache: Art. III hook (evita duplicata de tools)
--   4. VIEW alunos_view_inadimplencia: usada por check_inadimplentes tool
-- ============================================================


-- ============================================================
-- 1. alunos — whatsapp_jid, bairro, endereco_numero
-- ============================================================

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS bairro          TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT;

-- whatsapp_jid como coluna gerada a partir de telefone
-- Formato Evolution API: "5567999999999@s.whatsapp.net"
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS whatsapp_jid TEXT
    GENERATED ALWAYS AS (
      CASE
        WHEN telefone IS NOT NULL AND telefone <> ''
        THEN telefone || '@s.whatsapp.net'
        ELSE NULL
      END
    ) STORED;

COMMENT ON COLUMN public.alunos.whatsapp_jid IS
  'JID Evolution API gerado de telefone: {DDD+numero}@s.whatsapp.net';
COMMENT ON COLUMN public.alunos.bairro IS
  'Bairro do aluno (necessário para emissão de boleto Inter)';
COMMENT ON COLUMN public.alunos.endereco_numero IS
  'Número do endereço (separado de endereco/logradouro)';


-- ============================================================
-- 2. comunicacoes — estagio, message_id, status expandido
-- ============================================================

ALTER TABLE public.comunicacoes
  ADD COLUMN IF NOT EXISTS estagio    TEXT,
  ADD COLUMN IF NOT EXISTS message_id TEXT;

-- Expande CHECK de status para incluir sem_contato
ALTER TABLE public.comunicacoes
  DROP CONSTRAINT IF EXISTS comunicacoes_status_check;

ALTER TABLE public.comunicacoes
  ADD CONSTRAINT comunicacoes_status_check
  CHECK (status IN ('enviado', 'entregue', 'lido', 'falhou', 'sem_contato'));

-- Expande CHECK de tipo para incluir cobranca_inadimplencia (usado pelo CFO-FIC tool)
-- O tipo original de comunicacoes não tinha esta entrada
ALTER TABLE public.comunicacoes
  DROP CONSTRAINT IF EXISTS comunicacoes_tipo_check;

-- Recria sem constraint rígida (estagio torna tipo redundante; mantemos para compatibilidade)
ALTER TABLE public.comunicacoes
  ADD CONSTRAINT comunicacoes_tipo_check
  CHECK (tipo IN (
    'envio_boleto',
    'confirmacao_pagamento',
    'lembrete_vencimento',
    'comprovante_recebido',
    'pagamento_nao_localizado',
    'cobranca_inadimplencia',
    'pix_demanda_enviado',
    'restricao_aplicada',
    'restricao_removida'
  ));

COMMENT ON COLUMN public.comunicacoes.estagio IS
  'Estágio da régua: lembrete-3d | vencido-1d | vencido-15d | vencido-30d';
COMMENT ON COLUMN public.comunicacoes.message_id IS
  'ID da mensagem retornado pela Evolution API (WhatsApp key.id)';

-- Índice para idempotência de envio (Art. III)
CREATE INDEX IF NOT EXISTS idx_comunicacoes_estagio
  ON public.comunicacoes(aluno_id, estagio, canal, created_at DESC);


-- ============================================================
-- 3. idempotency_cache — Art. III hook do CFO-FIC
-- ============================================================

CREATE TABLE IF NOT EXISTS public.idempotency_cache (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT    NOT NULL UNIQUE,
  agent_id   TEXT    NOT NULL,
  tool_name  TEXT    NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key_date
  ON public.idempotency_cache(key, created_at DESC);

ALTER TABLE public.idempotency_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_cache_service_role"
  ON public.idempotency_cache FOR ALL
  TO service_role
  USING (true);


-- ============================================================
-- 4. VIEW: alunos_view_inadimplencia
--
-- Retorna alunos com COBRANÇA MAIS RECENTE vencida.
-- cpf_hash e whatsapp_hash: LGPD (md5 dos dados sensíveis).
-- ============================================================

CREATE OR REPLACE VIEW public.alunos_view_inadimplencia AS
WITH cobranca_recente AS (
  SELECT DISTINCT ON (aluno_id)
    id,
    aluno_id,
    valor,
    data_vencimento,
    (CURRENT_DATE - data_vencimento)::int  AS dias_atraso
  FROM public.cobrancas
  WHERE status IN ('gerado', 'enviado', 'vencido')
    AND tipo = 'mensalidade'
    AND data_vencimento < CURRENT_DATE
  ORDER BY aluno_id, data_vencimento DESC
)
SELECT
  a.id                                      AS aluno_id,
  a.nome,
  md5(a.cpf)                                AS cpf_hash,
  a.curso,
  NULL::uuid                                AS curso_id,
  c.dias_atraso,
  a.valor_mensalidade                       AS mensalidade_valor,
  c.id                                      AS cobranca_ativa_id,
  CASE WHEN a.telefone IS NOT NULL
       THEN md5(a.telefone)
       ELSE NULL
  END                                       AS whatsapp_hash
FROM public.alunos a
JOIN cobranca_recente c ON c.aluno_id = a.id
WHERE a.status = 'ativo';

COMMENT ON VIEW public.alunos_view_inadimplencia IS
  'S16 CFO-FIC: alunos inadimplentes com cobrança mais recente. '
  'cpf_hash e whatsapp_hash para LGPD — nunca expor CPF ou telefone raw.';

-- Acesso ao service_role (agent tools rodam com service key)
GRANT SELECT ON public.alunos_view_inadimplencia TO service_role;


-- ============================================================
-- 5. Índice extra em cobrancas para performance do view
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cobrancas_inadimplencia
  ON public.cobrancas(aluno_id, data_vencimento DESC)
  WHERE status IN ('gerado', 'enviado', 'vencido')
    AND tipo = 'mensalidade';
