# Sessão 8 — Investigação multi-plataforma + documentação

- **Investigação pricing-ai multi-plataforma** — diagnóstico completo:
  - Actor `f1xSvpkpklEh2EhGJ` só retorna VivaReal apesar de receber 4 sources
  - Mapeamento de actors Apify por plataforma (VivaReal, ZapImóveis, OLX, QuintoAndar)
  - Proposta de arquitetura multi-actor paralela (v26) com `Promise.allSettled()`
  - Documento completo: `docs/pricing-ai-multi-platform-analysis.md`
- **Documentação de pendências e planos**:
  - `docs/clicksign-pendencia-lancamento.md` — ClickSign como pendência (não blocker)
  - `docs/plano-onboarding-demo-flow.md` — Plano de onboarding com 5 etapas (~12h)
  - `docs/plano-notificacoes-ia.md` — Plano de notificações com IA (~19h)
- Infraestrutura existente mapeada:
  - Onboarding: `CLMOnboardingChecklist.tsx` + `CLMOnboardingTour.tsx` + `useOnboardingProgress.ts` (8 steps, dual persist)
  - Notificações: `useNotifications.ts` (7 categorias, realtime, CRUD completo, `createNotification()`)
  - Assinatura: `signatureProvidersDefaults.ts` (5 provedores tipados, nenhum com integração funcional)
