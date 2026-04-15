# Ecossistema de Inovação e IA — Monorepo

> **CEO:** Marcelo Silva · **Versão:** V4 (2026-04-15) · **Status:** Fase 0 em andamento

Monorepo canônico do Ecossistema. Substitui os 3 repos separados (Ecossistema, ERP-Educacional, intentus-plataform) em uma estrutura única com packages reutilizáveis + apps de produto.

## Estrutura

```
ecossistema-monorepo/
├── packages/          → serviços reutilizáveis entre negócios (@ecossistema/*)
├── apps/              → produtos (erp-educacional, intentus, orchestrator, jarvis-app)
├── infra/             → Supabase migrations, Railway IaC, Trigger.dev jobs
├── docs/              → ADRs, masterplans, análises, briefings de sessão
└── CLAUDE.md          → instruções para agentes IA (Claudinho + Squad)
```

## Princípio arquitetural

> **Se serve mais de um negócio → ECOSYSTEM (package). Se é dado de domínio → DB do projeto.**

Exemplo: emissão de boleto. Motor de emissão vive em `@ecossistema/billing` (ECOSYSTEM). Registros de boleto de aluno ficam no Supabase do ERP-FIC.

## Começando

```bash
# Instalar pnpm (se ainda não tem)
brew install pnpm

# Instalar todas as dependências
pnpm install

# Build de todos os packages
pnpm build

# Rodar orchestrator localmente
cd apps/orchestrator && uvicorn src.main:app --reload
```

## Docs essenciais

- `docs/masterplans/PLANO-EXECUCAO-V4.md` — plano canônico 12 semanas
- `docs/adr/001-parallelism.md` — protocolo de sessões paralelas
- `docs/sessions/BRIEFING-*.md` — briefings de cada sessão paralela
- `CLAUDE.md` — instruções de agente por sessão

## Trabalho em paralelo (4 sessões Code)

Cada sessão Claude Code abre uma worktree distinta:

```bash
git worktree add ../eco-A feature/A-memory
git worktree add ../eco-B feature/B-task-registry
git worktree add ../eco-C feature/C-orchestrator
git worktree add ../eco-D feature/D-billing
```

Leia `docs/adr/001-parallelism.md` antes de começar.
