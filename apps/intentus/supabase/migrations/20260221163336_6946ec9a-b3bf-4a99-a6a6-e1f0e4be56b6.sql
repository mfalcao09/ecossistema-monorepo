
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.chat_channel_type AS ENUM ('whatsapp_oficial', 'whatsapp_nao_oficial', 'instagram', 'telegram', 'webchat');
CREATE TYPE public.chat_channel_status AS ENUM ('conectado', 'desconectado', 'deletado');
CREATE TYPE public.chat_conversation_status AS ENUM ('aberta', 'aguardando', 'resolvida', 'fechada');
CREATE TYPE public.chat_sender_type AS ENUM ('contato', 'agente', 'sistema', 'bot');
CREATE TYPE public.chat_message_type AS ENUM ('texto', 'imagem', 'audio', 'video', 'documento', 'localizacao');
CREATE TYPE public.chat_campaign_status AS ENUM ('rascunho', 'agendada', 'enviando', 'concluida', 'cancelada');
CREATE TYPE public.chat_campaign_recipient_status AS ENUM ('pendente', 'enviado', 'falhou');
CREATE TYPE public.chat_file_type AS ENUM ('mensagem', 'audio', 'imagem', 'documento', 'fluxo', 'webhook');
CREATE TYPE public.chat_integration_type AS ENUM ('agente_ia', 'webhook', 'api_externa', 'bot');

-- =============================================
-- TABELAS
-- =============================================

-- 1. chat_channels
CREATE TABLE public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  channel_type public.chat_channel_type NOT NULL,
  phone_number TEXT,
  status public.chat_channel_status NOT NULL DEFAULT 'desconectado',
  api_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_channels FOR ALL USING (tenant_id = public.auth_tenant_id());
CREATE TRIGGER update_chat_channels_updated_at BEFORE UPDATE ON public.chat_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. chat_contacts
CREATE TABLE public.chat_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_contacts FOR ALL USING (tenant_id = public.auth_tenant_id());
CREATE TRIGGER update_chat_contacts_updated_at BEFORE UPDATE ON public.chat_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. chat_tags
CREATE TABLE public.chat_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_tags FOR ALL USING (tenant_id = public.auth_tenant_id());

-- 4. chat_contact_tags (N:N)
CREATE TABLE public.chat_contact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.chat_contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.chat_tags(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  UNIQUE (contact_id, tag_id)
);
ALTER TABLE public.chat_contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_contact_tags FOR ALL USING (tenant_id = public.auth_tenant_id());

-- 5. chat_queues
CREATE TABLE public.chat_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_queues FOR ALL USING (tenant_id = public.auth_tenant_id());

-- 6. chat_queue_members
CREATE TABLE public.chat_queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.chat_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  UNIQUE (queue_id, user_id)
);
ALTER TABLE public.chat_queue_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_queue_members FOR ALL USING (tenant_id = public.auth_tenant_id());

-- 7. chat_conversations
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  channel_id UUID REFERENCES public.chat_channels(id),
  contact_id UUID NOT NULL REFERENCES public.chat_contacts(id),
  assigned_to UUID,
  queue_id UUID REFERENCES public.chat_queues(id),
  status public.chat_conversation_status NOT NULL DEFAULT 'aberta',
  unread_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_conversations FOR ALL USING (tenant_id = public.auth_tenant_id());
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. chat_messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_type public.chat_sender_type NOT NULL,
  sender_id UUID,
  content TEXT,
  message_type public.chat_message_type NOT NULL DEFAULT 'texto',
  media_url TEXT,
  metadata JSONB DEFAULT '{}',
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_messages FOR ALL USING (tenant_id = public.auth_tenant_id());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 9. chat_campaigns
CREATE TABLE public.chat_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  channel_id UUID REFERENCES public.chat_channels(id),
  message_template TEXT,
  status public.chat_campaign_status NOT NULL DEFAULT 'rascunho',
  scheduled_at TIMESTAMPTZ,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_campaigns FOR ALL USING (tenant_id = public.auth_tenant_id());

-- 10. chat_campaign_recipients
CREATE TABLE public.chat_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.chat_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.chat_contacts(id),
  status public.chat_campaign_recipient_status NOT NULL DEFAULT 'pendente',
  sent_at TIMESTAMPTZ,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id)
);
ALTER TABLE public.chat_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_campaign_recipients FOR ALL USING (tenant_id = public.auth_tenant_id());

-- 11. chat_files
CREATE TABLE public.chat_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  folder TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_type public.chat_file_type NOT NULL DEFAULT 'documento',
  file_size BIGINT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_files FOR ALL USING (tenant_id = public.auth_tenant_id());

-- 12. chat_integrations
CREATE TABLE public.chat_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  type public.chat_integration_type NOT NULL,
  config JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.chat_integrations FOR ALL USING (tenant_id = public.auth_tenant_id());

-- Indexes for performance
CREATE INDEX idx_chat_conversations_tenant_status ON public.chat_conversations(tenant_id, status);
CREATE INDEX idx_chat_conversations_contact ON public.chat_conversations(contact_id);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_contacts_tenant_phone ON public.chat_contacts(tenant_id, phone);
CREATE INDEX idx_chat_campaign_recipients_campaign ON public.chat_campaign_recipients(campaign_id);
