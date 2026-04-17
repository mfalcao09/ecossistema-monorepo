# ADR-001: Managed Agents como runtime primário de agentes

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte I §6 D1, § Parte III, ADR-002, ADR-009, PLANO-EXECUCAO-V4 D1

## Contexto e problema

O ecossistema vai operar ~30-35 agentes C-Suite distribuídos em 5 negócios (FIC, Klésis, Intentus, Splendori, Nexvy) + 6 Diretores de Área no nível ecossistema + Claudinho como VP. A maioria deles precisa:

- Raciocínio em linguagem natural (não determinístico)
- Histórico de sessões persistente, pausável, retomável
- Hooks constitucionais (22 Artigos V9) aplicados antes/depois de cada tool call
- Prompt versioning + rollback para evoluir prompts com segurança
- `status_idled` webhook para Human-in-the-loop (Art. II)

Marcelo é dev iniciante. Não quer operar Kubernetes, queues, autoscaling, retries. Quer infra gerenciada com baixo overhead operacional.

Já existe um piloto rodando `@anthropic-ai/claude-agent-sdk` + Managed Agents (cookbook `CMA_gate_human_in_the_loop`). A pergunta é: adotamos Managed Agents como **runtime primário** para todos os C-Suite e Diretores, ou construímos orquestrador próprio?

## Opções consideradas

- **Opção 1:** Anthropic Managed Agents como runtime primário + `@anthropic-ai/claude-agent-sdk` como cliente/SDK. LangGraph apenas para Jarvis meta-layer (long-running, multi-turn orquestração humano-assistida).
- **Opção 2:** Self-host Agent SDK + orquestrador custom FastAPI em Railway. Controle total mas precisa reescrever session management, retry, webhook.
- **Opção 3:** LangGraph puro no Railway para todos os agentes. Maduro, mas sem HITL `status_idled` nativo nem prompt versioning.

## Critérios de decisão

- **Overhead operacional** — quanta infra Marcelo tem que cuidar
- **HITL de baixo custo** — Art. II exige webhook ao Marcelo; `status_idled` resolve nativo
- **Prompt versioning + rollback** — Padrão 5 V9; cookbook provê pronto
- **Custo por sessão** — tokens + infra idle
- **Escalabilidade a 30-35 agentes** — sem provisionamento manual

## Decisão

**Escolhemos Opção 1.** Managed Agents é runtime primário para C-Suite e Diretores; SDK Python/TS é o cliente em apps/orchestrator; LangGraph fica reservado para Jarvis (E3/E4) onde precisamos grafo de estado multi-turn complexo.

Motivo principal: Managed Agents resolve nativamente HITL (`status_idled` + webhook), prompt versioning (`agents.update()` + `sessions.create(version=N)`) e persistência de sessão — três requisitos V9 que seriam ~mil linhas de código self-host.

## Consequências

### Positivas
- Zero infra de sessão para manter (autoscale, retry, persistence gerenciados)
- HITL Art. II via webhook nativo, não long-polling
- Rollback de prompt version em uma chamada de API
- Hooks constitucionais (SDK) rodam do mesmo jeito em dev e prod
- Marcelo consegue auditar sessões via dashboard Anthropic

### Negativas
- Lock-in Anthropic — troca de provider é trabalhosa
- Sem edge deploy próprio — latência depende de região Anthropic
- Precificação comercial (não MIT/open source)

### Neutras / riscos
- **Risco:** mudança de pricing Managed Agents. **Mitigação:** LiteLLM (ADR-004) isola modelo; SDK é MIT e roda standalone se preciso. Saída possível em ~2 sprints.
- **Risco:** região/latência BR. **Mitigação:** LiteLLM no Railway SA tem fallback para rotas diretas.

## Evidência / pesquisa

- `claude-cookbooks/managed_agents/` — inteiro, com foco em `CMA_gate_human_in_the_loop.ipynb` e `CMA_prompt_versioning_and_rollback.ipynb`
- `docs/analises/ANALISE-JARVIS-REFERENCE.md` — análise LangGraph × Managed Agents para Jarvis meta-layer
- `docs/research/CONSOLIDADO-FINDINGS-2026-04-15.md` — seção "runtime de agentes"
- V4 D1 decisão pré-existente reafirmada em V9 § Parte I §6

## Ação de implementação

- Piloto CFO-FIC em Managed Agents (sessão S16)
- `apps/orchestrator` FastAPI Railway expõe HTTP facade com hooks SDK (sessão S10)
- Templates C-Suite em `packages/c-suite-templates/` com `ManagedAgent` por default (sessão S11)
- Webhook `status_idled` para WhatsApp Evolution API (sessão S16)

## Revisão

Revisar em 2026-10-15 (6 meses) ou quando custo Managed Agents > USD 2.000/mês consolidado.
