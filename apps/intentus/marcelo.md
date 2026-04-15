# Marcelo Silva

**Email:** mrcelooo@gmail.com
**Papel:** Fundador/CEO de múltiplos negócios (tech, educação, imobiliário)
**Cosmovisão:** Cristã reformada, Missão Integral, Business as Mission

## Negócios
- **Intentus Real Estate** — SaaS imobiliário (CLM, precificação IA)
- **Nexvy** — SaaS (plataforma tech)
- **Klésis** — Colégio ("Educação com Propósito")
- **FIC** — Faculdades Integradas de Cassilândia
- **Splendori** — Incorporação imobiliária, Piracicaba/SP (House and Garden)

## Preferências de Trabalho
- Iniciante em programação — gosta de passo a passo detalhado
- Quer ver TODAS as possibilidades/caminhos para resolver um problema
- Commits via GitHub Desktop quando git não está configurado
- Formato de commit: conventional commits (fix:, feat:, docs:, etc.)
- Chama o Claude de **"Claudinho"** kkk

## Cidades-chave
- **Piracicaba/SP** — Splendori (incorporação)
- **Santo André/SP** — Imóveis testados no pricing-ai
- **Cassilândia/MS** — FIC (faculdade)

## Contexto Atual (Março 2026 — Sessão 72, 15/03/2026)
- Focado na evolução IA-native do Intentus Real Estate
- **72 sessões** de trabalho com Claudinho (Claude) + Buchecha (MiniMax M2.5)
- pricing-ai v24r8 em standby — aguardando alternativa Urbit API
- **Cronograma IA-Native em execução**: F1 (5/5 ✅) + F2 (5/5 ✅) = 10/20 itens concluídos (~118h de ~254h)
- **Próximo milestone**: F3 Item #1 — Backend de Automações (Workflow Engine) para módulo CRM (~16h)
- Plugin MiniMax M2.5 v0.3.0 ✅ funcional — pair programming Claudinho+Buchecha ativo (workflow: Claudinho comanda, Buchecha gera código)
- CLM em estado **production-ready** com: RBAC 3 camadas (22 actions × 7 roles), State Machine 13 estados (50 transições role-based), Compliance Monitor 18 regras, Copilot Agentic 12 tools, Predictive Analytics (renovações + inadimplência), Smart Notifications v2 (priority scoring, quiet hours, snooze)
- Módulo Comercial: 4 fases de fixes concluídas (sessões 42-45), benchmarking vs 5 plataformas (Follow Up Boss, Kenlo, HubSpot, Pipedrive, Sell.Do)
- Sessões 64-72: Fixes de produção massivos:
  - Sessão 64: Browser freeze CLM — 8 fixes (useContractKPIs, Contracts.tsx, RealTimeAlerts, predictions lazy load)
  - Sessão 65: CORS whitelist + RLS user_roles — 11+ EFs re-deployadas, RESTRICTIVE→PERMISSIVE policies
  - Sessões 66-70: /contratos/ + /contratos/analytics freeze — limits, tenant_id filtering, numeric parsing, ClmAnalytics rewrite (11 métricas, Map-based O(n))
  - Sessão 72: Verificação final — 19 bugs fixados (React Error #310, 6 tenant_id leaks, MAX_BATCH_SIZE validation, staleTime/refetchInterval)
- **Build**: 0 erros TypeScript em todas as 72 sessões
