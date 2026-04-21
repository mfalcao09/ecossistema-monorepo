# BRIEFING-ATND-S9 — DS Voice: Biblioteca de Conteúdo + Funis + Bot de Voz

**Sessão:** ATND-S9 · **Branch:** `feature/atnd-s9-ds-voice`
**Duração estimada:** 1 dia (6–8h)
**Dependências:** S8a (automações + API pública ✅), S8b (chat interno ✅)
**Bloqueia:** nada crítico (melhoria de produtividade de atendimento)

---

## Leituras obrigatórias

1. `CLAUDE.md` + `MEMORY.md`
2. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — Parte 8 (DS Voice)
3. `apps/erp-educacional/src/app/atendimento/` — estrutura atual para entender padrões existentes
4. `apps/erp-educacional/supabase/migrations/` — última migration (S8a/S8b) para entender numeração

---

## Objetivo

Entregar o módulo **DS Voice** do Atendimento FIC: biblioteca de conteúdo versionado (mensagens, áudios, mídias, documentos), funis/sequências com delays e transcrição de áudios recebidos via IA.

---

## Escopo exato

```
apps/erp-educacional/
├── supabase/migrations/
│   └── 20260428_atendimento_s9_ds_voice.sql   # 8 tabelas
├── src/app/atendimento/
│   ├── biblioteca/
│   │   └── page.tsx             # 6 abas: Mensagens/Áudios/Mídias/Docs/Funis/Gatilhos
│   └── api/atendimento/
│       ├── biblioteca/route.ts  # CRUD mensagens e mídias
│       ├── funis/route.ts       # CRUD funis + steps + execuções
│       └── gatilhos/route.ts    # CRUD gatilhos por palavra-chave
└── src/lib/atendimento/
    ├── ds-voice/
    │   ├── parser.ts            # Parser de variáveis dinâmicas {{nome}}, {{curso}}
    │   ├── funnel-worker.ts     # Worker que drena fila de execuções
    │   └── transcriber.ts      # Transcrição de áudio via Gemini 2.5 Flash
    └── permissions.ts           # ADD: módulos ds_biblioteca, ds_funis, ds_gatilhos
```

---

## Migration SQL

```sql
-- 20260428_atendimento_s9_ds_voice.sql

-- Biblioteca de conteúdo
CREATE TABLE atendimento_ds_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mensagens','audios','midias','documentos')),
  parent_id UUID REFERENCES atendimento_ds_folders(id),
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atendimento_ds_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES atendimento_ds_folders(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL,          -- suporta {{variáveis}}
  category TEXT,                  -- boas_vindas, boleto_vencido, lembrete_prova, etc.
  version INT DEFAULT 1,
  is_active BOOL DEFAULT true,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atendimento_ds_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,     -- Supabase Storage
  duration_seconds INT,
  transcription TEXT,             -- preenchido pelo transcriber.ts
  transcribed_at TIMESTAMPTZ,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Funis e sequências
CREATE TABLE atendimento_ds_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,     -- tag_added, deal_stage_changed, manual
  trigger_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOL DEFAULT true,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atendimento_ds_funnel_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES atendimento_ds_funnels(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  delay_minutes INT DEFAULT 0,
  action_type TEXT NOT NULL,      -- send_message, send_audio, tag_contact, assign_agent
  action_config JSONB NOT NULL,   -- { message_id, variables: {} }
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atendimento_ds_funnel_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES atendimento_ds_funnels(id),
  contact_id UUID,
  conversation_id UUID,
  current_step INT DEFAULT 0,
  status TEXT DEFAULT 'running',  -- running, completed, cancelled, failed
  next_step_at TIMESTAMPTZ,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atendimento_ds_keyword_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  match_type TEXT DEFAULT 'contains',  -- exact, contains, starts_with
  action_type TEXT NOT NULL,           -- send_message, start_funnel, assign_tag
  action_config JSONB NOT NULL,
  is_active BOOL DEFAULT true,
  priority INT DEFAULT 0,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS permissiva (igual S6-S8)
ALTER TABLE atendimento_ds_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_ds_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_ds_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_ds_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_ds_funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_ds_funnel_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_ds_keyword_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON atendimento_ds_folders FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- (repetir para todas as tabelas)
```

---

## Funnel Worker

```typescript
// src/lib/atendimento/ds-voice/funnel-worker.ts
// Chamado pelo cron: POST /api/cron/ds-voice-worker (a cada 1 min, igual S8a)

export async function processNextSteps(supabase: SupabaseClient) {
  // SELECT execuções com status='running' AND next_step_at <= now()
  // Para cada: buscar step atual, executar ação, avançar para próximo step
  // Se último step: marcar como 'completed'
}
```

---

## Transcriber

```typescript
// src/lib/atendimento/ds-voice/transcriber.ts
// Usa Google Gemini 2.5 Flash (GEMINI_API_KEY já no vault ECOSYSTEM)

export async function transcribeAudio(audioUrl: string): Promise<string> {
  // Baixa áudio de Supabase Storage → envia para Gemini API
  // Retorna transcrição em texto
  // Atualiza atendimento_ds_audios SET transcription = ...
}
```

---

## UI — `/atendimento/biblioteca`

```
Tabs: [Mensagens] [Áudios] [Mídias] [Documentos] [Funis] [Gatilhos]

Mensagens:
- Lista com busca por nome/categoria
- Botão "Nova mensagem" → modal com editor + parser de variáveis
- Preview com substituição {{variável}} → valor de exemplo

Funis:
- Lista de funis com status (ativo/inativo) + contagem de execuções em andamento
- Botão "+ Novo funil" → stepper: (1) Gatilho, (2) Passos, (3) Ativar
- Cada passo: tipo de ação + delay + conteúdo

Gatilhos por palavra-chave:
- Tabela: keyword | tipo | ação | prioridade | ativo
- Toggle para ativar/desativar
```

---

## Feature flags

```bash
# Vercel env vars a adicionar:
ATENDIMENTO_DS_VOICE_ENABLED=true
NEXT_PUBLIC_ATENDIMENTO_DS_VOICE_ENABLED=true
```

---

## Novas pendências a registrar em PENDENCIAS.md

- **P-115**: Aplicar migration `20260428_atendimento_s9_ds_voice.sql` em branch Supabase `atnd-s9` e depois prod
- **P-116**: Rodar seed de permissões após P-115 para adicionar módulos `ds_biblioteca/ds_funis/ds_gatilhos` nos 3 presets
- **P-117**: Ativar `ATENDIMENTO_DS_VOICE_ENABLED=true` em Vercel preview → prod
- **P-118**: Configurar cron 1min para `/api/cron/ds-voice-worker` (com `CRON_SECRET`)
- **P-119**: Testar transcrição real de áudio com `GEMINI_API_KEY` do ECOSYSTEM

---

## Critério de sucesso

- [ ] Migration com 8 tabelas criada
- [ ] CRUD API para mensagens, funis, passos, gatilhos
- [ ] UI `/atendimento/biblioteca` com 6 abas funcionando
- [ ] `processNextSteps` drena execuções de funil corretamente
- [ ] `transcribeAudio` chama Gemini e salva transcrição
- [ ] Parser de variáveis `{{nome}}` funciona no preview
- [ ] Feature flags gating toda a UI
- [ ] CI verde
- [ ] Pendências P-115→P-119 registradas em PENDENCIAS.md
- [ ] Commit: `feat(atendimento): S9 DS Voice — biblioteca + funis + gatilhos + transcrição [ATND-S9]`
