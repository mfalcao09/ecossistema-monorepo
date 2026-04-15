-- ============================================================
-- MÓDULO ATENDIMENTO — Sprint 1 (12/04/2026)
-- Sessão 085 | Módulo base para NEXVY (MVP single-tenant FIC)
-- Estratégia: single-tenant agora → multi-tenant na Fase 2
--
-- Nota: colunas account_id já existem como UUID nullable
-- Para Fase 2: NOT NULL + RLS em todas as tabelas
-- ============================================================

-- ============================================================
-- TABELA: atendimento_inboxes
-- Caixas de entrada (1 por canal: WhatsApp, Instagram, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_inboxes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  name                TEXT NOT NULL,
  channel_type        TEXT NOT NULL CHECK (channel_type IN (
                        'whatsapp', 'instagram', 'messenger', 'telegram',
                        'email', 'api', 'sms'
                      )),

  -- Config do provedor (tokens, phone IDs, etc.) — criptografado via Vault
  provider_config     JSONB NOT NULL DEFAULT '{}',

  -- Meta: mensagem de boas-vindas, horário de atendimento
  working_hours       JSONB DEFAULT '{"enabled": false}',
  welcome_message     TEXT,
  away_message        TEXT,

  -- Status
  enabled             BOOLEAN NOT NULL DEFAULT true,

  -- Fase 2: account_id para multi-tenancy
  account_id          UUID,  -- nullable agora, NOT NULL na Fase 2

  -- Controle
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atendimento_inboxes_channel_type
  ON public.atendimento_inboxes(channel_type);

-- ============================================================
-- TABELA: atendimento_contacts
-- Contatos: alunos, candidatos, responsáveis, interessados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  name                TEXT NOT NULL,
  phone_number        TEXT,
  email               TEXT,

  -- Identificador externo (WhatsApp ID, Instagram ID, etc.)
  phone_number_e164   TEXT,            -- formato E.164: +5511987654321
  external_id         TEXT,            -- ID no canal (WhatsApp contact ID)

  -- Metadados adicionais (tags, segmento, etc.)
  additional_attributes JSONB DEFAULT '{}',

  -- Vínculo com aluno do ERP (opcional)
  aluno_id            UUID,            -- FK para tabela alunos (se existir)

  -- Fase 2: account_id para multi-tenancy
  account_id          UUID,

  -- Controle
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atendimento_contacts_phone
  ON public.atendimento_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_atendimento_contacts_email
  ON public.atendimento_contacts(email);

-- ============================================================
-- TABELA: atendimento_conversations
-- Conversas (estado central do módulo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relacionamentos
  inbox_id            UUID NOT NULL REFERENCES public.atendimento_inboxes(id) ON DELETE CASCADE,
  contact_id          UUID NOT NULL REFERENCES public.atendimento_contacts(id) ON DELETE CASCADE,

  -- Agente atribuído (FK para users do Supabase Auth)
  assignee_id         UUID,            -- auth.users.id

  -- Time atribuído (futuro)
  team_id             UUID,

  -- Status da conversa
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'resolved', 'pending', 'snoozed')),

  -- Prioridade
  priority            TEXT DEFAULT 'none'
                        CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),

  -- ID externo no canal (WhatsApp conversation ID, etc.)
  channel_conversation_id TEXT,

  -- Metadados (etiquetas, atributos customizados)
  meta                JSONB DEFAULT '{}',

  -- Última atividade (para ordenação na lista)
  last_activity_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Contadores (cacheados para performance)
  unread_count        INT DEFAULT 0,

  -- Snoozed até quando
  snoozed_until       TIMESTAMPTZ,

  -- Fase 2: account_id para multi-tenancy
  account_id          UUID,

  -- Controle
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices críticos (alta performance na lista de conversas)
CREATE INDEX IF NOT EXISTS idx_atendimento_conv_status
  ON public.atendimento_conversations(status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_atendimento_conv_inbox
  ON public.atendimento_conversations(inbox_id, status);
CREATE INDEX IF NOT EXISTS idx_atendimento_conv_assignee
  ON public.atendimento_conversations(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_atendimento_conv_contact
  ON public.atendimento_conversations(contact_id);

-- ============================================================
-- TABELA: atendimento_messages
-- Mensagens (maior volume — bem indexada)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relacionamentos
  conversation_id     UUID NOT NULL REFERENCES public.atendimento_conversations(id) ON DELETE CASCADE,

  -- Conteúdo
  content             TEXT,
  message_type        TEXT NOT NULL DEFAULT 'incoming'
                        CHECK (message_type IN ('incoming', 'outgoing', 'activity', 'template')),
  content_type        TEXT NOT NULL DEFAULT 'text'
                        CHECK (content_type IN (
                          'text', 'image', 'audio', 'video', 'file',
                          'location', 'sticker', 'template', 'activity'
                        )),

  -- Metadados do canal (ID da mensagem no WhatsApp/Meta, status, etc.)
  channel_message_id  TEXT,           -- ID da mensagem na Meta API
  status              TEXT DEFAULT 'sent'
                        CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending')),

  -- Anexos (URLs, JSONB com metadata)
  attachments         JSONB DEFAULT '[]',

  -- Para quem enviou (agente que enviou, se outgoing)
  sender_id           UUID,           -- auth.users.id se enviado por agente
  sender_type         TEXT DEFAULT 'contact'
                        CHECK (sender_type IN ('contact', 'agent', 'bot', 'system')),

  -- Template HSM (se message_type = 'template')
  template_params     JSONB,

  -- Fase 2: account_id
  account_id          UUID,

  -- Controle
  created_at          TIMESTAMPTZ DEFAULT NOW()
  -- Sem updated_at: mensagens são imutáveis
);

-- Índices críticos para busca e listagem
CREATE INDEX IF NOT EXISTS idx_atendimento_messages_conv
  ON public.atendimento_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_atendimento_messages_status
  ON public.atendimento_messages(status) WHERE status = 'failed';
-- Full-text search no conteúdo
CREATE INDEX IF NOT EXISTS idx_atendimento_messages_content_gin
  ON public.atendimento_messages USING GIN(to_tsvector('portuguese', coalesce(content, '')));

-- ============================================================
-- TABELA: atendimento_labels
-- Etiquetas para classificar conversas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_labels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title               TEXT NOT NULL,
  description         TEXT,
  color               TEXT NOT NULL DEFAULT '#6366f1',  -- cor hex
  show_on_sidebar     BOOLEAN DEFAULT true,

  -- Fase 2: account_id
  account_id          UUID,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: etiquetas padrão para a FIC
INSERT INTO public.atendimento_labels (title, description, color) VALUES
  ('Matrícula',    'Dúvidas sobre processo de matrícula',      '#3b82f6'),
  ('Financeiro',   'Mensalidades, boletos, inadimplência',      '#f59e0b'),
  ('Acadêmico',    'Notas, disciplinas, horários',              '#10b981'),
  ('Diploma',      'Processo de emissão de diploma',            '#6366f1'),
  ('Secretaria',   'Documentos, declarações, requerimentos',    '#8b5cf6'),
  ('Urgente',      'Atendimento prioritário',                   '#ef4444')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: atendimento_conversation_labels
-- Relacionamento N:N entre conversas e etiquetas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_conversation_labels (
  conversation_id     UUID NOT NULL REFERENCES public.atendimento_conversations(id) ON DELETE CASCADE,
  label_id            UUID NOT NULL REFERENCES public.atendimento_labels(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, label_id)
);

-- ============================================================
-- TABELA: atendimento_agents
-- Agentes que atendem (funcionários da FIC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_agents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo com auth.users (pode ser NULL se ainda não tem login)
  user_id             UUID UNIQUE,  -- auth.users.id

  -- Dados do agente
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  avatar_url          TEXT,

  -- Disponibilidade
  availability_status TEXT NOT NULL DEFAULT 'offline'
                        CHECK (availability_status IN ('online', 'busy', 'offline')),

  -- Papel
  role                TEXT NOT NULL DEFAULT 'agent'
                        CHECK (role IN ('agent', 'supervisor', 'admin')),

  -- Fase 2: account_id
  account_id          UUID,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: atendimento_automation_rules
-- Regras IF/THEN de roteamento automático
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_automation_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name                TEXT NOT NULL,
  description         TEXT,
  active              BOOLEAN NOT NULL DEFAULT true,

  -- Evento que dispara a regra
  event_name          TEXT NOT NULL CHECK (event_name IN (
                        'message_created',
                        'conversation_created',
                        'conversation_status_changed',
                        'conversation_assigned',
                        'conversation_unassigned'
                      )),

  -- Condições (JSONB array de {attribute, operator, value})
  conditions          JSONB NOT NULL DEFAULT '[]',

  -- Ações (JSONB array de {action_type, ...params})
  actions             JSONB NOT NULL DEFAULT '[]',

  -- Ordem de execução
  sort_order          INT DEFAULT 0,

  -- Fase 2: account_id
  account_id          UUID,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: regras padrão para a FIC
INSERT INTO public.atendimento_automation_rules (name, description, event_name, conditions, actions) VALUES
  (
    'Fora do Horário',
    'Envia mensagem automática fora do horário de atendimento',
    'message_created',
    '[{"attribute": "business_hours", "operator": "outside"}]',
    '[{"action_type": "send_message", "content": "Olá! Recebemos sua mensagem. Nosso atendimento funciona de segunda a sexta, das 8h às 18h. Responderemos em breve! 😊"}]'
  ),
  (
    'Auto-Label Financeiro',
    'Etiqueta conversas que mencionam boleto, mensalidade ou pagamento',
    'message_created',
    '[{"attribute": "content", "operator": "contains", "value": "boleto|mensalidade|pagamento|débito|pagar"}]',
    '[{"action_type": "add_label", "label": "Financeiro"}]'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: atendimento_whatsapp_templates
-- Templates HSM sincronizados da Meta API
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_whatsapp_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  inbox_id            UUID NOT NULL REFERENCES public.atendimento_inboxes(id) ON DELETE CASCADE,

  -- Dados do template (sincronizado da Meta API)
  name                TEXT NOT NULL,
  language            TEXT NOT NULL DEFAULT 'pt_BR',
  category            TEXT CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  status              TEXT CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),

  -- Estrutura do template (header, body, footer, buttons)
  components          JSONB NOT NULL DEFAULT '[]',

  -- ID do template na Meta
  meta_template_id    TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.atendimento_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER atendimento_inboxes_updated_at
  BEFORE UPDATE ON public.atendimento_inboxes
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

CREATE TRIGGER atendimento_contacts_updated_at
  BEFORE UPDATE ON public.atendimento_contacts
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

CREATE TRIGGER atendimento_conversations_updated_at
  BEFORE UPDATE ON public.atendimento_conversations
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

CREATE TRIGGER atendimento_agents_updated_at
  BEFORE UPDATE ON public.atendimento_agents
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

CREATE TRIGGER atendimento_automation_rules_updated_at
  BEFORE UPDATE ON public.atendimento_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

-- ============================================================
-- FUNÇÃO: atualiza last_activity_at e unread_count na conversa
-- disparada por nova mensagem incoming
-- ============================================================
CREATE OR REPLACE FUNCTION public.atendimento_update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.atendimento_conversations
  SET
    last_activity_at = NEW.created_at,
    unread_count = CASE
      WHEN NEW.message_type = 'incoming' THEN unread_count + 1
      ELSE unread_count
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER atendimento_messages_update_conv
  AFTER INSERT ON public.atendimento_messages
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_update_conversation_on_message();

-- ============================================================
-- RLS — Fase 1: Authenticado pode tudo (single-tenant FIC)
-- Fase 2: trocar por account_id isolation
-- ============================================================
ALTER TABLE public.atendimento_inboxes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_labels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Fase 1: qualquer usuário autenticado lê e escreve
-- (FIC é o único tenant por enquanto)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'atendimento_inboxes', 'atendimento_contacts', 'atendimento_conversations',
    'atendimento_messages', 'atendimento_labels', 'atendimento_conversation_labels',
    'atendimento_agents', 'atendimento_automation_rules', 'atendimento_whatsapp_templates'
  ]
  LOOP
    EXECUTE format('CREATE POLICY auth_only_select ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY auth_only_insert ON public.%I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY auth_only_update ON public.%I FOR UPDATE USING (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY auth_only_delete ON public.%I FOR DELETE USING (auth.uid() IS NOT NULL)', t);
  END LOOP;
END $$;

-- ============================================================
-- FIM DA MIGRATION
-- Próximo passo: Sprint 2 — webhook WhatsApp + Bull Queue
-- ============================================================
