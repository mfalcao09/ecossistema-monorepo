---
name: GitHub Auth centralizada — fine-grained PAT, nunca classic, nunca embutido
description: GitHub Auth centralizada — fine-grained PAT, nunca classic, nunca embutido
type: feedback
project: erp
tags: ["git", "github", "auth", "pat"]
success_score: 0.9
supabase_id: 3a14cf27-1d54-4c34-84da-3eddb8984a6e
created_at: 2026-04-13 09:13:52.723688+00
updated_at: 2026-04-13 10:04:49.826105+00
---

Para todos os projetos mfalcao09/*, autenticação GitHub é centralizada via fine-grained PAT único + credential.helper store global. PAT classic antigo foi revogado. Regras: 1) Verificar que remote NÃO tem token embutido (git remote -v deve mostrar URL pura), 2) Nunca embutir PAT na URL do remote, 3) Nunca criar PAT classic — sempre fine-grained com permissões mínimas: Contents:RW + Metadata:R + PullRequests:RW, 4) Se git push pedir senha, diagnosticar: checar TOKEN_FILE + credential.helper antes de sugerir solução. Procedimento em GitHub/GIT-WORKFLOW-AUTONOMO.md §2.5.
