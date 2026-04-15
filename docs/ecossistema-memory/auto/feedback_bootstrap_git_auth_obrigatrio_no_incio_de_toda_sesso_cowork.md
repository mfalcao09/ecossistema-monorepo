---
name: Bootstrap Git Auth obrigatório no início de toda sessão Cowork
description: Bootstrap Git Auth obrigatório no início de toda sessão Cowork
type: feedback
project: erp
tags: ["git", "auth", "github", "bootstrap"]
success_score: 0.95
supabase_id: 66d81628-e8bb-4950-8455-d2a6c45174af
created_at: 2026-04-13 09:13:28.773921+00
updated_at: 2026-04-13 10:04:47.100197+00
---

Na PRIMEIRA operação git de qualquer tipo numa sessão Cowork nova, executar bootstrap de 4 comandos: 1) Descobrir SANDBOX_ID e TOKEN_FILE=/sessions/${SANDBOX_ID}/mnt/GitHub/.github-token, 2) Validar token, 3) git config --global credential.helper "store --file=$TOKEN_FILE" + user.name mfalcao09 + user.email contato@marcelofalcao.imb.br, 4) Validar com git ls-remote. Em 08/04/2026, Marcelo centralizou PAT em /Users/marcelosilva/Projects/GitHub/.github-token (persiste cross-sandbox via bind mount). git config --global credential.helper é resetado em cada sandbox novo. Sem bootstrap, git push falha com "could not read Username".
