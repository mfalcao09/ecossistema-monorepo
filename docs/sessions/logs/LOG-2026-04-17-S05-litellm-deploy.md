# LOG 2026-04-17 — S05 LiteLLM deploy Railway

**Worktree:** `busy-mendel` (branch `claude/busy-mendel`)
**Duração:** ~2h (com retomadas)
**Status:** ✅ concluído
**PR:** [mfalcao09/ecossistema-monorepo#1](https://github.com/mfalcao09/ecossistema-monorepo/pull/1)

---

## Entregas

1. Scaffold completo em `infra/railway/litellm/` — 21 arquivos (commit `60e313c`)
2. Deploy ao vivo no Railway — projeto `ecossistema-litellm` com 3 services (commit `d933784`)
3. `internalOnly` ativado — domínio público deletado, acesso só via `litellm.railway.internal`
4. Testes E2E: 4/4 passed (budget, cost tracking, fallback, rate limit)

## URL & credenciais

- **Endpoint privado:** `http://litellm.railway.internal:4000`
- **Master key:** `/tmp/.litellm_master_key` (perms 600) — 64 hex chars + prefixo `sk-litellm-master-`
- **Virtual keys (6):** `/tmp/.virtual_keys/*.txt` (perms 600)
  - `ecosystem-master.txt` — US$ 1000/mês, todos os modelos
  - `fic-prod.txt` — US$ 200/mês
  - `klesis-prod.txt` — US$ 300/mês
  - `intentus-prod.txt` — US$ 500/mês
  - `splendori-prod.txt` — US$ 300/mês
  - `nexvy-prod.txt` — US$ 400/mês

## Decisões importantes

### 1. OpenRouter como provider único (Opção B)
Migramos os 4 providers diretos (Anthropic, OpenAI, Gemini, MariTalk) para **OpenRouter dentro do `model_list` do LiteLLM**. Não substitui LiteLLM — substitui as 4 chaves diretas por 1.

**Motivo:** saldo zerado Anthropic, quota excedida OpenAI, chave Gemini marcada como vazada pelo Google (revogada).

**Preserva:** LiteLLM como gateway canônico (V9 § 33), virtual keys, budgets per-negócio, cooldown, cache Redis, Langfuse callback.

**Trade-off aceitável:** markup ~5-10% vs direto no piloto; renegocia Fase 1.

**MariTalk:** não existe no OpenRouter. Ficou stubado (`MARITACA_API_KEY=stub-not-configured`). Quando FIC real precisar PT-BR nativo, adicionar direto em paralelo ao OpenRouter no `model_list`.

### 2. Postgres Railway temporário
DATABASE_URL aponta para Postgres Railway (`postgres.railway.internal`), não Supabase ECOSYSTEM. Motivo: S04 ainda não criou o schema `litellm_proxy` no ECOSYSTEM. Migração futura: depois da S04, trocar `DATABASE_URL` e rodar `scripts/init_db.sh`.

### 3. Nomenclatura V9 ajustada
Nomes corrigidos para modelos reais do OpenRouter:
- `haiku-3-7` → `haiku-4-5` (haiku-3-7 não existe no OR; V9 deveria ter sido 4-5 desde o início)
- `opus-4-7` → `opus-4-6` (typo/inconsistência no briefing; V9 canônico é 4.6)
- Adicionados: `gemini-2-5-flash`, `llama-3-3-70b`, `deepseek-chat`

## Fixes descobertos durante deploy

| Bug | Sintoma | Fix |
|---|---|---|
| `enable_jwt_auth: true` | /v1/models retornava 401 "JWT Auth is enterprise only" | `enable_jwt_auth: false` — master key + virtual keys cobrem tudo |
| healthcheckPath `/health/readiness` + 30s | Primeiro deploy FAILED: boot precisa rodar Prisma migrations (~60s) antes do readiness responder | `/health/liveliness` + 300s |
| Dockerfile HEALTHCHECK sem start-period | Similar ao acima | Adicionado `--start-period=90s` |
| RAILWAY_TOKEN vs RAILWAY_API_TOKEN | CLI rejeitava Account Token setado em `RAILWAY_TOKEN` | Renomeado para `RAILWAY_API_TOKEN` (CLI separa account vs project tokens por env var) |

## Dores operacionais (lições)

1. **Clipboard do Railway "Copy Token" adiciona `\n` no fim** — causou 3 tentativas de paste até criar o helper `set_provider_key.sh` com `pbpaste | tr -d '[:space:]'` + validação de prefixo.
2. **LiteLLM não expõe virtual key depois de criada** — só no `/key/generate`. Script `create_virtual_keys.py` agora salva em `/tmp/.virtual_keys/<alias>.txt` no momento da criação.
3. **Account Token scoped a workspace diferente de Account Token sem workspace** — primeiro token criado tinha `Workspace: mfalcao09's Projects`; só funcionava no GraphQL, não no CLI. Resolveu recriar com `Workspace: No workspace`.
4. **`zsh -c` não carrega `~/.zshrc`** — shells não-interativos só carregam `.zshenv`. Solução: em cada subshell, `. ~/.zshenv.local` explicitamente.

## Achados de segurança flagueados

1. `MINIMAX_API_KEY` em plaintext em `~/.zshrc` — movido para `~/.zshenv.local` (chmod 600) ✅
2. Chave Gemini vazada pelo Google — revogada pelo Marcelo ✅
3. `RAILWAY_TOKEN` anterior vazou para o contexto do Claude durante debug — revogado ✅

## Riscos remanescentes

- **Trial Railway terminando em ~3 dias** no momento do deploy — Marcelo fez upgrade para Hobby Plan ($5/mês + uso). Creditar como decisão consciente.
- **Postgres Railway é temporário.** Se o trial expirar antes da migração para Supabase ECOSYSTEM, perde DB do LiteLLM (virtual keys precisam ser regeneradas).
- **Anthropic/OpenAI com saldo zero** — chaves ainda válidas mas não usadas. Se quiser reativar como providers diretos, basta adicionar créditos e trocar o `model_list`.

## Próximas sessões destravadas

- **S09 — Langfuse** ✅ desbloqueada (preenche stubs `LANGFUSE_*` no service litellm)
- **S10 — Orchestrator** ✅ desbloqueada (consome via `litellm.railway.internal`)
- **S13 — Clients** ✅ desbloqueada (`@ecossistema/litellm-client` wrappeia este endpoint)
- **S16 — Piloto CFO-FIC** ✅ desbloqueada (usa `fic-prod` virtual key)

Recomendação: **abrir S09 em worktree paralelo** — mesmo projeto Railway, destrava observability fim-a-fim.
