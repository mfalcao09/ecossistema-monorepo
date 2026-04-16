# Consolidado de Findings — Pesquisa Profunda dos 43 Repositórios

> **Data:** 2026-04-15
> **Método:** 7 agentes de análise lendo código-fonte real (não READMEs)
> **Escopo:** 43 repos clonados e inspecionados (V6 Core, Orchestration, Agent Frameworks, Autonomous Agents, High Value, Kahler)

---

## 🚨 Achado principal — O V7/V8 construiu narrativas sobre ficções

A análise do código-fonte dos 8 repos que formariam a base dos 6 Meta-Padrões do V7 revelou que **a maioria das conexões narradas não existe**:

- **MP-01 Token Efficiency Nexus** — CARL, BASE, ccusage são 3 tools independentes de autores diferentes (Kahler + ryoppippi) que **não se integram**. Cada um sozinho é legítimo, mas o "Nexus" é conceitual.
- **MP-02 Semantic Graph Mesh** — GraphRAG-SDK é um produto da **FalkorDB**, não do Kahler. Zero integração com LightRAG, bloop, OpenSpace. "Mesh" não existe.
- **MP-03 Autonomous Agent Orchestration** — PAUL **explicitamente rejeita** subagents no README ("~70% quality"). SEED é ferramenta de ideação interativa. Ambos são anti-autônomos.
- **MP-05 Multi-Modal Retrieval** — GraphRAG-SDK só processa texto. Multi-modal não existe.

**Implicação:** O masterplan precisa ser reescrito com base no que os códigos REALMENTE fazem, não no que as narrativas prometiam.

---

## ✅ O que é REAL e funciona — 18 padrões validados em código

### Tier 1 — Adotar IMEDIATAMENTE (aplicação direta ao Ecossistema)

| # | Padrão | Fonte | Aplicação |
|---|---|---|---|
| 1 | **Subagent-driven-development** (fresh agent por task + 2-stage review) | superpowers | Padrão central para Managed Agents dispatch |
| 2 | **PostgreSQL + pgvector 4-table memory** (sessions, file_claims, archival_memory, handoffs) | Continuous-Claude-v3 | Memory layer do Jarvis no Supabase ECOSYSTEM |
| 3 | **YAML handoff** para continuidade entre sessões | Continuous-Claude-v3 | Resolve dealbreaker de perda de memória |
| 4 | **SKILL.md com YAML frontmatter** (com descrição "pushy" contra undertriggering) | anthropics/skills | Formato canônico de toda skill |
| 5 | **Confidence gate** (≥90% prossegue, 70-89% alternativas, <70% pergunta) | SuperClaude | Governança de decisões autônomas |
| 6 | **HARD-GATE** (bloqueia implementação até design aprovado) | superpowers | Governança contra autonomia prematura |
| 7 | **Managed agents como callable tools** ({task, additional_args} → sub-agent → report) | smolagents | Mais próximo do padrão Anthropic Managed Agents |
| 8 | **TokenBufferMemory backed by DB** (conversations + messages tables) | Dify | Memory de sessão com truncation por token |

### Tier 2 — Adotar em seguida

| # | Padrão | Fonte | Aplicação |
|---|---|---|---|
| 9 | **Storage abstraction com backends plugáveis** (BaseKVStorage, BaseVectorStorage, BaseGraphStorage) | LightRAG | Suporta Supabase + fallback |
| 10 | **Skill Evolution** (FIX/DERIVED/CAPTURED) | OpenSpace | Jarvis self-improving |
| 11 | **Communication Gateway multi-canal** (15+ adapters) | nanobot | WhatsApp/Instagram/Telegram em uma interface |
| 12 | **SubagentManager** com spawning + ResourceBudget | nanobot + AutoGPT | Delegação com limite de tokens por sub-agente |
| 13 | **AutoCompact proativo** (TTL + summarization + tail) | nanobot | Sessões idle não consomem contexto |
| 14 | **5-hook lifecycle** (SessionStart/UserPromptSubmit/PostToolUse/Summary/SessionEnd) | claude-mem | Observabilidade de agentes |
| 15 | **Lifecycle hooks** (pre/post tool use, pre/post agent) | n8n | Plugin system |
| 16 | **RunnableVerticesManager** (dependency graph → execução paralela) | Langflow | Squad paralelo de agents |
| 17 | **Queue-based streaming** (AppQueueManager + Supabase Realtime) | Dify | UI live updates de agent thoughts |
| 18 | **Engine fallback waterfall** (lista de estratégias → cascade on failure + tracking) | firecrawl | Padrão para toda chamada externa (Inter, BRy, MEC) |

### Tier 3 — Avaliar quando necessário

| # | Padrão | Fonte | Aplicação |
|---|---|---|---|
| 19 | **TLDR 5-layer code analysis** (AST→CG→CFG→DFG→PDG, 95% economia tokens) | Continuous-Claude-v3 | Agentes que analisam código |
| 20 | **Daemon auto-extract learnings** dos thinking blocks | Continuous-Claude-v3 | Aprendizado composto automático |
| 21 | **Continuous Learning v2** (instincts + confidence scoring) | everything-claude-code | Self-improvement com medida |
| 22 | **Wave-Checkpoint-Wave** parallel execution (3.5x speedup) | SuperClaude | Squad com pontos de sync |
| 23 | **DeepSeek MoE routing** (score agents contra query, ativa top-k) | DeepSeek-V3 | Dispatch inteligente (vs if/else) |
| 24 | **Valves pattern** (Valves global + UserValves por usuário) | Open WebUI | Config de agents por negócio |
| 25 | **Hierarchical memory 4 níveis** (Global/Extension/Project/User-Project) | Gemini CLI | Memory do Jarvis com RLS |
| 26 | **Component system com topological sort** (_run_after dependency) | AutoGPT | Composição de capabilities |
| 27 | **Permission glob patterns** (tool_name(glob) com allow/deny lists) | AutoGPT | Sandboxing por negócio |
| 28 | **AgentShield adversarial** (red-team + blue-team + auditor — 3 agents Opus) | everything-claude-code | Security audit de agents |

---

## 🔥 Descobertas que CONTRADIZEM o V8.2

### 1. O modelo "8 diretores C-Suite separados" é provavelmente errado

**Evidência convergente:**
- **superpowers** (subagent-driven-development): fresh subagent por task, NÃO agents permanentes paralelos
- **smolagents**: managed agents são TOOLS do orquestrador, não peers
- **nanobot**: 1 agent runtime + skills como overlays, não N agents separados
- **PAUL** (Kahler): explicitamente REJEITA autonomia — "~70% quality"

**Implicação:** Ao invés de **8 diretores permanentes Sonnet 4.6**, talvez devêssemos ter:
- **1 Claudinho Opus** como orchestrator
- **Skills/Overlays por domínio** (CFO-skill, CMO-skill, CLO-skill) carregadas JIT
- **Subagents sob demanda** via Task tool quando precisar profundidade

**Custo:** 8 Sonnet 24/7 = ~$5000/mês em idle. Skills JIT = só paga quando usa.

### 2. O SC-29 Credential Vault pode estar over-engineered

**Evidência:**
- **anthropics/skills** já usa Supabase Vault direto via Edge Functions
- **nanobot** usa env vars simples + provider abstraction
- Ninguém nos repos analisados implementou um "Credential Agent" autônomo

**Implicação:** O SC-29 como "agente autônomo" parece over-engineered. Uma **Edge Function simples** `get_credential(name, project, env)` + `credential_access_log` resolve. Não precisa de "agente".

### 3. Governança via hooks > Governança via artigos

**Evidência:**
- **Continuous-Claude-v3**: 30 hooks em 7 lifecycle events FORÇAM compliance
- **superpowers**: HARD-GATE na markdown BLOQUEIA ação
- **SuperClaude**: ConfidenceChecker é código, não constituição

**Implicação:** Os **22 Artigos Constitucionais** do V8.2 são belos mas não-executáveis. Hooks que bloqueiam ação são executáveis. Precisa converter cada artigo em um hook concreto.

### 4. Monorepo "apps + packages" do V4 está certo — mas faltam peças

**Evidência do que funciona em monorepos reais:**
- **opencode**: packages/{opencode,console,desktop,server,sdk,plugin,enterprise}
- **AutoGPT**: classic/forge/ com components + protocols
- **langchain**: libs/{langchain,core,model-profiles}

**Peças que V4 não previu mas são essenciais:**
- `packages/hooks/` — sistema de hooks centralizado
- `packages/skills-registry/` — registro de skills do ecossistema
- `packages/gateway/` — Communication Gateway multi-canal

---

## 🎯 Os 10 padrões MAIS aplicáveis ao Jarvis (priorizados por impacto)

1. **Subagent-driven-development** — dispatch pattern central
2. **PostgreSQL + pgvector 4-table memory** — resolve memória persistente
3. **YAML handoff** — resolve perda de contexto
4. **SKILL.md canônico** — resolve proliferation de agents
5. **Confidence gate + HARD-GATE** — governança executável
6. **Managed agents como tools** — padrão Anthropic-nativo
7. **Communication Gateway (15+ canais)** — presença multi-plataforma
8. **TokenBufferMemory DB** — memory de conversação eficiente
9. **Storage abstraction** — ECOSYSTEM + DBs per-projeto sem acoplamento
10. **Lifecycle hooks (30 hooks/7 events)** — observabilidade executável

---

## 📋 Implicações para o Masterplan

### O V4 (Plano de Execução) precisa de atualizações:
- Adicionar `packages/hooks/` e `packages/skills-registry/`
- Reconsiderar "8 diretores permanentes" vs "1 orquestrador + skills"
- SC-29 vira Edge Function simples, não "agente autônomo"

### O V8.2 (Masterplan arquitetural) precisa de revisão crítica:
- **6 Meta-Padrões**: 4 de 6 são ficcionais → descartar narrativa
- **29 Super-Crates**: revisar quais são code patterns vs ferramentas de terceiros que foram cooptadas
- **22 Artigos Constitucionais**: converter cada um em hook concreto OU assumir que são valores não-executáveis

### O que deve ser CRIADO que não estava no masterplan:
- **Skill Registry** (inspirado em anthropics/skills + OpenSpace)
- **Hook System** executável (inspirado em Continuous-Claude-v3)
- **Communication Gateway** (inspirado em nanobot)
- **Engine Fallback Waterfall** para APIs externas (Inter, BRy, MEC)

---

## Próximas ações sugeridas

1. **Marcelo lê este documento** e valida/refuta os achados
2. **Reescrever o masterplan V9** com base em patterns reais, não narrativas
3. **Descartar narrativas** dos 6 Meta-Padrões — eles são conceito útil mas não realidade
4. **Implementar Tier 1** (10 padrões prioritários) na Fase 0 do V4
5. **Arquivar documentos v2-v8** como histórico — o V9 é a nova base canônica
