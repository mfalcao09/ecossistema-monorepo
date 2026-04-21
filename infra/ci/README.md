# CI/CD — Infraestrutura de Testes e Deploy

Fluxo completo de integração contínua e deploy seletivo para o Ecossistema Monorepo V9.

---

## Visão geral

```
PR aberto
    │
    ├── ci.yml ──────────────────────────────────────────────────── PR checks
    │   ├── lint + typecheck (turbo)
    │   ├── unit tests + coverage (vitest, ≥70% P0)
    │   ├── build (turbo)
    │   ├── python tests (pytest, ≥70%)
    │   └── secrets scan (gitleaks)
    │
    └── APROVADO → merge em main
            │
            ├── deploy-edge-functions.yml ── mudou infra/supabase/functions/**
            ├── deploy-railway.yml ─────────── mudou apps/orchestrator/** etc.
            ├── deploy-packages.yml ────────── mudou packages/**
            └── security-scan.yml ──────────── diário 02:00 UTC
                e2e.yml ────────────────────── noturno 03:00 UTC
```

---

## Workflows

| Arquivo | Trigger | O que faz |
|---|---|---|
| `ci.yml` | PR + push main | Lint, type, test, build, secrets |
| `deploy-edge-functions.yml` | push main (path filter) | Deploy seletivo das EFs alteradas |
| `deploy-railway.yml` | push main (path filter) | Deploy seletivo dos services Railway |
| `deploy-packages.yml` | push main (path filter) | Publica packages no GitHub Packages |
| `security-scan.yml` | diário + PR | gitleaks + npm audit + CodeQL |
| `e2e.yml` | noturno + manual | Suite E2E cross-package (Playwright) |

---

## Secrets necessários (GitHub → Settings → Secrets)

| Secret | Usado em | Descrição |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | deploy-edge-functions | Token pessoal Supabase CLI |
| `SUPABASE_PROJECT_REF` | deploy-edge-functions | `gqckbunsfjgerbuiyzvn` |
| `SUPABASE_URL` | e2e, security | URL pública do projeto |
| `SUPABASE_ANON_KEY` | e2e, deploy-EF | Chave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | e2e | Chave service role (E2E apenas) |
| `RAILWAY_TOKEN` | deploy-railway | Token Railway CLI |
| `ORCHESTRATOR_URL` | e2e | URL do orchestrator em produção |
| `ANTHROPIC_API_KEY` | e2e | Para agentes rodando nos testes E2E |
| `LANGFUSE_PUBLIC_KEY` | e2e | Observabilidade |
| `LANGFUSE_SECRET_KEY` | e2e | Observabilidade |
| `LANGFUSE_HOST` | e2e | URL Langfuse |
| `CODECOV_TOKEN` | ci | Upload de coverage |

---

## Scripts utilitários

```bash
# Detectar o que mudou (JSON)
./infra/ci/scripts/detect-changes.sh HEAD^1

# Rodar apenas testes dos packages afetados
./infra/ci/scripts/affected-tests.sh HEAD^1

# Gerar release notes desde última tag
./infra/ci/scripts/release-notes.sh v0.1.0
```

---

## Suíte E2E (`tests/e2e/`)

| Cenário | Artigo/SC | O que valida |
|---|---|---|
| `01-hooks-enforce-art-ii` | Art. II | HITL bloqueia > R$10k |
| `02-sc29-mode-b-proxy` | SC-29 | Secret nunca exposto ao agente |
| `03-memory-roundtrip` | Art. V | add → embedding → recall |
| `04-orchestrator-sse-stream` | D1 | SSE stream funcional |
| `05-cfo-fic-regua-cobranca` | Art. IV | Trace E2E completo |
| `06-consolidator-extract-facts` | Art. XXII | SessionEnd dispara reflexão |

```bash
# Rodar suite localmente (requer .env.e2e)
cd tests/e2e
cp .env.example .env.e2e
source .env.e2e
npx playwright test

# Rodar cenário específico
npx playwright test scenarios/01-hooks-enforce-art-ii.spec.ts
```

---

## Pre-commit hooks (Husky)

Instalação local:
```bash
pnpm install        # instala dependências
pnpm prepare        # instala hooks via husky
```

O que roda em cada commit:
1. **gitleaks** — bloqueia se detectar credencial no staged
2. **lint-staged** — ESLint + Prettier nos arquivos staged
3. **turbo typecheck** — typecheck dos packages afetados

O que roda em cada push:
1. **turbo test** — testes dos packages afetados (feature branch) ou todos (main)

---

## Coverage gates

- **P0 packages** (`constitutional-hooks`, `memory`, `credentials`): ≥ **70%** lines + functions
- **P1 packages** (demais): ≥ **50%** lines + functions
- **Python** (`orchestrator`, `memory-consolidator`): ≥ **70%**

Coverage é publicado no Codecov e visível em cada PR.

---

## Branch protection (main)

Configurar em GitHub → Settings → Branches → Add rule:
- ✅ Require status checks: `lint`, `test`, `build`, `secrets-scan`
- ✅ Require at least 1 review
- ✅ Dismiss stale reviews
- ✅ Require branches to be up to date before merging
- ✅ Restrict pushes to matching branches (bloqueia force push)
