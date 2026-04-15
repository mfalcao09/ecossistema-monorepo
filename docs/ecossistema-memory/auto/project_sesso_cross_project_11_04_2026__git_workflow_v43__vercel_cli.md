---
name: Sessão cross-project 11/04/2026 — GIT-WORKFLOW v4.3 + Vercel CLI
description: Sessão cross-project 11/04/2026 — GIT-WORKFLOW v4.3 + Vercel CLI
type: project
project: erp
tags: ["git", "vercel", "workflow", "cli"]
success_score: 0.9
supabase_id: f00c1eca-1762-4fc7-bfaf-f08e84e95cfa
created_at: 2026-04-13 09:25:59.657012+00
updated_at: 2026-04-13 19:06:21.799737+00
---

Verificação git workflow autônomo + migração MCP Vercel → Vercel CLI. Problema: .git/config local ERP apontava credential.helper para sandbox antigo → fatal unable to get credential storage lock. Fix: git config --unset credential.helper + git config --global credential.helper osxkeychain. Vercel CLI instalado + token mrcelooo-6898. GIT-WORKFLOW-AUTONOMO.md atualizado para v4.3: Fase G (G.1-G.4), checklist §7, stack §2.1 reescritos para CLI. Armadilha: .git/config local com caminhos de sandbox antigos causa falha silenciosa de credencial. How to apply: ao iniciar sessão nova em repo clonado, verificar se .git/config local tem credential.helper apontando para caminhos de sandbox — se sim, limpar com git config --unset.
