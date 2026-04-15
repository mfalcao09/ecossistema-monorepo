---
name: Configuração de domínios — Portal vs ERP
description: Dois domínios apontam para o mesmo projeto Vercel, separados por middleware. gestao.* = ERP autenticado, diploma.* = portal público.
type: project
---

Separação de domínios implementada em 2026-03-31 (commit 52ea570, deploy dpl_9QqgYYBmGr1CNmcTxrrq8AkGkGdf).

**Domínios:**
- `diploma.ficcassilandia.com.br` → Portal público (consulta e validação de diplomas)
- `gestao.ficcassilandia.com.br` → ERP Educacional (painel administrativo, autenticado)

**Arquitetura:** Caminho 1 — mesmo projeto Vercel, roteamento por hostname no middleware (`src/middleware.ts`).

**Why:** Marcelo pediu separação para que o portal público de diplomas fique isolado da área administrativa. Decisão tomada por simplicidade (1 deploy, 1 repo) vs ter 2 projetos separados.

**How to apply:**
- Middleware verifica `host` header e restringe rotas por domínio
- `diploma.*`: só permite `/`, `/verificar`, `/rvdd`, `/api/portal`, `/api/documentos/verificar`, `/api/diplomas/`, `/_next`, `/favicon`
- `gestao.*`: redireciona `/` → `/home`, bloqueia rotas do portal (redireciona para `diploma.*`)
- Localhost e domínios Vercel: acesso completo (dev/testes)
- DNS configurado no Cloudflare (CNAME → `1630be57bd7e6709.vercel-dns-017.com`, DNS only / grey cloud)
- SSL gerenciado automaticamente pela Vercel
