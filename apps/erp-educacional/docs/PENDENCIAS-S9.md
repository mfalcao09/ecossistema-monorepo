# Pendências S9 · DS Voice

> Local de trabalho — referenciar do PR e copiar IDs para `docs/sessions/PENDENCIAS.md`.
> Numeração canônica em PENDENCIAS.md (último era P-115 → S9 começa em **P-116**).

## Pré-merge

| ID    | Categoria | Severidade | Ação                                                                                                                                                                                                                                               |
| ----- | --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-116 | deploy    | high       | Aplicar migration `infra/supabase/migrations/20260428_atendimento_s9_ds_voice.sql` em branch Supabase do projeto `bvryaopfjiyxjgsuhjsb` (ERP / diploma-digital) → validar 9 tabelas `ds_voice_*` criadas + RLS + publication realtime → merge prod |
| P-117 | seed      | high       | Re-rodar `python apps/erp-educacional/scripts/seed_atendimento_permissions.py \| psql "$SUPABASE_DB_URL"` para popular `role_permissions` com grants ds_voice atualizados (Atendente padrão view+create+edit; Atendente restrito só view)          |
| P-118 | config    | high       | Setar flags Vercel: `ATENDIMENTO_DS_VOICE_ENABLED=true` (server) + `NEXT_PUBLIC_ATENDIMENTO_DS_VOICE_ENABLED=true` (client) — Preview primeiro → Production. Sem flag, sidebar não mostra item, webhook pula triggers e cron pula execução         |
| P-119 | config    | high       | Confirmar bucket `atendimento` no Supabase Storage com prefixo `ds-voice/` write permitido para service_role; criar policy de leitura pública (RLS Storage) ou migrar para signed URLs em S10                                                      |
| P-120 | config    | med        | Setar `CRON_SECRET` (ou reusar o do S5/S8a) — sem isso `/api/cron/process-funnel-steps` retorna 401                                                                                                                                                |

## Pós-merge / S10

| ID    | Categoria | Severidade | Ação                                                                                                                                                                                                                                              |
| ----- | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-121 | config    | med        | Habilitar app `ia_transcription` em `app_installations` (toggle UI `/atendimento/integracoes`) e setar `GEMINI_API_KEY` na Vercel — sem essas duas peças `transcribeAudio` retorna `no_gemini_api_key` ou `app_installation_disabled`             |
| P-122 | refactor  | med        | Adicionar coluna `transcription_text` a `atendimento_messages` ou usar metadata.transcription como autoritativo. Hoje gravamos em `metadata.transcription` (JSONB) — funcional, mas UI do chat (S10) precisa renderizar abaixo do bubble do áudio |
| P-123 | test      | med        | E2E: criar funil 3-steps + trigger keyword `matricula` → enviar webhook fake POST com HMAC válido contendo "Quero info de matricula" → assert exec criada + cron drena step 0 → atendimento_messages outgoing inserido                            |
| P-124 | refactor  | low        | Drag-drop real entre pastas (hoje folders rendem só raiz, sem nesting visual) e drag-drop pra mover itens entre pastas. Patch endpoint já aceita `folder_id` em PATCH                                                                             |
| P-125 | refactor  | low        | Adicionar índices Realtime presenece para "X agentes editando" no editor de funis (hoje publicação está habilitada, falta UI consumir)                                                                                                            |
| P-126 | security  | low        | RLS de Storage `atendimento` por path prefix `ds-voice/` (hoje só RLS por bucket inteiro) — Fase 2 multi-tenant                                                                                                                                   |
| P-127 | refactor  | low        | Worker cron usa loop seq — paralelizar com `Promise.allSettled` quando volume crescer (>50 execuções pendentes/min)                                                                                                                               |
| P-128 | doc       | low        | Documentar contrato JSON do export/import em `apps/erp-educacional/docs/DS-VOICE-EXPORT-FORMAT.md` para uso por outras instâncias do ERP                                                                                                          |
| P-129 | refactor  | low        | Integração no ChatPanel (placeholder do S10) — toolbar com botão "DS Voice" abrindo picker da biblioteca, inserir item no compose. Briefing original deixou explícito "fazer no S10"                                                              |

## Resolvidas pela própria S9

_(nenhuma — se houver, mover para "Resolvidas" no PENDENCIAS.md principal)_
