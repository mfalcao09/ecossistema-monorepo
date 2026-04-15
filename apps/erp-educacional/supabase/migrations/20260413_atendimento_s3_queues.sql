-- ═══════════════════════════════════════════════════════════════════════
-- Sprint S3 — Tela de Conversas (13/04/2026)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS atendimento_queues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  color_hex           TEXT NOT NULL DEFAULT '#22c55e',
  distribution_type   TEXT NOT NULL DEFAULT 'sequencial'
                      CHECK (distribution_type IN ('aleatorio','sequencial','ordenado','nao_distribuir','fila_espera')),
  greeting_message    TEXT,
  visible_to_all      BOOLEAN NOT NULL DEFAULT true,
  n8n_integration_id  TEXT,
  ds_agent_id         UUID,
  account_id          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimento_queue_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id   UUID NOT NULL REFERENCES atendimento_queues(id) ON DELETE CASCADE,
  agent_id   UUID NOT NULL REFERENCES atendimento_agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (queue_id, agent_id)
);

CREATE TABLE IF NOT EXISTS atendimento_agent_statuses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES atendimento_agents(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'offline'
               CHECK (status IN ('online','offline','paused')),
  pause_reason TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id)
);

ALTER TABLE atendimento_conversations
  ADD COLUMN IF NOT EXISTS queue_id          UUID REFERENCES atendimento_queues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_number     BIGINT GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN IF NOT EXISTS window_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_read_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waiting_since     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_atend_conv_queue_id  ON atendimento_conversations(queue_id);
CREATE INDEX IF NOT EXISTS idx_atend_conv_status    ON atendimento_conversations(status);
CREATE INDEX IF NOT EXISTS idx_atend_conv_assignee  ON atendimento_conversations(assignee_id);

-- Seeds FIC
INSERT INTO atendimento_queues (name, description, color_hex, distribution_type, greeting_message)
VALUES
  ('Secretaria','Atendimento geral, informações acadêmicas e documentos','#3b82f6','sequencial','Olá {{primeiroNome}}! 👋 Você entrou na fila da Secretaria da FIC. Em breve um atendente irá te ajudar.'),
  ('Financeiro','Boletos, pagamentos, financiamentos e negociações','#f59e0b','sequencial','Olá {{primeiroNome}}! 💰 Você entrou na fila Financeira. Aguarde um instante, logo te atenderemos.'),
  ('Matrículas','Novos alunos, renovações e transferências','#22c55e','sequencial','Olá {{primeiroNome}}! 🎓 Seja bem-vindo(a) à FIC! Estamos aqui para cuidar da sua matrícula.')
ON CONFLICT DO NOTHING;
