# BRIEFING — Atendimento S9 · DS Voice (biblioteca de conteúdo)

> **Worktree:** `../eco-atnd-s9` · **Branch:** `feature/atnd-s9-ds-voice`
> **Duração:** 5-6 dias · **Dependências:** nenhuma (totalmente independente)
> **Prioridade:** P1

---

## Missão

Replicar o módulo **DS Voice** do Nexvy dentro do ERP: biblioteca de textos + áudios + mídias + documentos com variáveis, construtor de **funis/sequências** com delay (drip marketing) e **gatilhos** por palavra-chave. Atendente FIC para de digitar do zero — seleciona item da biblioteca e manda. Funis dispararam cadências automáticas ("matrícula enviada" → 2h depois pergunta dúvida → 1 dia depois lembra de pagamento).

## Por que importa

Hoje os 4 atendentes FIC re-escrevem mesmas mensagens 50× por semana (info curso, preço, agenda visita). DS Voice transforma em biblioteca versionada + variáveis. **Impacto imediato:** economia de 2h/atendente/dia + padronização da comunicação. **Impacto médio prazo:** funis automáticos qualificam leads antes do humano tocar.

## Leituras obrigatórias

1. `CLAUDE.md` · Plano mestre Parte 4 Sprint S9 + seção J (DS Voice completo — 11 features)
2. `docs/research/nexvy-whitelabel/CDOdwqe_-KE/` — Uso prático da Sequência (78 frames — um dos mais longos)
3. `docs/research/nexvy-whitelabel/yH5ysNLTAXE/` — Transcrição de Áudio com IA (app habilitável, 16 frames)
4. `docs/research/nexvy-whitelabel/SHTF1dwAtuc/` — Etiquetar via chatbot (24 frames, contexto de gatilho)
5. ADR-016 (paralelismo)

## Escopo preciso

### Pode mexer
- `apps/erp-educacional/src/app/(erp)/atendimento/ds-voice/**`
- `apps/erp-educacional/src/components/atendimento/ds-voice/**`
- `apps/erp-educacional/src/app/api/atendimento/ds-voice/**`
- `apps/erp-educacional/src/app/api/cron/process-funnel-steps/route.ts` (cron 1min)
- `apps/erp-educacional/src/lib/atendimento/variables.ts` — parser de variáveis reutilizável
- `infra/supabase/migrations/20260428_atendimento_s9_ds_voice.sql`

### NÃO mexer
- `tailwind.config.ts`, nenhuma outra rota
- `ChatPanel.tsx` recebe APENAS 1 import + 1 ícone de toolbar (placeholder do S9 — implementar depois, não aqui)

## Entregas obrigatórias

### A. Migration SQL (8 tabelas)
- [ ] `ds_voice_folders (id, account_id, name, parent_id FK NULL, sort_order, created_at)` — pastas hierárquicas
- [ ] `ds_voice_messages (id, folder_id FK, title, content TEXT, variables JSONB, is_default BOOL, enabled BOOL, created_by, created_at)`
- [ ] `ds_voice_audios (id, folder_id FK, title, file_url TEXT, file_size_bytes BIGINT, duration_seconds INT, send_as_voice_note BOOL, enabled BOOL, created_by, created_at)`
- [ ] `ds_voice_media (id, folder_id FK, title, file_url TEXT, file_size_bytes BIGINT, mime_type, caption TEXT, enabled BOOL, created_by, created_at)`
- [ ] `ds_voice_documents (id, folder_id FK, title, file_url TEXT, file_size_bytes BIGINT, mime_type, filename, enabled BOOL, created_by, created_at)`
- [ ] `ds_voice_funnels (id, account_id, name, description, total_duration_seconds INT, enabled BOOL, created_by, created_at)`
- [ ] `ds_voice_funnel_steps (id, funnel_id FK, sort_order, item_type VARCHAR, -- message|audio|media|document, item_id UUID, delay_seconds INT, created_at)`
- [ ] `ds_voice_triggers (id, account_id, name, trigger_type VARCHAR, -- keyword|tag_added|conversation_created, trigger_value TEXT, funnel_id FK, channels VARCHAR[], enabled BOOL, created_by, created_at)`
- [ ] `ds_voice_funnel_executions (id, funnel_id FK, contact_id FK, conversation_id FK, current_step_order INT, next_step_at TIMESTAMPTZ, status VARCHAR, -- running|paused|done|failed, started_at, completed_at)`
- [ ] Índices: `ds_voice_funnel_executions(status, next_step_at)`, `ds_voice_triggers(trigger_type, enabled)`

### B. Biblioteca `/atendimento/ds-voice`
- [ ] Topbar com 5 abas: Mensagens · Áudios · Mídias · Documentos · Funis · Gatilhos
- [ ] Sidebar com árvore de pastas + drag-drop pra mover item
- [ ] **Mensagens:** CRUD + editor textarea com highlight de variáveis `{Nome}` `{Primeiro Nome}` `{Saudação}` `{Hora}` · preview renderizado
- [ ] **Áudios:** upload ≤16MB (.mp3/.ogg/.m4a) + waveform preview + toggle "enviar como gravação" (push-to-talk)
- [ ] **Mídias:** upload imagem ≤5MB / vídeo ≤100MB + caption
- [ ] **Documentos:** upload ≤100MB + aviso "incompatível com Instagram"
- [ ] Storage: Vercel Blob (público para CDN) OU Supabase Storage (privado signed URL) — decidir por segurança

### C. Construtor de Funis `/atendimento/ds-voice/funis`
- [ ] CRUD de funis
- [ ] Editor visual: lista vertical de steps com drag-drop ordering
- [ ] Cada step: selecionar tipo (msg/áudio/mídia/doc) + item da biblioteca + delay (minutos/horas/dias)
- [ ] Contador de duração total (soma delays)
- [ ] Preview "simulação": mock chat que mostra mensagens em sequência com timing

### D. Gatilhos `/atendimento/ds-voice/gatilhos`
- [ ] CRUD: nome · tipo gatilho (keyword/tag/new_conv) · valor · funil destino · canais WABA/IG toggle
- [ ] Integração no webhook processor: msg recebida → avaliar keywords → enqueue `ds_voice_funnel_executions`

### E. Worker `process-funnel-steps` (cron 1min)
- [ ] Lê `ds_voice_funnel_executions WHERE status='running' AND next_step_at <= now()`
- [ ] Pega step atual, envia mensagem via `/api/atendimento/templates/[id]/send` OU rota genérica de envio
- [ ] Incrementa `current_step_order` + calcula `next_step_at = now() + delay do próximo step`
- [ ] Se chegou no fim: `status='done'`

### F. Integração no chat (preparação S10)
- [ ] Não implementar agora — deixar placeholder de ícone DS Voice na toolbar do ChatPanel (feito como 1 comentário TODO)

### G. App Transcrição de Áudio IA
- [ ] Reaproveitar schema `app_installations` (se S8a mergeado) OU criar tabela separada simples
- [ ] Toggle habilitar/desabilitar
- [ ] Quando habilitado: áudios recebidos em conversa são transcritos via Gemini 2.5 Flash (ou Whisper API se mais barato)
- [ ] Transcrição renderizada abaixo do bubble de áudio no chat

### H. Export/Import biblioteca
- [ ] Botão "Exportar biblioteca" → download .json com todos folders/messages/audios/media/docs/funnels/triggers
- [ ] Botão "Importar" → upload .json → preview + confirmação → insert

### I. Testes
- [ ] Unit: parser `resolveVariables("{Primeiro Nome} {Saudação}!", context)` → "Marcelo Bom dia!"
- [ ] Unit: worker seleciona executions prontas corretamente
- [ ] E2E: criar funil 3-steps + trigger keyword → enviar msg com keyword → worker dispara steps em sequência

### J. PR
- [ ] `feat(atendimento): S9 DS Voice — biblioteca + funis + gatilhos + transcrição IA`
- [ ] Feature flag `ATENDIMENTO_DS_VOICE_ENABLED=true`

## Regras de paralelismo

1. Worktree `../eco-atnd-s9`, branch `feature/atnd-s9-ds-voice`
2. Migração independente
3. Zero arquivos compartilhados
4. Paralelo com S7/S8a/S8b
5. Memory: `project_atnd_s9.md`

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-atnd-s9 feature/atnd-s9-ds-voice
cd ../eco-atnd-s9
pnpm install
claude --permission-mode bypassPermissions

# 1. Migration 8 tabelas + índices
# 2. Biblioteca de Mensagens primeiro (mais simples) + parser de variáveis
# 3. Áudios depois (requer storage + waveform)
# 4. Funis + worker cron
# 5. Gatilhos + integração webhook
```

---

*Briefing S089 · leva 2 paralela · Plano-mestre v1*
