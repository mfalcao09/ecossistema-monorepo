-- =============================================================================
-- Migration: atendimento_canais
-- Sprint: Canais de Atendimento (UI + gestão)
-- Separada de atendimento_inboxes (pipeline operacional).
-- Cada canal UI cria um inbox operacional ao conectar.
-- =============================================================================

-- Trigger genérica updated_at reutilizável para esta tabela
create or replace function public.trg_canal_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabela principal
-- -----------------------------------------------------------------------------
create table if not exists public.atendimento_canais (
  id                  uuid        primary key default gen_random_uuid(),

  -- Tipo e identidade visual
  tipo                text        not null
    check (tipo in (
      'whatsapp-cloud','whatsapp-qr','instagram','messenger',
      'email','telegram','webchat','sms','reclame-aqui'
    )),
  nome                text        not null,
  cor                 text        not null default '#16a34a',
  ambiente            text        not null default 'demo'
    check (ambiente in ('demo','producao')),

  -- Estado operacional
  status              text        not null default 'aguardando'
    check (status in ('ativo','desconectado','aguardando','demo')),
  receber_mensagens   boolean     not null default true,

  -- Identificador exibível (número de telefone, @handle, endereço e-mail…)
  -- Preenchido automaticamente após conexão bem-sucedida.
  identificador       text,

  -- provider_config: credenciais do canal (Fase 1 — texto simples)
  -- Fase 2: tokens migram para Vault; aqui ficará apenas vault_key.
  --
  -- whatsapp-cloud: { app_id, phone_number_id, waba_id, access_token, app_secret }
  -- whatsapp-qr:   { maturado: true }
  -- instagram/
  -- messenger:     { page_id, page_name, access_token }
  -- email:         { provedor, imap_host?, email, senha? }
  -- telegram:      { bot_token }
  provider_config     jsonb       not null default '{}',

  -- atendimento_config: defaults de atendimento coletados no Step 4 do wizard
  -- { departamento, saudacao, fora_expediente, sincronizar_contatos, criar_card_crm }
  atendimento_config  jsonb       not null default '{}',

  -- Referência ao inbox operacional criado após conexão bem-sucedida.
  -- NULL enquanto o canal ainda não foi conectado.
  inbox_id            uuid        references public.atendimento_inboxes(id)
                                  on delete set null,

  -- Auditoria
  conectado_at        timestamptz,
  ultima_atividade_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Trigger updated_at
create trigger trg_canal_updated_at
  before update on public.atendimento_canais
  for each row execute function public.trg_canal_set_updated_at();

-- Índices
create index if not exists idx_atendimento_canais_tipo
  on public.atendimento_canais (tipo);

create index if not exists idx_atendimento_canais_status
  on public.atendimento_canais (status);

create index if not exists idx_atendimento_canais_inbox
  on public.atendimento_canais (inbox_id)
  where inbox_id is not null;

-- -----------------------------------------------------------------------------
-- Comentários
-- -----------------------------------------------------------------------------
comment on table public.atendimento_canais is
  'Canais de atendimento gerenciados via UI. Cada canal conectado cria um inbox operacional em atendimento_inboxes.';

comment on column public.atendimento_canais.provider_config is
  'Credenciais do provedor. Fase 1: texto simples. Fase 2: migrar tokens para Vault (SC-29).';

comment on column public.atendimento_canais.inbox_id is
  'FK para atendimento_inboxes. Preenchido quando o canal é conectado com sucesso.';
