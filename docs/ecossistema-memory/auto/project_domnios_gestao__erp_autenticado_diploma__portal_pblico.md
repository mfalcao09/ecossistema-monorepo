---
name: Domínios: gestao.* = ERP autenticado, diploma.* = portal público
description: Domínios: gestao.* = ERP autenticado, diploma.* = portal público
type: project
project: erp
tags: ["dominios", "vercel", "cloudflare", "middleware"]
success_score: 0.85
supabase_id: 2310a00e-1136-4763-8296-65a23ac67eba
created_at: 2026-04-13 09:17:44.594726+00
updated_at: 2026-04-13 14:05:29.684023+00
---

Separação de domínios implementada em 2026-03-31. diploma.ficcassilandia.com.br → Portal público. gestao.ficcassilandia.com.br → ERP Educacional. Arquitetura: mesmo projeto Vercel, roteamento por hostname no middleware (src/middleware.ts). diploma.*: só permite /, /verificar, /rvdd, /api/portal, etc. gestao.*: redireciona / → /home. DNS configurado no Cloudflare (CNAME → Vercel, grey cloud). SSL gerenciado pela Vercel.
