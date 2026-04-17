# S15 — Testes + CI/CD

**Sessão:** S15 · **Dia:** 3 · **Worktree:** `eco-tests-d3` · **Branch:** `feature/ci-tests`
**Duração estimada:** 1 dia (6-8h)
**Dependências:** todos os packages (S1, S2, S3, S7, S11, S13, S14) minimamente prontos
**Bloqueia:** S17 (Validação E2E depende de suíte de testes funcionando)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **§ 44** (paralelismo de sessões), **§ 41-42** (roadmap)
2. `docs/runbooks/03-deploy-nova-edge-function.md` + `04-aplicar-migration-ecosystem.md` (S6)
3. `docs/sessions/fase0/*.md` — critérios de sucesso de cada sessão
4. GitHub Actions docs: workflows para monorepo pnpm
5. Supabase CLI docs: `supabase functions deploy`
6. Railway CLI docs: `railway up`, `railway deploy`

---

## Objetivo

Construir **infraestrutura de testes + CI/CD completa**:
- Workflow CI em PR (lint + test + build + coverage)
- Workflow deploy seletivo ao merge em main (EFs, packages, Railway services)
- Testes E2E multi-package (Marcelo → Orchestrator → CFO-FIC → SC-29 → LiteLLM → Langfuse)
- Coverage gates (≥70% em packages P0)
- Security scanning (secrets, dependencies)

---

## Escopo exato

```
.github/
├── workflows/
│   ├── ci.yml                           # PR checks
│   ├── deploy-edge-functions.yml        # merge → deploy EFs
│   ├── deploy-railway.yml               # merge → deploy Railway services
│   ├── deploy-packages.yml              # merge → publish NPM (internal registry)
│   ├── security-scan.yml                # daily: secrets + deps
│   └── e2e.yml                          # scheduled: suite E2E completa
├── dependabot.yml
└── CODEOWNERS

tests/e2e/                               # suíte E2E cross-package
├── package.json
├── playwright.config.ts
├── fixtures/
│   ├── seed-data.ts
│   └── mock-responses.ts
├── scenarios/
│   ├── 01-hooks-enforce-art-ii.spec.ts      # Art. II bloqueia > R$10k
│   ├── 02-sc29-mode-b-proxy.spec.ts         # credential nunca exposta
│   ├── 03-memory-roundtrip.spec.ts          # add → recall → hit
│   ├── 04-orchestrator-sse-stream.spec.ts   # stream SSE funcional
│   ├── 05-cfo-fic-regua-cobranca.spec.ts    # E2E piloto
│   └── 06-consolidator-extract-facts.spec.ts
└── utils/
    ├── test-client.ts
    └── assertions.ts

.husky/                                  # git hooks locais
├── pre-commit                          # lint + typecheck
└── pre-push                            # test affected packages

infra/ci/
├── scripts/
│   ├── detect-changes.sh               # quais packages mudaram?
│   ├── affected-tests.sh               # roda só tests afetados
│   └── release-notes.sh                # auto-gera release notes
└── README.md
```

---

## Decisões-chave

1. **pnpm + turbo** — CI usa turbo cache para re-runs rápidos
2. **Coverage mínimo 70% P0, 50% P1** — bloqueia merge se abaixo
3. **Deploys seletivos** — só services afetados pelo PR
4. **Secrets scan** — gitleaks rodando em pre-commit + CI
5. **E2E roda noturno** (não em todo PR — caro demais)
6. **Branch protection main** — obrigatório CI green + 1 review

---

## Spec — `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ['5432:5432']
        options: --health-cmd="pg_isready" --health-interval=10s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build

  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: |
          cd apps/orchestrator
          pip install -e . pytest pytest-asyncio pytest-cov
          pytest --cov=src --cov-fail-under=70
      - run: |
          cd apps/memory-consolidator
          pip install -e . pytest pytest-asyncio pytest-cov
          pytest --cov=src --cov-fail-under=70

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Spec — `.github/workflows/deploy-edge-functions.yml`

```yaml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - 'infra/supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      
      - name: Detect changed functions
        id: changes
        run: |
          CHANGED=$(git diff --name-only HEAD^ HEAD | grep '^infra/supabase/functions/' | awk -F'/' '{print $4}' | sort -u | tr '\n' ' ')
          echo "functions=$CHANGED" >> $GITHUB_OUTPUT
      
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      
      - name: Deploy changed functions
        if: steps.changes.outputs.functions != ''
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: |
          for fn in ${{ steps.changes.outputs.functions }}; do
            echo "Deploying $fn..."
            supabase functions deploy "$fn" --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} --no-verify-jwt
          done
      
      - name: Smoke test
        if: steps.changes.outputs.functions != ''
        run: |
          for fn in ${{ steps.changes.outputs.functions }}; do
            curl -f "${{ secrets.SUPABASE_URL }}/functions/v1/$fn/health" || exit 1
          done
```

---

## Spec — `.github/workflows/deploy-railway.yml`

```yaml
name: Deploy Railway Services

on:
  push:
    branches: [main]
    paths:
      - 'apps/orchestrator/**'
      - 'apps/memory-consolidator/**'
      - 'infra/railway/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      
      - name: Detect services
        id: detect
        run: |
          CHANGED=$(git diff --name-only HEAD^ HEAD)
          SERVICES=""
          [[ "$CHANGED" == *"apps/orchestrator/"* ]] && SERVICES="$SERVICES orchestrator"
          [[ "$CHANGED" == *"apps/memory-consolidator/"* ]] && SERVICES="$SERVICES memory-consolidator"
          [[ "$CHANGED" == *"infra/railway/litellm/"* ]] && SERVICES="$SERVICES litellm"
          [[ "$CHANGED" == *"infra/railway/langfuse/"* ]] && SERVICES="$SERVICES langfuse"
          echo "services=$SERVICES" >> $GITHUB_OUTPUT
      
      - name: Install Railway CLI
        run: npm i -g @railway/cli
      
      - name: Deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          for svc in ${{ steps.detect.outputs.services }}; do
            railway environment production
            railway up --service "$svc" --detach
          done
      
      - name: Health check
        run: |
          sleep 30
          for svc in ${{ steps.detect.outputs.services }}; do
            url=$(railway domain --service "$svc")
            curl -f "https://$url/health" || exit 1
          done
```

---

## Spec — testes E2E (`tests/e2e/scenarios/`)

### `01-hooks-enforce-art-ii.spec.ts`
```typescript
import { test, expect } from '@playwright/test';
import { TestClient } from '../utils/test-client';

test('Art. II blocks tool with valor > R$10k', async () => {
  const client = new TestClient();
  const response = await client.runAgent('cfo-fic', {
    query: 'Emita boleto de R$ 15000 para aluno 123',
  });
  
  expect(response.events).toContainEqual(
    expect.objectContaining({
      type: 'tool_blocked',
      reason: expect.stringContaining('Art. II'),
    })
  );
  expect(response.events).toContainEqual(
    expect.objectContaining({
      type: 'approval_request_created',
    })
  );
});
```

### `02-sc29-mode-b-proxy.spec.ts`
```typescript
test('SC-29 Mode B never exposes secret to agent', async () => {
  const client = new TestClient();
  // Mock Banco Inter endpoint
  const interMock = await setupMockInter();
  
  const response = await client.runAgent('cfo-fic', {
    query: 'Consulte saldo da conta Inter',
  });
  
  // Verifica agent recebeu result (saldo) mas não credencial
  expect(response.result).toHaveProperty('saldo');
  expect(JSON.stringify(response)).not.toMatch(/INTER_CLIENT_SECRET/);
  expect(JSON.stringify(response)).not.toMatch(/sk-/);  // nenhum secret format
  
  // Verifica audit log registrou proxy call
  const audit = await getAuditLog({ agent_id: 'cfo-fic', action: 'proxy' });
  expect(audit[0].mode).toBe('B');
});
```

### `03-memory-roundtrip.spec.ts`
```typescript
test('Memory add → recall hit', async () => {
  const memory = new MemoryClient(testConfig);
  
  await memory.add({
    content: 'Marcelo prefere Sonnet 4.6 para análises financeiras',
    filters: { user_id: 'marcelo', agent_id: 'cfo-fic', business_id: 'fic' },
    type: 'semantic',
  });
  
  // Wait auto-embedding trigger
  await sleep(5000);
  
  const hits = await memory.recall({
    query: 'Que modelo usar para análise financeira?',
    filters: { user_id: 'marcelo', agent_id: 'cfo-fic', business_id: 'fic' },
    limit: 5,
  });
  
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0].content).toContain('Sonnet');
});
```

### `05-cfo-fic-regua-cobranca.spec.ts`
```typescript
test('CFO-FIC executes régua de cobrança E2E', async () => {
  const client = new TestClient();
  
  // Seed: 3 inadimplentes fake na DB
  await seedInadimplentes(3);
  
  const response = await client.runAgent('cfo-fic', {
    query: 'Dispare régua de cobrança para inadimplentes de 15+ dias',
  });
  
  // Verifica trace completo
  expect(response.tools_used).toContain('check_inadimplentes');
  expect(response.tools_used).toContain('send_whatsapp');  // sandbox mode
  expect(response.status).toBe('success');
  
  // Verifica Langfuse trace
  const trace = await langfuse.getTrace(response.trace_id);
  expect(trace.generations.length).toBeGreaterThan(0);
  
  // Verifica memória salvou padrão
  await sleep(2000);
  const procedural = await memory.procedural.search({ business_id: 'fic', name: 'regua*' });
  expect(procedural.length).toBeGreaterThan(0);
});
```

---

## pre-commit hook (`.husky/pre-commit`)

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 1. gitleaks (secrets)
gitleaks protect --staged --verbose --config .gitleaks.toml

# 2. lint staged files
pnpm lint-staged

# 3. typecheck packages afetados
pnpm turbo typecheck --filter="...[HEAD^1]"
```

`.gitleaks.toml`:
```toml
[allowlist]
paths = [
  '''\.md$''',          # markdown docs podem ter exemplos
  '''templates/'''      # templates com placeholders
]

[[rules]]
id = "anthropic-key"
description = "Anthropic API key"
regex = '''sk-ant-[a-zA-Z0-9_-]{30,}'''

[[rules]]
id = "openai-key"
description = "OpenAI API key"
regex = '''sk-[a-zA-Z0-9]{32,}'''

[[rules]]
id = "supabase-service-role"
description = "Supabase service role key"
regex = '''eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+'''
```

---

## Coverage gates (`turbo.json`)

```json
{
  "pipeline": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["NODE_ENV"]
    },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": { },
    "build": { "outputs": ["dist/**"] }
  }
}
```

Cada package `package.json`:
```json
{
  "scripts": {
    "test": "vitest run --coverage --coverage.thresholds.lines=70 --coverage.thresholds.functions=70"
  }
}
```

---

## Dependabot (`.github/dependabot.yml`)

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 10
    groups:
      dev-deps:
        patterns: ["@types/*", "vitest", "eslint*", "typescript"]
      anthropic:
        patterns: ["@anthropic-ai/*"]
  - package-ecosystem: pip
    directory: /apps/orchestrator
    schedule: { interval: weekly }
  - package-ecosystem: pip
    directory: /apps/memory-consolidator
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

---

## CODEOWNERS

```
* @mfalcao09

# Segurança e governança
/packages/@ecossistema/constitutional-hooks/ @mfalcao09
/packages/@ecossistema/credentials/          @mfalcao09
/infra/supabase/migrations/                  @mfalcao09
/docs/masterplans/                           @mfalcao09
/docs/adr/                                   @mfalcao09

# C-Suite templates — requer review
/packages/@ecossistema/c-suite-templates/    @mfalcao09
```

---

## Critério de sucesso

- [ ] CI workflow roda em PRs: lint + test + build + typecheck + secrets-scan — verde
- [ ] Deploy EF workflow: mudança em `infra/supabase/functions/credential-gateway-v2/` deploya só essa EF
- [ ] Deploy Railway workflow: mudança em `apps/orchestrator/` deploya só orchestrator
- [ ] 6+ scenarios E2E rodando (ao menos 4 verdes)
- [ ] Coverage report publicado (Codecov)
- [ ] Secrets scan bloqueia PR com chave exposta (teste manual)
- [ ] Branch protection ativa em `main`
- [ ] Husky pre-commit funciona local
- [ ] README `infra/ci/README.md` documentando fluxo completo
- [ ] Commit: `feat(ci): workflows CI + deploy + E2E + security scanning`

---

## Handoff

- **S17 (Validação E2E)** roda suite completa desta sessão
- Futuras sessões seguem patterns: todo PR novo passa por CI, deploys automáticos

---

**Boa sessão. CI bom liberta — CI ruim escraviza. Capriche.**
