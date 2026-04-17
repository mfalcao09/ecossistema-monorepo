# LOG — Sessão S06 · ADRs + Runbooks

- **Data:** 2026-04-17
- **Worktree:** `.claude/worktrees/gallant-merkle` (branch `claude/gallant-merkle`)
- **Briefing:** `docs/sessions/fase0/S06-docs.md`
- **Dono:** Claudinho

## Entregue

### `docs/adr/`
- `README.md` — índice canônico + processo + convenções
- `template.md` — MADR format
- **15 ADRs arquiteturais canônicos (001–015):**
  - 001 Managed Agents como runtime primário
  - 002 Monorepo com pnpm workspaces
  - 003 Supabase ECOSYSTEM + DBs per-projeto
  - 004 LiteLLM como gateway único
  - 005 Langfuse self-host para observability
  - 006 FastMCP v3 como framework MCP
  - 007 Mem0 v3 + pgvector 3-tier
  - 008 SC-29 como Edge Function determinística
  - 009 22 Artigos como hooks executáveis
  - 010 C-Suite per negócio + 6 Diretores de Área
  - 011 Jarvis 4-stage — pipecat + LiveKit
  - 012 Stack BR canônica
  - 013 Phantom 9-layer prompt assembler
  - 014 Mem0 v3 ADD-only
  - 015 Cardinal Rule
- **016 — Protocolo de sessões paralelas** (ex-ADR-001, renumerado e reformatado no template MADR, conteúdo canônico preservado)

### `docs/runbooks/`
- `README.md` — índice + convenções
- **6 runbooks operacionais:**
  - 01 Rotação de credenciais (SC-29)
  - 02 Adicionar novo negócio ao ecossistema
  - 03 Deploy de nova Edge Function
  - 04 Aplicar migration em ECOSYSTEM
  - 05 Resposta a incidente (D-Infra + SC-27)
  - 06 Rollback de prompt version (Managed Agents)

### Decisões tomadas durante a sessão

1. **ADR-001 pré-existente (paralelismo) renumerado para ADR-016.** Motivo: o briefing S06 definia numeração canônica 001–015 para o pacote V9 arquitetural. Conteúdo preservado; atualizada apenas a formatação para seguir o template MADR canônico.
2. **CLAUDE.md atualizado** para apontar ao novo path `docs/adr/016-protocolo-sessoes-paralelas.md`.
3. **MEMORY.md atualizado** com tabela dos 16 ADRs + lista dos 6 runbooks + status S06 na Fase 0.
4. **Runbook `MIGRACAO-VERCEL.md` pré-existente mantido** em `docs/runbooks/` como runbook legado, referenciado no novo README.
5. **Branch usada:** `claude/gallant-merkle` (worktree criado pelo sistema). Briefing menciona `feature/docs-d1`; PR deve abrir dessa branch.

## Cross-references validadas

- ADR-001 (Managed Agents) ↔ V9 § Parte I §6 D1, ADR-002, ADR-009
- ADR-003 (Supabase) ↔ V9 § Parte XI §39, ADR-007, ADR-008
- ADR-004 (LiteLLM) ↔ V9 §33, ADR-005
- ADR-008 (SC-29 EF) ↔ V9 § Parte VII, Art. II, Art. IV, Runbook 01
- ADR-009 (Artigos→hooks) ↔ V9 §11, S01 entregue em #3
- ADR-010 (C-Suite per negócio) ↔ V9 §14–§18
- ADR-013 + ADR-014 ↔ V9 §24, §27
- Runbook 01 cross-linka ADR-008 + Art. II + Art. IV
- Runbook 04 cross-linka ADR-016 Regra 5 + V9 §44
- Runbook 06 cross-linka ADR-001 + V9 §28

## Critério de sucesso (do briefing)

- [x] 15 ADRs em `docs/adr/` com template consistente
- [x] 6 Runbooks em `docs/runbooks/` testáveis passo-a-passo
- [x] `docs/adr/README.md` com índice + estado (aceito)
- [x] `docs/runbooks/README.md` com índice + quando usar cada
- [x] Cross-references V9 / ADRs / Runbooks corretos
- [ ] Commit: `feat(docs): 15 ADRs canônicos + 6 runbooks operacionais` (próximo passo)
- [ ] PR com descrição listando cada ADR e runbook (próximo passo)

## Handoff

Docs são consumidas por todas as outras sessões — agora disponíveis em `docs/` no monorepo.
Marcelo consulta ADRs quando alguém questionar decisão. Runbooks guiam operações rotineiras.

Próximas sessões podem cross-linkar estes ADRs em seus briefings e PRs (ex: S04 migrations
referencia ADR-003 + ADR-007 + Runbook 04).
