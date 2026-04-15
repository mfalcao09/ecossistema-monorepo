---
name: Sessão 027 — Push sessão 026 destravado via /tmp clone
description: Sessão 027 — Push sessão 026 destravado via /tmp clone
type: project
project: erp
tags: ["git", "deploy", "workaround", "sessao-027"]
success_score: 0.85
supabase_id: 8145c631-5674-4f93-bb58-238fda44aca1
created_at: 2026-04-13 09:22:03.410397+00
updated_at: 2026-04-13 16:05:48.819541+00
---

Destravar push pendente da sessão 026 (commit 6278116) bloqueado por gap de PAT cross-sandbox. Sequência: bootstrap git auth v3 → fetch origin (1↑/18↓) → cherry-pick via git format-patch + git am em /tmp/work-clone → npm install + next build limpo → push fb8d07c → Vercel dpl_7fnV READY 80s. Conteúdo fb8d07c: /api/diplomados filtra diplomas!inner por status registrado/gerando_rvdd/rvdd_gerado/publicado; remove botão Novo Diplomado; tsconfig exclui vitest.config.ts do type-check (corrige dpl_36uh3f). Why: fechar ciclo sessão 026 antes do plano técnico do fluxo criação processo. How to apply: próxima sessão começar pelo plano técnico completo sem tocar código até OK explícito. Bindfs HEAD ainda em 6278116 + 19 behind — workaround /tmp clone necessário para trabalhar em código.
