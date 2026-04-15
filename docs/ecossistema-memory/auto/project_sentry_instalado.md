---
name: Sentry instalado nos dois projetos
description: Sentry configurado no Intentus (@sentry/react + vite-plugin) e ERP (@sentry/nextjs), org mfalcao-organization
type: project
---

Sentry instalado em ambos os projetos em 05/04/2026.

**Intentus Real Estate** (Vite/React):
- Pacotes: `@sentry/react` + `@sentry/vite-plugin`
- Config: `sentry.client.config.ts` (único — sem server/edge)
- Import: em `src/main.tsx` (primeira linha)
- Env var: `VITE_SENTRY_DSN` (prefixo VITE_, não NEXT_PUBLIC_)
- DSN: `https://361d87...sentry.io/4511170572124160`
- Plugin Vite: `sentryVitePlugin` em `vite.config.ts`
- Source maps: `sourcemap: true` no build

**ERP-Educacional** (Next.js):
- Pacote: `@sentry/nextjs` v10.47.0
- Configs: client, server, edge + instrumentation.ts
- next.config.mjs: `withSentryConfig` com tunnelRoute `/monitoring`
- CSP atualizado com `https://*.ingest.us.sentry.io`
- Env var: `NEXT_PUBLIC_SENTRY_DSN`
- DSN: `https://0b373e...sentry.io/4511170572255232`

**Organização:** mfalcao-organization (US)
**Painel:** https://mfalcao-organization.sentry.io

**Why:** Monitoramento de erros e performance em produção
**How to apply:** Ao fazer deploy, lembrar de adicionar SENTRY_AUTH_TOKEN nas env vars da Vercel
