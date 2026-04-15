---
name: Não commitar consumidor sem produtor — verificar origin/main antes de push
description: Não commitar consumidor sem produtor — verificar origin/main antes de push
type: feedback
project: erp
tags: ["git", "deploy", "build", "sessao-paralela"]
success_score: 0.95
supabase_id: e7daeb06-f30a-4368-844c-d496b84f3479
created_at: 2026-04-13 09:16:28.130214+00
updated_at: 2026-04-13 13:05:14.942259+00
---

Nunca commitar código que importa/chama símbolos que existem só localmente no bindfs e ainda não foram pushed. Em 07/04/2026, commit fccbbf2 quebrou deploy em produção porque importava converter-service e tipos que viviam só no bindfs local — origin/main estava 7 commits à frente. Checklist: 1) SEMPRE rodar git fetch origin && git log HEAD..origin/main --oneline ANTES de commitar quando há sessões paralelas, 2) Se local está atrás, fazer git pull --rebase ANTES de qualquer commit, 3) Rodar tsc num clone limpo do origin/main. Para features interdependentes (como Bug #F), bundle deve ser ATÔMICO.
