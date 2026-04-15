-- ============================================================
-- MÓDULO FINANCEIRO — Sessão S-01 (12/04/2026)
-- Agente 1: Emissão de Cobranças (Contas a Receber)
-- Masterplan: MASTERPLAN-FIC-MULTIAGENTES-v2 / CFO / Fase 1A
-- ============================================================

-- ============================================================
-- TABELA: alunos
-- Registro de alunos ativos da FIC (mensalidades a cobrar)
-- Nota: distintos de diplomados (processo de diploma)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alunos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  nome                TEXT NOT NULL,
  cpf                 TEXT NOT NULL UNIQUE,
  email               TEXT,
  telefone            TEXT,           -- formato: 556799999999 (DDI+DDD+número, sem espaço/hífen)

  -- Matrícula
  ra                  TEXT UNIQUE,    -- Registro Acadêmico
  curso               TEXT,
  turno               TEXT CHECK (turno IN ('matutino', 'vespertino', 'noturno', 'ead')),
  semestre_atual      INT,
  data_ingresso       DATE,
  data_previsao_conclusao DATE,

  -- Financeiro
  valor_mensalidade   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  dia_vencimento      INT NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),

  -- Status
  status              TEXT NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo', 'inativo', 'trancado', 'formado', 'cancelado')),

  -- Endereço (necessário para emissão de boleto Inter)
  endereco            TEXT,
  cidade              TEXT,
  uf                  CHAR(2),
  cep                 TEXT,

  -- Controle
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.alunos_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER alunos_updated_at
  BEFORE UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.alunos_set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_alunos_cpf     ON public.alunos(cpf);
CREATE INDEX IF NOT EXISTS idx_alunos_status  ON public.alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_curso   ON public.alunos(curso);


-- ============================================================
-- TABELA: cobrancas
-- Boletos Bolepix emitidos via Banco Inter
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cobrancas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id                UUID NOT NULL REFERENCES public.alunos(id),

  -- Identificadores Banco Inter
  inter_request_code      TEXT UNIQUE,    -- código gerado pelo Inter no momento da emissão
  your_number             TEXT UNIQUE,    -- "FIC-{aluno_id_curto}-{YYYYMM}" — chave de rastreamento

  -- Dados da cobrança
  valor                   DECIMAL(10,2) NOT NULL,
  mes_referencia          DATE NOT NULL,  -- primeiro dia do mês: 2026-05-01 = maio/2026
  data_vencimento         DATE NOT NULL,

  -- Status do ciclo de vida
  status                  TEXT NOT NULL DEFAULT 'gerado'
                            CHECK (status IN ('gerado', 'enviado', 'pago', 'vencido', 'cancelado')),
  data_pagamento          TIMESTAMPTZ,
  forma_pagamento         TEXT CHECK (forma_pagamento IN ('PIX', 'BOLETO')),
  valor_recebido          DECIMAL(10,2),
  txid_pix                TEXT,           -- ID da transação PIX (quando aplicável)

  -- Documento do Bolepix
  bolepix_pdf_url         TEXT,           -- URL no Supabase Storage
  bolepix_linha_digitavel TEXT,           -- linha digitável (34 ou 47 dígitos)
  bolepix_pix_copia_cola  TEXT,           -- PIX copia e cola (EMV)

  -- Comprovante manual (Fluxo 3 — aluno envia via WhatsApp)
  comprovante_recebido    BOOLEAN DEFAULT FALSE,
  comprovante_verificado  BOOLEAN DEFAULT FALSE,

  -- Idempotência (evita processar webhook duplicado do Inter)
  webhook_processado      BOOLEAN DEFAULT FALSE,

  -- Controle
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.cobrancas_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.cobrancas_set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_cobrancas_aluno       ON public.cobrancas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status      ON public.cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_referencia  ON public.cobrancas(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_cobrancas_request_code ON public.cobrancas(inter_request_code);


-- ============================================================
-- TABELA: comunicacoes
-- Log de todas as mensagens enviadas aos alunos
-- (WhatsApp, e-mail — qualquer canal)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comunicacoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      UUID NOT NULL REFERENCES public.alunos(id),
  cobranca_id   UUID REFERENCES public.cobrancas(id),

  tipo          TEXT NOT NULL
                  CHECK (tipo IN (
                    'envio_boleto',
                    'confirmacao_pagamento',
                    'lembrete_vencimento',
                    'comprovante_recebido',
                    'pagamento_nao_localizado',
                    'cobranca_inadimplencia'
                  )),
  canal         TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email')),
  status        TEXT NOT NULL DEFAULT 'enviado'
                  CHECK (status IN ('enviado', 'entregue', 'lido', 'falhou')),
  conteudo      TEXT,            -- texto da mensagem enviada
  error_msg     TEXT,            -- mensagem de erro se status = 'falhou'

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_aluno     ON public.comunicacoes(aluno_id);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_cobranca  ON public.comunicacoes(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_tipo      ON public.comunicacoes(tipo);


-- ============================================================
-- TABELA: comprovantes_recebidos
-- Comprovantes de pagamento enviados por alunos via WhatsApp
-- (Fluxo 3 — verificação via Claude Vision + consulta Inter)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comprovantes_recebidos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id            UUID NOT NULL REFERENCES public.alunos(id),
  cobranca_id         UUID REFERENCES public.cobrancas(id),

  tipo_arquivo        TEXT CHECK (tipo_arquivo IN ('imagem', 'pdf', 'texto')),
  conteudo_raw        TEXT,       -- texto extraído (Claude Vision OCR ou texto direto)
  whatsapp_media_id   TEXT,       -- ID da mídia na API WhatsApp (para download posterior)

  -- Resultado da verificação no sistema Inter
  verificado          BOOLEAN DEFAULT FALSE,
  resultado           TEXT CHECK (resultado IN ('confirmado', 'pendente', 'nao_encontrado')),
  tentativas          INT DEFAULT 1,
  proxima_tentativa   TIMESTAMPTZ,  -- para retry automático via Trigger.dev

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comprovantes_aluno     ON public.comprovantes_recebidos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_resultado ON public.comprovantes_recebidos(resultado);


-- ============================================================
-- ROW LEVEL SECURITY — todas as tabelas financeiras
-- Padrão ERP: RLS ON + policy authenticated (auth.uid() IS NOT NULL)
-- ============================================================
ALTER TABLE public.alunos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprovantes_recebidos ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (usuário autenticado via Supabase Auth)
CREATE POLICY "alunos_authenticated_access"
  ON public.alunos FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cobrancas_authenticated_access"
  ON public.cobrancas FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "comunicacoes_authenticated_access"
  ON public.comunicacoes FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "comprovantes_authenticated_access"
  ON public.comprovantes_recebidos FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Service role (agentes Python via service_role key) — acesso total
CREATE POLICY "alunos_service_role_access"
  ON public.alunos FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "cobrancas_service_role_access"
  ON public.cobrancas FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "comunicacoes_service_role_access"
  ON public.comunicacoes FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "comprovantes_service_role_access"
  ON public.comprovantes_recebidos FOR ALL
  TO service_role
  USING (true);


-- ============================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================
COMMENT ON TABLE public.alunos IS 'Módulo Financeiro — registro de alunos ativos da FIC para cobrança mensal. Distinto de diplomados (processo de diploma digital).';
COMMENT ON TABLE public.cobrancas IS 'Módulo Financeiro — Bolepix emitidos via Banco Inter. Um registro por aluno por mês de referência.';
COMMENT ON TABLE public.comunicacoes IS 'Módulo Financeiro — log auditável de todas as mensagens enviadas por qualquer canal (WhatsApp, e-mail).';
COMMENT ON TABLE public.comprovantes_recebidos IS 'Módulo Financeiro — comprovantes enviados por alunos via WhatsApp, verificados via Claude Vision + consulta Inter.';
