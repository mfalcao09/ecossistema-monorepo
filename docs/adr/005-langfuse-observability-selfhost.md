# ADR-005: Langfuse self-host para observability

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte IX §34, Art. XVI (Observabilidade por Default), ADR-004

## Contexto e problema

Com ~30-35 agentes + 6 Diretores + Claudinho + workers Railway + EFs, o ecossistema precisa:

- **Traces** end-to-end (request do agente → LiteLLM → provider → tool → EF → DB)
- **Metrics** de qualidade (success rate por agente, custo por sessão, latência)
- **Evals** automatizados (qualidade de resposta, alinhamento constitucional)
- **Prompt management** com versioning
- **Dashboards** cross-business para D-Governanca e D-Infra

Sem observability unificada, debugar falhas de agente vira arqueologia de logs. O Art. XVI (Observabilidade por Default) é um Artigo canônico V8.2/V9.

## Opções consideradas

- **Opção 1:** LangSmith (SaaS LangChain) — ótimo DX, caro, dados fora do BR
- **Opção 2:** Langfuse self-host (MIT, Postgres + ClickHouse)
- **Opção 3:** Phoenix (Arize AI) — bom mas menos maduro em prompt mgmt
- **Opção 4:** Helicone — menos completo em evals

## Critérios de decisão

- Licença (queremos self-host possível)
- Integração nativa com LiteLLM (ADR-004)
- Prompt versioning (complementa Managed Agents versioning — ADR-001)
- Custo de infra (quanto Railway consome)
- Soberania de dados (LGPD, logs de alunos não podem sair do BR)

## Decisão

**Escolhemos Opção 2** — Langfuse self-host em Railway (Postgres + ClickHouse).

Motivo: MIT + controle total dos dados + integração nativa LiteLLM + dashboards completos + prompt management com evals. Arquitetura é bem documentada e estável.

## Consequências

### Positivas
- **Soberania de dados** — todos os traces ficam em infra própria (LGPD)
- Integração plug-and-play com LiteLLM (emite traces nativamente)
- Dashboards prontos para: custo, latência, success rate, prompt versions
- Evals automatizados rodáveis em CI
- Sem lock-in: SDK Python/TS open source

### Negativas
- Precisa operar ClickHouse + Postgres em Railway (2 stacks)
- Upgrade de major version do Langfuse exige atenção (breaking changes no schema)
- Sem free tier infinito de SaaS — ocupa slots Railway

### Neutras / riscos
- **Risco:** ClickHouse consumo de memória > esperado. **Mitigação:** começar com single-node, monitorar métricas, escalar vertical antes de sharding.
- **Risco:** PII em traces. **Mitigação:** PII Mask pipeline (SC-19) roda antes de enviar ao Langfuse.

## Evidência / pesquisa

- `research-repos/langfuse/` — arquitetura Postgres + ClickHouse documentada
- `docs/analises/ANALISE-MULTIAGENT-VOICE-OBS.md` seção "observability"
- LiteLLM config: `litellm_settings.success_callback: ["langfuse"]` habilita tracing
- MASTERPLAN-V9 § Parte IX §34 Tabela

## Ação de implementação

- Deploy Langfuse no Railway: Postgres + ClickHouse + web + worker (sessão S09)
- Conectar LiteLLM via callback `langfuse` (S09)
- Integrar Managed Agents sessions via SDK callback (S09)
- Criar dashboards canônicos: ecossistema health, custo per business, prompt quality (S09)

## Revisão

Revisar em 2026-07-16 ou se custo Railway Langfuse > USD 300/mês ou se ClickHouse apresentar instabilidade.
