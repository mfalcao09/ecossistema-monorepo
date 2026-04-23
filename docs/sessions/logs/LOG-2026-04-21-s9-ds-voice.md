# LOG 2026-04-21 — Atendimento S9 DS Voice

> Sessão paralela · worktree `../eco-atnd-s9` · branch `feature/atnd-s9-ds-voice`
> PR #59 · 8 commits · merged em `36aa635` em 2026-04-21 23:23 UTC
> Deploy Vercel prod: `dpl_7tYYDYzjuomwSurpcrxEZT9JYxLN` READY

## Objetivo

Replicar o módulo **DS Voice** do Nexvy dentro do ERP FIC: biblioteca de mensagens + áudios + mídias + documentos com variáveis, construtor de funis drip com gatilhos (keyword/tag/new_conv), transcrição de áudios recebidos via Gemini. Feature por trás de flag.

## Commits da sessão

| # | SHA | Descrição |
|---|---|---|
| 1 | `6d8bc62` | migration 9 tabelas `ds_voice_*` + RLS + realtime publication |
| 2 | `0e3af08` | parser `variables.ts` isomórfico + 22 testes unit (vitest) |
| 3 | `47fc2e4` | APIs CRUD (20 rotas) + worker cron + webhook hook + IA transcription |
| 4 | `46f7418` | UI biblioteca (6 abas) + funis editor + gatilhos + menu sidebar + cron vercel.json |
| 5 | `3010748` | PENDENCIAS.md P-116..P-129 |
| 6 | `c44de30` | fecha P-116..P-120 (pendências críticas aplicadas em prod) |
| 7 | `c1732eb` | correção `apps/erp-educacional/CLAUDE.md` + contextos (ERP = `ifdnjieklngcfodmtied`) |
| 8 | `b4c7ea6` | fix CodeQL SSRF: allowlist Meta CDN hosts em `ia-transcription.ts` |

Após rebase em main + force-push (`3a26e64`), squash merge em `36aa635`.

## Arquitetura

### Schema (migration `20260428_atendimento_s9_ds_voice.sql`)

9 tabelas no projeto Supabase `ifdnjieklngcfodmtied`:

- `ds_voice_folders` — pastas hierárquicas por kind (messages/audios/media/documents)
- `ds_voice_messages` — templates de texto com JSONB `variables[]`
- `ds_voice_audios` — com `storage_path` no bucket `atendimento` + `send_as_voice_note`
- `ds_voice_media` — imagens/vídeos com `caption` (suporta variáveis)
- `ds_voice_documents` — PDF/XLSX/DOCX/ZIP (aviso IG incompatível)
- `ds_voice_funnels` — funis/sequências drip com denorm `total_duration_seconds`
- `ds_voice_funnel_steps` — steps ordenados com `delay_seconds` (trigger recalc totals)
- `ds_voice_triggers` — gatilhos keyword/tag_added/conversation_created + `match_mode`
- `ds_voice_funnel_executions` — instâncias vivas; **unique partial index** `(funnel_id, conversation_id) WHERE status='running'` evita duplicação

RLS `auth.uid() IS NOT NULL` em todas. Publicação `supabase_realtime` em 6 (messages, audios, media, documents, folders, funnel_executions).

### Libs server-side

- `variables.ts` (isomórfico): `resolveVariables()`, `extractVariables()`, `VARIABLE_CATALOG`. Usa `Intl.DateTimeFormat` para timezone `America/Sao_Paulo`.
- `ds-voice-sender.ts` (server-only): `sendDsVoiceStep()` monta payload Meta conforme `item_type`; `runDsVoiceTriggers()` avalia e enfileira; `triggerMatches()` pura.
- `ds-voice-schemas.ts` (isomórfico): Zod schemas + `UPLOAD_LIMITS` + `STORAGE_BUCKET`.
- `ia-transcription.ts`: Gemini 2.5 Flash via inline_data base64; persiste em `atendimento_messages.metadata.transcription`. Com allowlist SSRF.
- `feature-flags.ts`: `isDsVoiceEnabled()` lê server+client.

### API routes (20)

`/api/atendimento/ds-voice/{folders,messages,audios,media,documents,funnels,triggers}` (GET/POST + `[id]` PATCH/DELETE) — todas via `withPermission("ds_voice", ...)`. Extras: `/upload` (multipart → Supabase Storage), `/funnels/[id]/simulate`, `/export`, `/import` (com `?preview=1`).

### Cron worker

`/api/cron/process-funnel-steps` — `* * * * *` em `vercel.json`. Auth via `x-cron-secret` ou `Authorization: Bearer`. Aceita `?backfill=N` (default 50, max 500). Backoff exponencial `5min × attempts`. Logging estruturado `[ds-voice/cron]`.

### Integração webhook Meta

Hook cirúrgico após `runAutomations` (S8a preservado):

```ts
if (isDsVoiceEnabled()) {
  runDsVoiceTriggers({...}).catch(err => ...)
}
if (msg.type === 'audio') {
  void (async () => {
    if (await isIaTranscriptionEnabled()) {
      await transcribeAudio({...})
    }
  })()
}
```

### UI

`/atendimento/ds-voice/page.tsx` client com 6 abas + botões Exportar/Importar topbar. Componentes por aba em `src/components/atendimento/ds-voice/`:

- `shared.tsx` — `dsVoiceApi` client, `FolderSidebar`, `VariablePicker`, `AudioWaveform` (canvas + AudioContext nativo, zero deps)
- `messages-tab.tsx` — editor com inserção de variáveis no cursor + preview live
- `audios-tab.tsx` — upload Storage + waveform + toggle voice-note
- `media-tab.tsx` — grid responsivo img/video + caption com variáveis
- `documents-tab.tsx` — lista com aviso IG + MIME info
- `funnels-tab.tsx` — editor vertical com reorder (setas) + simulação contra API
- `triggers-tab.tsx` — CRUD + match_mode + canais whatsapp/instagram

## Pendências críticas (P-116..P-120) — todas resolvidas em prod

| ID | Resolução |
|---|---|
| P-116 | Migration S9 + pré-reqs S4/S5/S6/S7/S8a/S8b aplicadas via Supabase MCP `apply_migration` no ERP `ifdnjieklngcfodmtied`. Validação: 9 `ds_voice_tables`, 6 realtime publication, RLS ativo. |
| P-117 | Seed `role_permissions` aplicado via `execute_sql` (192 linhas). `ds_voice` grants: Admin all, Atendente view+create+edit, Restrito view only. |
| P-118 | `ATENDIMENTO_DS_VOICE_ENABLED=true` + `NEXT_PUBLIC_*` nos 3 envs (dev/preview/prod) do projeto `prj_VIEmyVHGD61ow5uf5pmBJp5W7eAX`. Preview via Vercel REST API (CLI 51.6.1 interativa prompt). |
| P-119 | Bucket Storage `atendimento` criado (public, 100MB, 25 mime types) + 4 policies em `storage.objects`: `service_role` ALL; `authenticated` INSERT/UPDATE/DELETE em `ds-voice/*`; `anon+auth` SELECT público. |
| P-120 | Resolvido reusando `ADMIN_SECRET` existente (10d ago) — worker cron aceita `CRON_SECRET ?? ADMIN_SECRET`. |

## Descoberta canônica

**ERP Supabase é `ifdnjieklngcfodmtied` (sa-east-1)**, não `bvryaopfjiyxjgsuhjsb`. `bvryaopfjiyxjgsuhjsb` é Intentus (us-west-2). `MEMORY.md` raiz já estava correto, mas `apps/erp-educacional/CLAUDE.md` tinha a nota errada. Corrigido com nova seção "IDs Supabase canônicos" listando 4 projetos da org.

## CodeQL SSRF fix

CodeQL PR #59 flagou SSRF crítico em `ia-transcription.ts:40` — `fetch(${GRAPH_BASE}/${mediaId})`. Apesar do HMAC-SHA256 do webhook Meta proteger upstream, adicionamos defesa em profundidade:

- `isValidMediaId()`: `/^[0-9]{1,40}$/` — Meta IDs são numéricos
- `isTrustedMetaMediaUrl()`: allowlist `fbcdn.net|facebook.com|whatsapp.net|cdninstagram.com` + HTTPS
- `encodeURIComponent(mediaId)` no path
- Mesmo check aplicado em `transcribeAudio` path `audio_url`

## Validação final DB

```json
{
  "ds_voice_tables": 9,
  "folders_seed": 4,
  "preset_roles": 3,
  "permissions_total": 192,
  "ds_voice_granted": 8,
  "ia_transcription_row": 1,
  "storage_bucket": 1,
  "realtime_tables": 6
}
```

## CI / merge

Todos os 11 checks verdes no commit final:
- `lint-and-test`, `lint-python`, `Secrets scan (gitleaks)`
- `Dependency audit (Node.js)`, `Dependency audit (Python)`
- `CodeQL analysis (typescript)`, `CodeQL analysis (python)`, `CodeQL` aggregate
- `Vercel – diploma-digital`, `Vercel – intentus-plataform`, `Vercel Preview Comments`

Branch protection exigiu rebase up-to-date (`mergeStateStatus: BEHIND` → rebase 9 commits sobre main → force-push-with-lease → CI re-rodou verde → merge squash).

## Pós-merge — pendências abertas (P-121..P-129)

- **P-121** `GEMINI_API_KEY` na Vercel + toggle `ia_transcription` enabled em `/atendimento/integracoes`
- **P-122** UI chat (S10) renderizar `metadata.transcription` abaixo do bubble de áudio
- **P-123** E2E: funil 3-steps + trigger keyword → webhook HMAC fake → assert exec + cron drain
- **P-124** Drag-drop real entre pastas (endpoint já aceita `folder_id` em PATCH)
- **P-125** UI Realtime presence "X agentes editando" no editor de funis
- **P-126** RLS Storage por path prefix (hoje só por bucket)
- **P-127** Worker cron `Promise.allSettled` quando volume > 50 pending/min
- **P-128** Documentar contrato JSON export/import em `DS-VOICE-EXPORT-FORMAT.md`
- **P-129** Integração ChatPanel S10 (toolbar picker biblioteca)

## Links

- PR: https://github.com/mfalcao09/ecossistema-monorepo/pull/59
- Deploy prod: `https://vercel.com/mrcelooo-6898s-projects/diploma-digital/7tYYDYzjuomwSurpcrxEZT9JYxLN`
- Branch alias: `diploma-digital-git-main-mrcelooo-6898s-projects.vercel.app`

---

*Log consolidado no encerramento da sessão. Dual-write: memória em `ecosystem_memory` (Supabase ECOSYSTEM `gqckbunsfjgerbuiyzvn`) e `MEMORY.md` (neste commit).*
