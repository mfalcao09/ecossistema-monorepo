---
name: Nexvy API REST v1.0.0 — Documentação Completa (Sessão 088 Batch 8)
description: Nexvy API REST v1.0.0 — Documentação Completa (Sessão 088 Batch 8)
type: reference
project: ecosystem
tags: ["nexvy", "api", "rest", "mensagens", "dashboard", "crm", "webhooks", "n8n", "integracao", "sessao088", "af-educacional", "whatsapp", "pipeline"]
success_score: 0.97
supabase_id: 1a3899a9-1b12-4968-8871-cf7dc5473eb3
created_at: 2026-04-13 03:24:36.43217+00
updated_at: 2026-04-13 07:04:25.982655+00
---

API REST da Nexvy CRM. Base URL: https://core.nexvy.tech/api (NÃO a console). Autenticação: header api-key em todos os endpoints (ainda não gerada — precisa gerar no painel). Versão: 1.0.0.

MENSAGENS (3 endpoints POST):
- POST /messages/send/v2 — Texto: headers api-key+Connection-Token, body: number+body
- POST /messages/send/v2 — Mídia: number + medias[] (binários, formData)
- POST /message-template/send/v2 — Template: number+templateName+processedText+manualVariables{{1}}

DASHBOARD (10 endpoints GET, todos com date_from+date_to no formato d/m/Y):
/dashboard/counters (contadores gerais), /dashboard/calls (chamadas), /dashboard/tags (distribuição tags), /dashboard/activities (atividades leads), /dashboard/chats (conversas), /dashboard/presale (equipe pré-venda), /dashboard/closer (equipe fechamento), /dashboard/list/presale (ranking SDR), /dashboard/list/closer (ranking closers), /dashboard/list/products (ranking produtos)

CRM — Contatos: POST /contact (number, name, tags[], customFields{}), GET /contact (id/number/page/limit), PUT /contact/{identifier} (name, tags, customFields)

CRM — Tickets: POST /ticket (contact, socialConnection obrigatórios; queue, responsible opcionais), GET /ticket (uuid/number/page/startDate/endDate/limit), PUT /ticket/{identifier} (status: pending|open|closed; queue; responsible), GET /ticket/{identifier}/messages (histórico)

CRM — Negócios Comerciais: GET /commercial-order (id/number/page/limit), PUT /commercial-order/{identifier} (step, amount, responsible)

WEBHOOKS (3 eventos apenas para pipeline/CRM):
- COMMERCIAL_ORDER_CREATED: commercialOrderId, number, name, step, pipeline, amount, responsible, contact{}
- COMMERCIAL_ORDER_STEP_CHANGED: commercialOrderId, oldStep, oldStepId, toStep, toStepId, responsible, contact{}
- COMMERCIAL_ORDER_CHANGED: id, amount, status, timestamps múltiplos, ids relacionais, objetos aninhados

OBSERVAÇÕES CRÍTICAS INTEGRAÇÃO n8n:
- api-key NÃO gerada — gerar antes de usar
- Connection-Token identifica o canal específico (WABA, Instagram)
- identifier nos PUT aceita ID numérico OU número de telefone
- customFields é flexível (qualquer chave/valor)
- Webhooks cobrem APENAS eventos de pipeline — sem eventos de mensagens ou tickets
