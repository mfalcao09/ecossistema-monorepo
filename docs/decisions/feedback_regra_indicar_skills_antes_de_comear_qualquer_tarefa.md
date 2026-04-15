---
name: Regra: Indicar skills ANTES de começar qualquer tarefa
description: Regra: Indicar skills ANTES de começar qualquer tarefa
type: feedback
project: ecosystem
tags: ["skills", "plugins", "obrigatorio", "workflow"]
success_score: 0.9
supabase_id: 0d2707f2-6fb6-458a-aa34-a0ee1cb7bd4b
created_at: 2026-04-13 01:53:46.371917+00
updated_at: 2026-04-13 05:04:02.832941+00
---

OBRIGATÓRIO: A cada decisão, plano, tarefa ou implementação, Claude DEVE:
1. Antes de começar, indicar quais skills e plugins serão utilizados e por quê
2. Sempre usar as skills relevantes — nunca trabalhar sem elas
3. Formato: "Para esta tarefa, vou utilizar: [skill X] (motivo), [skill Y] (motivo)"

Mapa por contexto:
- Visão estratégica: biz-strategy + marcelo-profile + c-level-squad
- Criar agente: engineering:system-design + engineering:architecture
- Prospecção/vendas: sales + apollo + common-room
- Atendimento: customer-support + brand-voice
- Marketing: marketing + brand-comms + copy-squad
- Automação: n8n + trigger-dev + Pipedream MCP
- Segurança: security + cybersecurity
- Pesquisa: researcher
- Criar plugin/skill: create-skill + cowork-plugin-management
