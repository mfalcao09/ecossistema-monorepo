---
name: Sessão 045 — Fix build Vercel + preview blob URL
description: Fix build TS (null→undefined em href) + preview blob URL + prompt disciplinas 65k tokens. Commits c631432 + 9d80e02.
type: project
---

Sessão 045 (10/04/2026): fix do build Vercel após commit c631432 (preview blob URL + prompt disciplinas).

**Causa raiz:** `previewUrl` (string|null) passado em `href` que aceita string|undefined. Fix: `?? undefined` em 2 ocorrências.

**Commits no GitHub:**
- `c631432` — blob URL preview + prompt Gemini expandido + maxOutputTokens 16k→65k
- `9d80e02` — fix build (null→undefined)

**Pendente:** verificar deploy READY + testar preview + testar extração 56 disciplinas + Railway auto-deploy do extractor.js.
