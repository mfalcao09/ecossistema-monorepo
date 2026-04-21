# Análise — SynkraAI/aiox-core como benchmark para `apps/orchestrator`

> **Data:** 2026-04-20
> **Autor:** Claudinho (Opus 4.7)
> **Escopo:** extrair 3 padrões aplicáveis ao `apps/orchestrator` (FastAPI Railway, Managed Agents V4). Recomendação prévia: `ESTUDAR`, não forkar. Ver [ADR-019](../adr/019-squad-pattern-chief-masters-specialists.md) para outra camada desse mesmo repo (squads).
> **Relacionado:** Fase 1 em curso (F1-S01 em PR #25), ADR-010 (C-Suite per negócio), ADR-009 (22 Artigos como hooks).

---

## 0. Verdade de mercado (ceticismo ativado)

README do aiox-core vende "AIOS: AI-Orchestrated System for Full Stack Development v4.0". **Realidade do código:** é um fork/rebranding do **BMAD-Method** (Breakthrough Method for Agile AI-Driven Development) com extensões. Stack:

- **Node.js puro**, não Python, não LangGraph, não framework de agente formal
- "Agentes" = arquivos Markdown com YAML frontmatter, carregados como prompts em IDEs externos (Claude Code, Cursor, Gemini CLI)
- "Execução autônoma" = loop JS local que orquestra arquivos `.md` e chamadas de tool — **não** é runtime de agente gerenciado

**Implicação direta para V4:** grande parte do valor do aiox-core já é coberto de forma superior pela escolha do Marcelo por **Anthropic Managed Agents** (ADR-001). Copiar o modelo aiox em bloco seria regressão arquitetural. Vale o *garimpo cirúrgico* abaixo.

---

## 1. Estado atual do `apps/orchestrator`

| Camada | Arquivos-chave | Cobertura |
|---|---|---|
| Agentes | [agents/registry.py](../../apps/orchestrator/src/orchestrator/agents/registry.py), [agents/factory.py](../../apps/orchestrator/src/orchestrator/agents/factory.py), [agents/runtime.py](../../apps/orchestrator/src/orchestrator/agents/runtime.py) | Define/instancia/executa Managed Agents |
| Rotas | [routes/sessions.py](../../apps/orchestrator/src/orchestrator/routes/sessions.py), [routes/agents.py](../../apps/orchestrator/src/orchestrator/routes/agents.py), [routes/webhooks.py](../../apps/orchestrator/src/orchestrator/routes/webhooks.py) | FastAPI + SSE streaming |
| Hooks | [hooks/loader.py](../../apps/orchestrator/src/orchestrator/hooks/loader.py), [hooks_bridge.mjs](../../apps/orchestrator/hooks_bridge.mjs) | 22 artigos como hooks constitucionais |
| Prompt | [prompt/assembler.py](../../apps/orchestrator/src/orchestrator/prompt/assembler.py) | Phantom 9-Layer Assembler (ADR-013) |
| Clients | `clients/litellm.py`, `clients/langfuse.py`, `clients/memory.py`, `clients/credentials.py` | Stack V4 canônico |
| Segurança | `security/auth.py`, `security/wrapping.py` | Auth + HITL básico |
| Testes | `test_hitl.py`, `test_sse.py`, `test_resume.py`, `test_agents.py` | Cobre resume de **sessão Managed Agent** (via `api_id`), **não** resume de mission multi-step |

**Lacunas identificadas para Fase 1+:**

1. Sem `Mission` / `Run` state persistente que atravesse múltiplas invocações de agente + gates HITL
2. HITL é binário (autoriza/bloqueia) — sem "fix-first recommendations" antes de acordar o humano
3. Sem state machine explícita de missão (status canônico), só sessões Managed Agent isoladas

---

## 2. Padrões extraídos do aiox-core

### 2.1 ADE (Autonomous Development Engine)

**O que é no aiox:** `.aiox-core/core/execution/autonomous-build-loop.js` (classe `AutonomousBuildLoop extends EventEmitter`) — loop imperativo sobre `plan.phases[].subtasks[]` com retry por subtask.

Config real (linhas 60-78):
```js
maxIterations: 10,              // tentativas por subtask
globalTimeout: 30 * 60 * 1000,  // 30 min por story
subtaskTimeout: 5 * 60 * 1000,
selfCritiqueEnabled: true,
useWorktree: false
```

**Persistência:** `BuildStateManager` (`.aiox-core/core/execution/build-state-manager.js`) grava:
- `plan/build-state.json` (estado atual)
- `plan/checkpoints/cp-{ts}-{rand}.json` (1 por subtask)

Schema do state: `{storyId, status, checkpoints[], completedSubtasks[], failedAttempts[], metrics, worktree, plan}`. Status ∈ `pending | in_progress | paused | abandoned | failed | completed`.

**Resume:** lê JSON → `getLastCheckpoint()` → `_calculateNextSubtask()` → pula subtasks em `completedSubtasks: Set`.

**Limites:** **sem token budget**, só `maxIterations` + `globalTimeout` (wall-clock). Anti-padrão para Managed Agents (cada retry custa API call real).

**Goal-complete:** binário — `completedSubtasks >= totalSubtasks`. Sem avaliação semântica.

### 2.2 Story-driven workflow

**O que é:** arquivos Markdown em `docs/stories/{epic}.{n}.story.md` com frontmatter YAML. "Schema" imposto por template + **checklist de 10 checks** executado por `@po` (Product Owner agent).

**State machine** (`.aiox-core/development/workflows/story-development-cycle.yaml`):
```
Draft → Ready → InProgress → InReview → Done
```

Workflow canônico de 4 fases sequenciais:
```yaml
sequence:
  - step: create_story    (agent: sm)
  - step: validate_story  (agent: po,  on_failure: create)
  - step: implement_story (agent: dev)
  - step: qa_review       (agent: qa)
```

**DoD:** 10 checks obrigatórios (título, AC Given/When/Then, IN/OUT, deps, complexidade, valor de negócio, riscos, alinhamento PRD, etc.). Testes passando + CodeRabbit sem CRITICAL fecham a story.

### 2.3 HITL planning — **padrão mais valioso**

**Implementação:** `.aiox-core/core/quality-gates/human-review-orchestrator.js` + `layer3-human-review.js` + `notification-manager.js`.

**Arquitetura de 3 camadas** (crucial):

| Layer | Natureza | Ação em falha |
|---|---|---|
| L1 | Determinístico (lint, test, typecheck) | **Bloqueia**, gera `fixFirst[]` ex: "Run `npm run lint:fix`" |
| L2 | Review automatizado (CodeRabbit, QA agent `Quinn`) | **Bloqueia** se CRITICAL, gera recomendações |
| L3 | Humano | Só roda se L1+L2 passam. Cria `reviewRequest` com focusAreas, automatedSummary, estimatedTime |

**Formato da review:** arquivos em `.aiox/human-review-requests/{id}.json` + `NotificationManager` com templates nomeados (`reviewRequest, blocked, approved, changesRequested, reminder`) e `channels: ['console', 'file']`.

**Comportamento durante espera:** o agente **não suspende em memória** — estado em disco (`build-state.json` com `status: paused`). IDE/CLI termina. Humano responde via outro comando (`*build-resume {storyId}`).

**Timeout:** `abandonedThreshold: 60*60*1000` (1h) — marca `abandoned: true` sem intervenção.

---

## 3. Mapeamento V4 — adotar, adaptar, rejeitar

### 3.1 ADE → **adaptar com enxerto seletivo**

| Elemento | Decisão | Racional |
|---|---|---|
| Schema `build-state.json` | **Adotar** | ~200 LOC, schema limpo (status + checkpoints + completedSubtasks + failedAttempts + metrics). Encaixa como Pydantic |
| Retry loop `maxIterations=10` | **Rejeitar** | Cada iteration contra Anthropic custa dinheiro. Managed Agents já fazem refinement interno |
| `useWorktree` + `StuckDetector` | **Rejeitar** | BMAD-specific, não aplica |
| Checkpoint granular por subtask | **Adaptar** | Adotar, mas persistir em **Supabase ECOSYSTEM**, não filesystem (Railway é efêmero) |
| Token budget | **Adicionar** (aiox não tem) | Art. XII — Custo Controlado |

**Onde mexer:** novo módulo `apps/orchestrator/src/orchestrator/runs/` — `state_manager.py`, `checkpoint_store.py`. Migração Supabase: tabelas `orchestrator_runs` + `orchestrator_checkpoints`.

**Esforço:** **M** (~600-900 LOC + migração + 2-3 dias).

### 3.2 Story-driven workflow → **rejeitar em grande parte**

BMAD é otimizado para **dev humano em IDE conduzindo agentes**. O orchestrator do Marcelo expõe agentes via SSE/WhatsApp para missões de negócio (CFO-FIC fechando mês, Klésis marcando reunião). Stories como `.md` + PO com 10-check é cerimônia desnecessária.

| Elemento | Decisão | Racional |
|---|---|---|
| Stories em `.md` + PO agent | **Rejeitar** | Cerimônia agile em ambiente errado |
| Workflow 4 agentes (sm/po/dev/qa) | **Rejeitar** | Redundante com Claudinho VP + C-Suite |
| State machine `Draft → Done` | **Adotar** (adaptar nome → "Mission") | BAM-compatível, dá observabilidade |
| AC Given/When/Then | **Adaptar** | JSON no body, não Markdown |
| 10-check DoD | **Reduzir** para 5 checks leves | Missões curtas não sobrevivem a 10 checks |

**Onde mexer:** `apps/orchestrator/src/orchestrator/missions/` — schema Pydantic + `POST /missions` com validação leve.

**Esforço:** **S** (~200-300 LOC + tabela + 1 dia).

### 3.3 HITL planning → **adotar a arquitetura de 3 layers** (joia do repo)

| Elemento | Decisão | Racional |
|---|---|---|
| Layer 1 determinístico com `fixFirst[]` | **Adotar** | Economiza mensagens WA no Marcelo |
| Layer 2 review automatizado | **Adotar** | Usar C-Suite relevante como reviewer (ex: CLO antes de enviar contrato) |
| Layer 3 humano persistente (JSON) | **Adotar** | Compatível com HITL async WhatsApp |
| `reviewRequest` com focusAreas, automatedSummary, estimatedTime | **Adotar** | Formato rico, reduz ambiguidade |
| Templates `reviewRequest/blocked/approved/...` | **Adotar** | Já modelável como `brand-voice` em PT-BR |
| `NotificationManager` file+console | **Substituir** | Canais V4: Baileys (WhatsApp gateway existente) + Jarvis-app push iOS |
| `abandonedThreshold: 1h` rígido | **Rejeitar** | Configurável por tipo de decisão (irreversível vs rotineira). Marcelo pode responder em 24h |

**Onde mexer:** refatorar `apps/orchestrator/src/orchestrator/security/wrapping.py` + criar `apps/orchestrator/src/orchestrator/hitl/` com camadas separadas. Canal WhatsApp consome `apps/whatsapp-gateway` (já pronto via ADR-017).

**Esforço:** **M** (~400 LOC + integração Baileys, 2 dias).

---

## 4. Top 3 recomendações (virar pendências)

### REC-1 — RunStateManager com checkpoints em Supabase (`M`)

- **Criar:** `apps/orchestrator/src/orchestrator/runs/state_manager.py`, `apps/orchestrator/src/orchestrator/runs/checkpoint_store.py`
- **Migração:** `infra/supabase/migrations/YYYY-orchestrator_runs.sql` — tabelas `orchestrator_runs`, `orchestrator_checkpoints`
- **Por quê:** Railway é efêmero. Fase 1 vai rodar missões multi-step por horas (ex: reconciliação contábil mensal) — precisa resumir após crash/deploy, hoje só tem resume de **sessão Managed Agent isolada**
- **Inspiração:** schema de `BuildStateManager` do aiox (traduzido Pydantic + Postgres)
- **Adicionar o que aiox não tem:** `token_budget_brl` + `tokens_consumed_brl` (Art. XII)

### REC-2 — HITL de 3 camadas com canal Baileys (`M`)

- **Refatorar:** `apps/orchestrator/src/orchestrator/security/wrapping.py` (HITL binário atual)
- **Criar:** `apps/orchestrator/src/orchestrator/hitl/{layer1_automated.py, layer2_reviewer.py, layer3_human.py, channels/whatsapp.py}`
- **Por quê:** HITL atual só bloqueia/libera. Precisa do conceito **fix-first recommendations** antes de acordar o Marcelo — economiza mensagens no WhatsApp dele
- **Inspiração:** `human-review-orchestrator.js` métodos `block()` + `generateFixRecommendations()` + `orchestrateReview()`
- **Integração:** canal consome `apps/whatsapp-gateway` já pronto

### REC-3 — MissionStateMachine com status canônico (`S`)

- **Criar:** `apps/orchestrator/src/orchestrator/missions/` — enum `MissionStatus {Draft, Ready, InProgress, InReview, Done, Blocked}` + validação leve no `POST /missions`
- **Por quê:** orchestrator hoje aceita requests livres. Status formal habilita observabilidade, reconciliação e briefing diário do D-Governanca
- **Inspiração:** state diagram de `.aiox-core/development/workflows/story-development-cycle.yaml` (sem o resto do workflow)

---

## 5. O que NÃO copiar

1. **Agente-como-arquivo-`.md`** — BMAD trata `@sm, @dev, @qa` como prompts estáticos em IDE. Marcelo usa Managed Agents com tool-use real. Regressão arquitetural.
2. **Os 20+ Epics e numeração `Story 8.1 / 11.3 / 3.5`** — disciplina agile formal para 2.7k devs, over-engineering para 5 negócios onde Marcelo é CEO + dev iniciante. **Adotar o estado, não a cerimônia.**
3. **Retry imperativo `maxIterations=10`** — cada retry contra Anthropic custa API call. Managed Agents já fazem refinement. Duplicar é desperdício. Usar retry **apenas em tool calls determinísticos** (SQL, webhook, arquivo).
4. **Dependência silenciosa via `try/require`** — anti-padrão em Python/FastAPI. Declarar deps em `pyproject.toml`, falhar cedo.

---

## 6. TL;DR cirúrgico

aiox-core é BMAD-Method rebranded. Marcelo já tem agente gerenciado + constitucionalismo superior. Vale copiar **três coisas**:

1. **Schema de `build-state.json`** → RunStateManager em Supabase
2. **Arquitetura 3-Layer HITL** com fix-first recommendations antes do humano
3. **State machine explícita de Mission**

O resto (workflow 4 agentes, stories em `.md`, retry 10 iterações, worktree isolation) é ruído no contexto V4.

---

## 7. Arquivos-chave do aiox (referência rápida)

| Caminho | O que tem |
|---|---|
| `.aiox-core/core/execution/autonomous-build-loop.js` | Loop + config (ADE) |
| `.aiox-core/core/execution/build-state-manager.js` | Schema checkpoint/resume |
| `.aiox-core/core/quality-gates/human-review-orchestrator.js` | 3-layer HITL |
| `.aiox-core/core/quality-gates/notification-manager.js` | Templates + channels |
| `.aiox-core/development/workflows/story-development-cycle.yaml` | State machine |
| `.aiox-core/constitution.md` | Gates constitucionais (comparar com 22 artigos V4) |
| `.aiox-core/development/tasks/story-checkpoint.md` | Checkpoint inter-story |
