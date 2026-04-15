-- ============================================================
-- MÓDULO FINANCEIRO — Régua de Cobrança (Sessão 085, 13/04/2026)
-- S-03: Inadimplência, PIX sob demanda, escalada de mensagens
-- ============================================================


-- ============================================================
-- 1. ALTER TABLE alunos — desconto de pontualidade
-- ============================================================

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS desconto_pontualidade DECIMAL(5,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.alunos.desconto_pontualidade IS
  'Percentual de desconto de pontualidade (0-25). Definido na rematrícula. Ex: 25.00 = 25%.';


-- ============================================================
-- 2. ALTER TABLE cobrancas — novos campos + expandir status
-- ============================================================

-- Remover constraint antiga do status (vai recriar com novos valores)
ALTER TABLE public.cobrancas
  DROP CONSTRAINT IF EXISTS cobrancas_status_check;

-- Adicionar novos campos
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS tipo               TEXT NOT NULL DEFAULT 'mensalidade',
  ADD COLUMN IF NOT EXISTS desconto_aplicado  DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS cobranca_pai_id    UUID REFERENCES public.cobrancas(id);

-- Recriar constraint de status com valores expandidos
ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_status_check
  CHECK (status IN (
    'gerado',            -- boleto emitido, aguardando pagamento
    'enviado',           -- boleto enviado ao aluno (e-mail/WhatsApp)
    'pago',              -- pago dentro do prazo (com desconto)
    'pago_sem_desconto', -- pago no vencimento mas sem desconto
    'vencido',           -- boleto expirou sem pagamento
    'pago_em_atraso',    -- pago após vencimento via PIX sob demanda
    'negociando',        -- aluno entrou em contato para negociar
    'cancelado'          -- cancelado manualmente
  ));

-- Recriar constraint de tipo
ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_tipo_check
  CHECK (tipo IN ('mensalidade', 'pix_atraso'));

COMMENT ON COLUMN public.cobrancas.tipo IS
  'mensalidade = Bolepix emitido mensalmente | pix_atraso = PIX gerado sob demanda após vencimento';
COMMENT ON COLUMN public.cobrancas.desconto_aplicado IS
  'Snapshot do % de desconto aplicado no momento da emissão. Preserva histórico mesmo se aluno mudar desconto.';
COMMENT ON COLUMN public.cobrancas.cobranca_pai_id IS
  'Para PIX sob demanda: referência ao boleto original que venceu.';


-- ============================================================
-- 3. CREATE TABLE inadimplencia_diaria
-- Acumula multa + juros pro rata por dia de atraso
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inadimplencia_diaria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id     UUID NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  aluno_id        UUID NOT NULL REFERENCES public.alunos(id),

  data_referencia DATE NOT NULL,    -- dia do cálculo (ex: 2026-05-09, 2026-05-10...)
  dias_atraso     INT  NOT NULL,    -- ex: 1 (dia 09) , 2 (dia 10), ...

  valor_principal DECIMAL(10,2) NOT NULL,  -- valor original da mensalidade SEM desconto
  valor_multa     DECIMAL(10,2) NOT NULL,  -- 10% fixo, aplicado UMA VEZ no dia 09
  valor_juros_acum DECIMAL(10,2) NOT NULL, -- 2%/mês × (dias_atraso / 30) acumulado
  valor_total     DECIMAL(10,2) NOT NULL,  -- principal + multa + juros acumulados

  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Garante 1 registro por dia por cobrança
  UNIQUE (cobranca_id, data_referencia)
);

-- RLS
ALTER TABLE public.inadimplencia_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inadimplencia_diaria_authenticated"
  ON public.inadimplencia_diaria FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "inadimplencia_diaria_service_role"
  ON public.inadimplencia_diaria FOR ALL
  TO service_role
  USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inadimplencia_cobranca
  ON public.inadimplencia_diaria(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_inadimplencia_aluno
  ON public.inadimplencia_diaria(aluno_id);
CREATE INDEX IF NOT EXISTS idx_inadimplencia_data
  ON public.inadimplencia_diaria(data_referencia);

COMMENT ON TABLE public.inadimplencia_diaria IS
  'Saldo devedor calculado dia a dia para cobranças vencidas. 1 registro/dia por cobrança.';


-- ============================================================
-- 4. CREATE TABLE pix_demanda
-- PIX gerado sob demanda (portal do aluno ou WhatsApp "SIM")
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pix_demanda (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id          UUID NOT NULL REFERENCES public.cobrancas(id),
  aluno_id             UUID NOT NULL REFERENCES public.alunos(id),

  -- Dados do PIX no Banco Inter
  inter_request_code   TEXT,         -- codigoSolicitacao retornado pelo Inter
  txid                 TEXT,
  pix_copia_cola       TEXT,
  valor                DECIMAL(10,2) NOT NULL,   -- valor exato do dia (principal+multa+juros)
  data_validade        DATE NOT NULL,            -- expira às 23:59 deste dia (numDiasAgenda=0)

  -- Rastreabilidade
  canal_solicitacao    TEXT CHECK (canal_solicitacao IN ('portal', 'whatsapp')),
  dias_atraso_no_momento INT,                    -- snapshot: quantos dias de atraso quando gerado

  -- Status do PIX
  status               TEXT NOT NULL DEFAULT 'ativo'
                         CHECK (status IN ('ativo', 'pago', 'expirado', 'cancelado')),

  created_at           TIMESTAMPTZ DEFAULT NOW(),

  -- Apenas 1 PIX ativo por dia por cobrança
  UNIQUE (cobranca_id, data_validade)
);

-- RLS
ALTER TABLE public.pix_demanda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pix_demanda_authenticated"
  ON public.pix_demanda FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "pix_demanda_service_role"
  ON public.pix_demanda FOR ALL
  TO service_role
  USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pix_demanda_cobranca
  ON public.pix_demanda(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_pix_demanda_aluno
  ON public.pix_demanda(aluno_id);
CREATE INDEX IF NOT EXISTS idx_pix_demanda_status
  ON public.pix_demanda(status);
CREATE INDEX IF NOT EXISTS idx_pix_demanda_validade
  ON public.pix_demanda(data_validade);

COMMENT ON TABLE public.pix_demanda IS
  'PIX gerado sob demanda após vencimento do boleto. 1 por dia por cobrança. Expira às 23:59 da data_validade.';


-- ============================================================
-- 5. CREATE TABLE restricoes_aluno
-- Restrições ativas: portal, rematrícula, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.restricoes_aluno (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id        UUID NOT NULL REFERENCES public.alunos(id),
  cobranca_id     UUID REFERENCES public.cobrancas(id),

  tipo            TEXT NOT NULL
                    CHECK (tipo IN (
                      'bloquear_portal',      -- bloqueia acesso ao portal do aluno
                      'impedir_rematricula'   -- impede rematrícula no semestre seguinte
                    )),
  motivo          TEXT,                       -- descrição legível (ex: "Débito maio/2026 em aberto")
  ativa           BOOLEAN NOT NULL DEFAULT TRUE,

  -- Criação
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  criado_por      TEXT DEFAULT 'sistema',     -- 'sistema' = automático | UUID = operador humano

  -- Remoção (quando aluno paga)
  removida_em     TIMESTAMPTZ,
  removida_por    TEXT,                       -- UUID do operador ou 'sistema'
  motivo_remocao  TEXT
);

-- RLS
ALTER TABLE public.restricoes_aluno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restricoes_aluno_authenticated"
  ON public.restricoes_aluno FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "restricoes_aluno_service_role"
  ON public.restricoes_aluno FOR ALL
  TO service_role
  USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_restricoes_aluno_id
  ON public.restricoes_aluno(aluno_id);
CREATE INDEX IF NOT EXISTS idx_restricoes_aluno_ativa
  ON public.restricoes_aluno(aluno_id, ativa)
  WHERE ativa = TRUE;

COMMENT ON TABLE public.restricoes_aluno IS
  'Restrições ativas para alunos inadimplentes. Criadas automaticamente pelo sistema e removidas após pagamento.';


-- ============================================================
-- 6. Expandir enum de comunicacoes.tipo com novos tipos de régua
-- ============================================================

ALTER TABLE public.comunicacoes
  DROP CONSTRAINT IF EXISTS comunicacoes_tipo_check;

ALTER TABLE public.comunicacoes
  ADD CONSTRAINT comunicacoes_tipo_check
  CHECK (tipo IN (
    'envio_boleto',
    'confirmacao_pagamento',
    'lembrete_vencimento',
    'comprovante_recebido',
    'pagamento_nao_localizado',
    'cobranca_inadimplencia',
    'pix_demanda_enviado',      -- quando enviamos PIX sob demanda ao aluno
    'restricao_aplicada',       -- notificação de restrição ativada
    'restricao_removida'        -- notificação de restrição removida (pagamento confirmado)
  ));


-- ============================================================
-- Comentários finais
-- ============================================================

COMMENT ON TABLE public.alunos IS
  'Módulo Financeiro — alunos ativos da FIC. desconto_pontualidade definido na rematrícula.';
