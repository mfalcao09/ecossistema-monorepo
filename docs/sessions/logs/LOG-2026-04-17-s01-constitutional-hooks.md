# LOG-2026-04-17 — S01: Constitutional Hooks

**Sessão:** S01 · **Worktree:** `distracted-cerf` · **Branch:** `claude/distracted-cerf`
**Dia:** 2026-04-17 · **PR:** [#3](https://github.com/mfalcao09/ecossistema-monorepo/pull/3)

## Entrega

Pacote `@ecossistema/constitutional-hooks` em [`packages/constitutional-hooks/`](../../../packages/constitutional-hooks/) — **espinha dorsal constitucional da V9** (MASTERPLAN-V9 §§ 11-13). 11 Artigos Constitucionais virados em código executável que intercepta ações do agente via `PreToolUse` / `PostToolUse` / `SessionEnd` do Claude Agent SDK.

### Hooks implementados

| Artigo | Tipo | Função |
|---|---|---|
| II — HITL Crítico | `pre` | Bloqueia irreversíveis + financeiras > R$ 10k, cria `approval_request` |
| III — Idempotência | `pre` | Rejeita duplicatas em 24h via `idempotency_cache` |
| IV — Rastreabilidade | `post` | `audit_log` append-only com hashes SHA-256 (LGPD-safe) |
| VIII — Baixa Real | `post` | Detecta `accepted` sem receipt, mock em prod, timeout mascarado |
| IX — Falha Explícita | `post` | `throw ToolFailedError` em HTTP 5xx / `success:false` silenciosos |
| XII — Custos | `pre` | Budget LiteLLM fail-closed |
| XIV — Dual-Write | `pre` | Bloqueia `Write`/`Edit` em `/memory/*.md`, `/secrets/`, `/tasks/`, `/sessions/` |
| XVIII — Data Contracts | `pre` | Validação ajv contra JSON Schema registrado |
| XIX — Segurança | `pre` | Blocklist regex Bash (`rm -rf /`, `git push --force main`, …) |
| XX — Soberania Local | `pre` | Hint (não bloqueia) — prefere Supabase a API externa |
| XXII — Aprendizado | `end` | Extrai telemetria → `memory.add()` (stub até S7) |

### Qualidade

- **70 testes passando** (11 arquivos por-hook + 1 integração multi-hook)
- **Coverage:** 93.01% stmts / 90.77% branches / 97.43% funcs — acima do threshold 85%
- **Build + lint:** `tsc` strict passa sem warnings
- Commit: [`262eb7e`](https://github.com/mfalcao09/ecossistema-monorepo/commit/262eb7e)

## Divergências vs briefing (documentadas)

1. **Regex `dd` endurecido.** De `/dd\s+of=\/dev\//` para `/\bdd\b[^;|&\n]*\bof=\/dev\//`. A forma literal do briefing não capturava `dd if=X of=/dev/Y` (padrão mais comum de ataque). Comentário em `src/utils.ts` explica.
2. **Estrutura flat de packages.** Briefing sugeria `packages/@ecossistema/constitutional-hooks/` — mas `pnpm-workspace.yaml` mapeia `packages/*`, então a forma canônica é `packages/constitutional-hooks/` com `name: "@ecossistema/constitutional-hooks"` no package.json.
3. **Art. XII fail-closed.** Se consulta ao LiteLLM falha, bloqueia (custo > inconveniência). Art. IV fail-soft — audit log não pode bloquear agente.

## Handoff (bloqueios para ativar em produção)

1. **S04 (migrations)** precisa criar no Supabase ECOSYSTEM:
   - `approval_requests` (Art. II)
   - `audit_log` (Art. IV, append-only — trigger contra UPDATE/DELETE)
   - `idempotency_cache` (Art. III, com `created_at` indexado)
2. **S07 (memory)** destrava Art. XXII — hoje é stub `console.log` com `TODO(S7)`.
3. **S11 (C-Suite), S13 (Clients), S16 (Piloto CFO-FIC)** importam este pacote — destravados.
4. **Antes de qualquer agente em produção:** `LITELLM_PROXY_URL` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` configuradas.

## Notas de ambiente

- `pnpm` não está instalado globalmente na máquina do Marcelo. Caminho confirmado: `npx --yes pnpm@9.0.0 <cmd>` (alternativa: `corepack enable` pede sudo).
- Node v24.14.0.
- Worktree em `.claude/worktrees/distracted-cerf/`.

## Referências

- Briefing: [`docs/sessions/fase0/S01-hooks.md`](../fase0/S01-hooks.md)
- Spec: `docs/masterplans/MASTERPLAN-V9.md` §§ 11-13
- CLAUDE.md (raiz) — decisões D1-D6
