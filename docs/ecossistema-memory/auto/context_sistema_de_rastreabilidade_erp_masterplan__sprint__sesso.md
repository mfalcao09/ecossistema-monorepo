---
name: Sistema de Rastreabilidade ERP (Masterplan → Sprint → Sessão)
description: Sistema de Rastreabilidade ERP (Masterplan → Sprint → Sessão)
type: context
project: erp
tags: ["rastreabilidade", "sprints", "tracker", "protocolo"]
success_score: 0.85
supabase_id: aaac8a66-e633-4cda-ab3b-cccee273a3fc
created_at: 2026-04-13 01:55:12.070453+00
updated_at: 2026-04-13 06:04:13.915083+00
---

BOOT DE SESSÃO (2 leituras obrigatórias):
1. memory/TRACKER.md → estado atual, % por sprint, próxima sessão (~500 tokens)
2. Sprint ativo em memory/sprints/ → escopo desta sessão (~1.500 tokens)

ENCERRAMENTO (6 passos):
1. Salvar sessão com backlinks (masterplan→sprint→epic)
2. Atualizar sprint (✅ itens, registrar sessão)
3. Atualizar TRACKER.md (%, última/próxima sessão)
4. Atualizar MEMORY.md (rotacionar decisões)
5. Atualizar CENTRAL-MEMORY.md
6. Indicar próxima sessão se pré-planejada

ARTEFATOS POR SPRINT: masterplan (macro), SPRINT-N-PLANO.md, SPRINT-N-EXECUTADO.md — comparação obrigatória

BOOT CAMADAS: TRACKER (Camada 0, ~500 tok) + sprint ativo (Camada 1, ~1500 tok). NUNCA carregar tudo de uma vez

APROVAÇÃO: Claude propõe distribuição US/Epics por sessão, Marcelo SEMPRE aprova antes de iniciar
