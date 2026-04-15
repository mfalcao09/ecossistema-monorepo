---
name: Next.js App Router — NUNCA misturar nomes de segmentos dinâmicos no mesmo nível
description: Dois diretórios dinâmicos com nomes diferentes no mesmo nível ([id] e [sessaoId]) causam Unhandled Rejection silencioso em runtime — build passa sem erro
type: feedback
---

NUNCA criar diretórios dinâmicos com nomes diferentes no mesmo nível do App Router (ex: `[id]/` e `[sessaoId]/` sob o mesmo pai). O build do Next.js **NÃO detecta** o conflito — compila silenciosamente. Mas em runtime, o router falha com "Unhandled Rejection: Error:..." em 100% das invocações para QUALQUER rota naquele nível.

**Why:** Sessão 039 — 8 sessões consecutivas de debugging (031-038) atacaram timeouts, polling, paralelização, sem resolver. A causa real era `[id]/` e `[sessaoId]/` coexistindo sob `/api/extracao/sessoes/`. A serverless function nunca executou nosso código — crashava no routing layer antes de carregar o módulo. Zero logs da aplicação apareciam.

**How to apply:** Ao criar subrotas de uma rota dinâmica, SEMPRE verificar o nome do segmento pai existente e usar o mesmo. Se precisa de `converter/route.ts` e já existe `[id]/route.ts`, criar em `[id]/converter/route.ts`, NÃO em `[sessaoId]/converter/route.ts`. Sintoma de alerta: zero logs da aplicação + 504/503 em todas as invocações + edge-middleware logando status=200.
