---
name: Vercel CLI Workflow
description: Vercel CLI Workflow
type: reference
project: erp
tags: ["vercel", "cli", "deploy", "workflow", "bootstrap"]
success_score: 0.85
supabase_id: 82436f82-5802-4808-a7b6-8d7691ee0c6c
created_at: 2026-04-14 09:15:50.819402+00
updated_at: 2026-04-14 11:07:36.722076+00
---

O Vercel CLI NÃO persiste entre sessões Cowork — reinstalar e reconfigurar token a cada sessão.

## Bootstrap Vercel CLI (rodar junto com git bootstrap)

```bash
# 1. Instalar Vercel CLI (user-local)
npm install -g vercel --prefix /sessions/$(basename "$PWD")/.npm-global

# 2. Adicionar ao PATH
export PATH="/sessions/$(basename "$PWD")/.npm-global/bin:$PATH"

# 3. Configurar token (como env var, não em arquivo)
export VERCEL_TOKEN="<token-do-Marcelo>"

# 4. Verificar
vercel --version
```

## Comandos úteis
- `vercel ls` — listar projetos
- `vercel logs <deploy-url>` — logs de build
- `vercel inspect <deploy-url>` — status READY/ERROR
- `vercel env ls` — listar env vars do projeto

Alternativa preferida: Desktop Commander direto no Mac (sem reinstalar).
