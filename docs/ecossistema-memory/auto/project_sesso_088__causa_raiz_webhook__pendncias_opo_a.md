---
name: Sessão 088 — Causa raiz webhook + pendências Opção A
description: Sessão 088 — Causa raiz webhook + pendências Opção A
type: project
project: erp
tags: ["sessao-088", "webhook", "atendimento", "pendencias", "opcao-a"]
success_score: 0.9
supabase_id: 64151638-8b2e-4b51-8171-e207ef9a580a
created_at: 2026-04-13 06:47:08.370588+00
updated_at: 2026-04-13 09:04:41.232573+00
---

Status: webhook.ts usa schema errado (chat_*). Opção A aprovada: reescrever para atendimento_*. Pendências: (1) reescrever webhook.ts, (2) remover debug-write + bypass middleware, (3) commit/push via /tmp clone (repo mfalcao09/diploma-digital), (4) aguardar Vercel READY, (5) validar com Meta dispatcher. Tech debt: 14 tabelas chat_* em bvryaopfjiyxjgsuhjsb (Intentus) a limpar. Último commit main: 715b516.
