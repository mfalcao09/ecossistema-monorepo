---
name: Sessão 039 — Fix conflito rotas [id] vs [sessaoId] (causa raiz REAL 504)
description: Sessão 039 — Fix conflito rotas [id] vs [sessaoId] (causa raiz REAL 504)
type: project
project: erp
tags: ["nextjs", "routing", "bug-critico", "sessao-039"]
success_score: 0.95
supabase_id: e4ec2c9d-c4a0-4318-9a97-58b55d5d245c
created_at: 2026-04-13 09:23:25.175709+00
updated_at: 2026-04-13 17:06:02.602036+00
---

Commit 935935d, deploy dpl_A7aW READY (09/04/2026). Após 8 sessões de fixes de resiliência, Tela 2 AINDA travava. Diagnóstico: busca [sessoes-route] nos logs = ZERO resultados — função NUNCA executava código. Causa raiz: Next.js App Router proíbe segmentos dinâmicos com nomes diferentes no mesmo nível: [id]/ e [sessaoId]/ coexistiam → Unhandled Rejection em 100% das requests. Build passa silenciosamente, crash só em runtime. Fix: mover [sessaoId]/converter → [id]/converter, deletar diretório conflitante. Why: 8 sessões tratavam sintomas de crash de roteamento. How to apply: SEMPRE verificar nome único de segmentos no mesmo nível. Next.js NÃO detecta este conflito no build.
