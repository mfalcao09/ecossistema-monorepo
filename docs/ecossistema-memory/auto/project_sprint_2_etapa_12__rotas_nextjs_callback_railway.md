---
name: Sprint 2 Etapa 1.2 — rotas Next.js callback Railway
description: Sprint 2 Etapa 1.2 — rotas Next.js callback Railway
type: project
project: erp
tags: ["nextjs", "callback", "nonce", "sessao-030"]
success_score: 0.88
supabase_id: afadd0ec-1ec7-497d-9839-8e027098a840
created_at: 2026-04-13 09:22:03.410397+00
updated_at: 2026-04-13 16:05:52.735295+00
---

Commit f9739e46, deploy dpl_Bgyw READY 71s (08/04/2026). 4 arquivos 786 linhas: POST /api/extracao/iniciar + PUT /api/extracao/sessoes/[id]/callback + callback-auth.ts + migration nonce. Decisões: nonce 1-uso 256bits hex na query string; signed URL TTL 600s; lock lógico UNIQUE INDEX parcial por processo_id/usuario_id. Code review Buchecha: await fetch() obrigatório (fire-and-forget corta conexões em serverless); filtro .eq(status,processando) no marcar-erro; nonce UPDATE atômico é belt-and-suspenders suficiente vs race. Contrato: POST /iniciar da UI autenticada → NUNCA dar front acesso ao callback → usar version como race guard em edições pós-extração.
