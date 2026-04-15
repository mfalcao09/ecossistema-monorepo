---
name: GitHub PAT cross-sandbox resolvido via /mnt/GitHub/.github-token
description: GitHub PAT cross-sandbox resolvido via /mnt/GitHub/.github-token
type: feedback
project: erp
tags: ["git", "github", "pat", "sandbox"]
success_score: 0.85
supabase_id: 45c06595-ac7d-4b09-8af1-9b520d27ddaa
created_at: 2026-04-13 09:13:52.723688+00
updated_at: 2026-04-13 10:04:53.412933+00
---

Status: RESOLVIDO em 08/04/2026 (v3). PAT movido para /Users/marcelosilva/Projects/GitHub/.github-token (sandbox: /sessions/{ID}/mnt/GitHub/.github-token). Persiste porque /mnt/GitHub/ é bind mount do Mac. Histórico: v2 salvava PAT em /sessions/{SANDBOX_ID}/.github-token — isolado por sandbox, não persistia cross-sessão. Solução: em toda sessão Cowork nova, rodar bootstrap de auth ANTES de qualquer git. Nunca mais salvar token em /sessions/{ID}/.github-token fora de /mnt/. Ver bootstrap_git_auth_novo_sandbox.md.
