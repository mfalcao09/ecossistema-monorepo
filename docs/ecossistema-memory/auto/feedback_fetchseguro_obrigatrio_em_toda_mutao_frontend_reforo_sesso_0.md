---
name: fetchSeguro obrigatório em TODA mutação frontend (reforço sessão 091)
description: fetchSeguro obrigatório em TODA mutação frontend (reforço sessão 091)
type: feedback
project: erp
tags: ["csrf", "segurança", "frontend", "fetchSeguro", "mutações"]
success_score: 0.98
supabase_id: 6d986418-a9e7-456f-a773-eb66bae8273c
created_at: 2026-04-13 23:22:29.771969+00
updated_at: 2026-04-14 00:06:41.771842+00
---

Regra reforçada: toda chamada POST/PATCH/PUT/DELETE do frontend ERP DEVE usar fetchSeguro() de @/lib/security/fetch-seguro, nunca fetch() nativo. Motivo: as rotas da API têm validarCSRF(request) que retorna 403 silencioso sem o token CSRF. O fetchSeguro lê o cookie do token e injeta no header automaticamente. Bug encontrado em configuracoes/usuarios/page.tsx (sessão 091) — ambas as mutações usavam fetch nativo e o cadastro simplesmente não salvava sem exibir erro claro.
