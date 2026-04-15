---
name: Sessão 033 — DB Write Direto Railway→Supabase (elimina canal HTTP)
description: Sessão 033 — DB Write Direto Railway→Supabase (elimina canal HTTP)
type: project
project: erp
tags: ["railway", "db-write", "refatoramento", "sessao-033"]
success_score: 0.92
supabase_id: 18b40e74-80bd-4f8b-a03e-6dad748793d5
created_at: 2026-04-13 09:22:44.860063+00
updated_at: 2026-04-13 17:05:56.179393+00
---

Commit 3bccb3c, deploy dpl_Buw6 READY 80s (09/04/2026). Refatoramento que elimina canal HTTP callback após 3 bugs consecutivos (031-032-nonce race). Railway agora escreve direto em extracao_sessoes via service_role (supabase-writer.js). UPDATE atômico idempotente WHERE status=processando. server.js perdeu enviarCallback + isCallbackUrlAllowed; /api/extracao/sessoes/[id]/callback virou 410 Gone. Railway requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY do projeto ifdnjieklngcfodmtied. How to apply: debug extração travada → olhar logs Railway [db-writer] e extracao_sessoes.erro_mensagem (não mais callback HTTP).
