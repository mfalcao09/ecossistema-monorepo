---
name: Git e Deploy Workflow Canônico ERP
description: Git e Deploy Workflow Canônico ERP
type: feedback
project: erp
tags: ["git", "deploy", "vercel", "workflow", "bootstrap"]
success_score: 0.9
supabase_id: 30e3a822-a182-4d0b-b86f-9b198cf3cebc
created_at: 2026-04-13 01:55:12.070453+00
updated_at: 2026-04-13 06:04:13.024029+00
---

BOOTSTRAP GIT: Rodar no início de toda sessão (4 comandos):
1. cat /mnt/GitHub/.github-token — lê token (contém URL https://mfalcao09:PAT@github.com)
2. PAT=$(sed "s|https://mfalcao09:||; s|@github.com||" .github-token)
3. git config --global credential.helper osxkeychain (ou store)
4. git config --global user.email contato@marcelofalcao.imb.br && user.name mfalcao09

TOKEN FORMATO: .github-token contém URL https://mfalcao09:PAT@github.com, NÃO PAT puro — extrair com sed

FUSE WORKAROUND: FUSE filesystem impede git merge. Clonar em /tmp, resolver lá, push direto.

VERCEL CLI substitui MCP: vercel deploy --prebuilt é mais confiável que MCP para monitoramento

GIT WORKFLOW: Consultar GIT-WORKFLOW-AUTONOMO.md (cross) + memory/workflows/commit-push-autonomo.md (local) antes de qualquer git

NUNCA COMMITAR consumidor sem produtor: sempre fetch+rebase+tsc em clone limpo antes de push em sessões paralelas
