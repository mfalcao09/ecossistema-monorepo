# Sessão 64 — Varredura CLM: Fix browser freeze + bugs críticos (14/03/2026)

- **Objetivo**: Eliminar todos os erros e bugs do módulo CLM antes de avançar para Fase 3 (CRM). Marcelo reportou: (1) `/contratos` não funciona, (2) Dashboard CLM (`/contratos/command-center`) trava a aba do navegador completamente
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Investigação com 3 agentes paralelos + code review MiniMax
- **5 fixes implementados**:
  1. **Fix 1 — useContractKPIs.ts (CRITICAL)**: Root cause do browser freeze. Reescrito: (a) queryKey instável (novo objeto a cada render) → `useMemo` com primitivos. (b) Instalments query GLOBAL (buscava TODAS as parcelas do banco) → filtradas por `.in("contract_id", batch)` com batching de 200. (c) Multi-pass `.filter().reduce()` → single-pass `for...of` aggregation. (d) refetchInterval 5min→10min, staleTime 2min→5min. (e) `.limit(2000)` safety net nos contratos
  2. **Fix 2 — Contracts.tsx (hook order violation)**: `handleOnboardingAction` callback referenciava `contracts` na dependency array, mas `useContracts()` era declarado DEPOIS. Movido `useContracts()` para ANTES do `handleOnboardingAction`
  3. **Fix 3 — RealTimeAlerts (queries duplicadas)**: Parent (`ClmCommandCenter`) e child (`RealTimeAlerts`) ambos chamavam `useContractsNearExpiry()` e `useOverdueInstallmentsForCollection()` = queries duplicadas. Convertido para receber dados via props: `<RealTimeAlerts expiryAlerts={...} overdueItems={...} isLoading={...} />`
  4. **Fix 4 — Prediction widgets (lazy loading)**: `RenewalPredictionWidget` e `DefaultRiskPredictionWidget` faziam Edge Function calls automaticamente no mount (2 chamadas pesadas). Adicionado estado `showPredictions` com botão "Carregar Análises Preditivas" — widgets só montam sob demanda
  5. **Fix 5 — Memoização (RealTimeAlerts + useAlertCounts)**: (a) RealTimeAlerts: filtros duplicados `.filter()` → single-pass `for...of` com `useMemo` (sugestão Buchecha). (b) useAlertCounts: 4x `.filter()` → single-pass `switch` com `useMemo`. (c) refetchInterval dos hooks de alerts 5min→10min, staleTime 2min→5min
- **Validação Buchecha (MiniMax M2.5)**: Code review aprovado para fixes 1-5 e 6-8. Buchecha identificou cascata de invalidações como possível causa adicional (verificado — não se aplica neste caso)
- **Fixes 6-8 (continuação — problema persistia após fixes 1-5)**:
  6. **Fix 6 — AIInsightsPanel lazy loaded (CRITICAL)**: AIInsightsPanel (819 linhas) montava automaticamente no Command Center, disparando 3 queries pesadas: `usePortfolioInsights()` (2 queries: contracts + ALL analyses), `useAIOverview()` (1 query: view completa). Adicionado estado `showAIInsights` com botão "Carregar Insights IA" — componente só monta sob demanda
  7. **Fix 7 — refetchInterval normalizado (MEDIUM)**: 4 hooks com intervalos agressivos demais:
     - `useClmDashboard`: refetchInterval 2min→5min, staleTime 1min→2min
     - `useClmObligationsDashboard`: refetchInterval 2min→5min, staleTime 1min→2min
     - `useClmPendingApprovals`: refetchInterval 1min→5min, staleTime 30s→2min
     - `usePendingSignatureCount`: refetchInterval 2min→5min, staleTime 1min→2min
     - Resultado: ciclo de refetch de "a cada 1 minuto" para "a cada 5 minutos"
  8. **Fix 8 — .limit() em queries AI unbounded (MEDIUM)**: Duas queries buscavam TODOS os registros sem limite:
     - `fetchAIOverview()` → `.limit(200)` adicionado (view v_contract_ai_overview)
     - `fetchPortfolioInsights()` → `.limit(500)` adicionado (contract_ai_analysis)
- **Impacto total dos 8 fixes**: Queries no mount ~18→~12. Refetch cycle de 1min→5min. Dados transferidos reduzidos ~80% nas queries AI
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) + build Vite OK (29s, 4517 modules)
- **Arquivos modificados** (8):
  - `src/hooks/useContractKPIs.ts` — reescrito com stable queryKey, filtered installments, single-pass aggregation
  - `src/pages/Contracts.tsx` — hook order fix (useContracts before handleOnboardingAction)
  - `src/components/contracts/command-center/RealTimeAlerts.tsx` — props-based, single-pass memoized
  - `src/pages/ClmCommandCenter.tsx` — passa props ao RealTimeAlerts, prediction widgets + AIInsightsPanel lazy loaded
  - `src/hooks/useContractAlerts.ts` — useMemo single-pass, intervals 5→10min
  - `src/hooks/useClmDashboard.ts` — refetchInterval 2min→5min em 3 hooks, staleTime 1min→2min
  - `src/hooks/useContractAIInsights.ts` — .limit(200) em fetchAIOverview, .limit(500) em fetchPortfolioInsights
  - `src/hooks/useContractSignatureEnvelopes.ts` — refetchInterval 2min→5min, staleTime 1min→2min
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)

## Mapeamento de Componentes — CLM (44 componentes)
- **Contratos**: ContractFormDialog, ContractDetailDialog (hub principal com lazy tabs), NewContractChoiceDialog, ImportMethodChoiceDialog
- **IA**: PricingAIDialog, AIContractImportDialog, AIInsightsPanel, ClauseExtractor, LegalChatbot, MarketIntelligenceDialog
- **Workflow**: ApprovalWorkflowPanel, ApprovalRulesManager, PendingApprovalsWidget
- **Financeiro**: ContractInstallments, InstallmentManager, DelinquencyDashboard, TerminationCalcDialog, GuaranteeReleaseDialog
- **Partes/Versões**: ContractPartiesManager, ContractVersionHistory
- **Relatórios/Dashboard**: ReportsPanel, ContractPipelineChart, CommandCenterKPIs, CommandCenterFilters, ColumnSelector
- **Renovação**: ContractRenewalTab, RenovacaoRealizadaDialog
- **Onboarding**: CLMOnboardingChecklist, CLMOnboardingTour, CLMEmptyStates
- **Configuração**: CLMSettingsDialog, TemplatesManager, ContractDraftDialog, ContractDraftWizard
- **Tabs do detalhe** (dentro de `tabs/`): ContractPricingTab, ContractApprovalsTab, ContractAuditTab, ContractDocumentsTab, ContractLifecycleTab, ContractNegotiationTab, ContractObligationsTab, ContractRedliningTab, ContractSignaturesTab

## Notas Técnicas

### Arquitetura geral
- **Stack**: React 18 + Vite + TypeScript + shadcn-ui + Tailwind CSS + Supabase + TanStack Query
- **Total**: 489 arquivos TS/TSX, 55 Edge Functions, 45 componentes de contratos
- **IA**: OpenRouter → Gemini 2.0 Flash (todas EFs de IA exceto pricing-ai que usa OpenAI GPT-4o-mini direto)
- **Deploy**: Vercel (frontend) + Supabase (backend, Edge Functions, Realtime, Auth)

### Pricing-AI (v24r8 — Dual actor + Property type filter + TX boundary + two-pass + safe fallback + OpenAI)
- **2 actors Apify** (scraping paralelo via `Promise.allSettled()`):
  - Actor VivaReal (`f1xSvpkpklEh2EhGJ`): URL-based input — `/{txSlug}/{uf}/{cidade}/bairros/{bairro}/{tipoSlug}/` (v24r8: tipo de imóvel dinâmico no path)
  - Actor ZapImóveis (`avorio~zap-imoveis-scraper`): URL-based input — `/{txSlug}/{tipoSlug}/{uf}+{cidade}++{bairroSlug}/` com abbreviações (Vila→vl, Jardim→jd, etc.)
  - ZapImóveis tem error handling gracioso — se actor falha, retorna [] e usa só VivaReal
- **Property type filter (v24r8)**:
  - `VIVAREAL_TYPE_SLUGS`: apartamento→apartamento_residencial, casa→casa_residencial, terreno→lote-terreno_residencial, etc.
  - `ZAP_TYPE_SLUGS`: apartamento→apartamentos, casa→casas, terreno→terrenos-lotes-e-areas, etc.
  - `PROPERTY_TYPE_COMPAT`: Grupos de compatibilidade (ex: apartamento = [apartment, flat, kitnet, studio, loft, cobertura, etc.])
  - `applyPropertyTypeFilter()`: 3 métodos de matching (URL, campo propertyType, título). Safety net: se remove tudo, mantém original
  - Pipeline: TX → PropertyType → Geo (property type filter nunca relaxado, mesmo boundary que TX)
  - Fallback: Se property_type não está na tabela, VivaReal sem sufixo e ZapImóveis usa `imoveis` (genérico)
- **Timeout**: 180s polling. Frontend timeout: 200s
- **Filtro de área**: ±70% (minArea = area×0.3, maxArea = area×1.7)
- **Post-processing filters** (v24r2):
  - **contract_type mapping**: `locacao`, `administracao`, `rental`, `lease`, `aluguel`, `locação` → `isRental=true`
  - **Transaction type sanity**: Rental R$200-50k, Sale R$30k-50M (remove preços incompatíveis)
  - **City/neighborhood filter**: Normaliza strings (NFD, lowercase), substring match, tier system (bairro>cidade>estado)
  - **Confidence penalty**: state tier=-30, city tier=-10
- **Stats**: avg/median price per sqm, suggested value = mediana×área, range ±15%
- **AI Analysis**: OpenAI GPT-4o-mini (com fallback para análise local se sem API key)
- **Confidence**: Baseada em sample size (>=10: 80%, >=5: 65%, >=3: 55%, <3: 35%) + penalty por tier
- **Custos**: ~$0.05-0.15 Apify + ~$0.001-0.005 OpenAI por análise
- **Auto-persist**: Edge Function persiste em `pricing_analyses` (fire-and-forget). Frontend também persiste via `usePricingAI.ts`
- **Tabela `pricing_analyses`**: `suggested_price`, `top_comparables` (JSON array com URLs), `ai_analysis` (markdown), `sources`, `confidence`
- **Ações**: `analyze`/`pricing` (principal), `market_overview`
- **Two-pass strategy (v24r4+)**: Pass 1 com bairro, se < 3 resultados válidos → Pass 2 com cidade-only. Merge com deduplicação por URL
- **Safe fallback (v24r5)**: Relaxamento progressivo APENAS do geo filter (city→state). TX filter é boundary absoluto — NUNCA relaxado. Se 0 listings após TX filter → retorna erro claro com diagnostic info
- **Last-resort (v24r5)**: Usa `txFiltered` (não `allListings`) — mantém separação venda/locação mesmo no fallback
- **Comparable selection (v24r7)**: `selectBalancedComparables()` — round-robin por fonte (quota igual por plataforma). Source tagging via `_source_tag` antes da normalização
- **Response extras**: `geo_stats` (raw_vivareal/raw_zap/pass2_done/normalized/after_tx_filter/after_pt_filter/pt_filter_applied/pt_filter_removed/property_type_used/neighborhood_matches/city_matches/final/city_distribution/source_distribution), `top_comparables`

### Segurança
- **DOMPurify** (`src/lib/sanitizeHtml.ts`): SEMPRE sanitizar HTML gerado por IA antes de `dangerouslySetInnerHTML`
  - `markdownToSafeHtml()` — para markdown (insights, pricing analysis) → tags: h2, h3, strong, em, br, li, ul, ol, p, span
  - `sanitizeContractHtml()` — para HTML de contratos (minutas) → tags: headings, p, br, hr, table, ul/ol, a, div, span, etc.
  - Aplicado em 4 componentes: PricingAIDialog, ContractPricingTab, ContractDraftDialog, ContractDraftWizard

### Padrões do codebase
- **`profiles.id` ≠ `auth.users.id`**: CRÍTICO — `session.user.id` retorna o UUID de `auth.users`. Para buscar na tabela `profiles`, SEMPRE usar `.eq("user_id", userId)` (FK para auth.users), NUNCA `.eq("id", userId)` (PK própria da tabela profiles). Bug da sessão 34.
- **`.maybeSingle()`**: SEMPRE usar em vez de `.single()` quando o registro pode não existir (previne crash PGRST116)
- **ScrollArea do shadcn**: Não funciona bem em containers flex sem altura explícita → usar `overflow-y-auto` com `min-h-0` nativo
- **Lazy loading**: `ContractDetailDialog` usa `lazy()` para todas as tabs → melhor performance
- **Dados de demo**: UUIDs como `a0000000-*`, `c0000000-*` (seed data)
- **RLS**: Tabela `contracts` usa políticas PERMISSIVE (alterado na sessão 5, antes era RESTRICTIVE que bloqueava tudo)
- **NUNCA misturar dynamic/static imports**: Se um módulo (ex: `tenantUtils.ts`) é importado estaticamente por muitos arquivos, NUNCA usar `await import()` dinâmico para o mesmo módulo em outros arquivos. Causa TDZ error no bundle Vite/Rollup (tela branca em produção). Bug da sessão 50.
- **RLS PERMISSIVE vs RESTRICTIVE**: Em PostgreSQL RLS, RESTRICTIVE policies SÓ funcionam em conjunto com PERMISSIVE policies. Se uma tabela tem ZERO PERMISSIVE policies para uma operação (SELECT/INSERT/etc.), nenhuma row será visível. Funções SECURITY DEFINER (como `has_role()`) bypassam RLS — o que pode mascarar o problema. Bug da sessão 65 (`user_roles` table).
- **CORS whitelist em Edge Functions**: Domínio `app.intentusrealestate.com.br` DEVE estar em `PROD_ORIGINS` de toda Edge Function com CORS whitelist. Fix massivo na sessão 65 (11+ EFs).

### Sistema de Notificações (✅ funcional — sessão 25)
- Hook: `useNotifications.ts` (~330 linhas) — 7 categorias: sistema, contrato, cobrança, aprovação, vencimento, alerta, ia
- Realtime: Supabase channel no INSERT da tabela `notifications` + toast visual via sonner
- Utility: `createNotification()` — chamado em 10 componentes CLM (fire-and-forget via supabase.auth.getUser().then)
- UI: `NotificationCenter.tsx` (348 linhas) — popover com filtros, ícones, ações, navegação por referenceType
- Preferências: `NotificationPreferences.tsx` — seed automático de 7 categorias no primeiro acesso, toggles in-app/email, frequência
- Navegação: `getNotificationLink()` suporta 8 reference types (contract, installment, approval, template, renewal, pricing, insight, draft)
- Pendente futuro: email digest (Resend), pg_cron triggers para vencimentos, IA generativa para mensagens

### Sistema de Onboarding (existente, parcial)
- Hook: `useOnboardingProgress.ts` — 8 steps, dual persist (Supabase `user_onboarding_progress` + localStorage)
- `checkAutoComplete(actionType)` existe mas NÃO é chamado em nenhum lugar → P0 do plano
- Widget: `CLMOnboardingChecklist.tsx` (227 linhas) — gradient Intentus (#1A1A2E→#2D2D4E, gold #e2a93b)
- Tour: `CLMOnboardingTour.tsx` existe, mas não ativa no primeiro acesso
- Faltam: auto-complete wiring, tour de 1º acesso, demo mode (ver `docs/plano-onboarding-demo-flow.md`)

### Provedores de Assinatura
- Config: `signatureProvidersDefaults.ts` — 5 provedores tipados: ClickSign, DocuSign, D4Sign, Registro de Imóveis, gov.br
- Proxy: `signature-proxy` Edge Function (212 linhas)
- Status: NENHUM com integração funcional. ClickSign tem MVP plan documentado (~8-12h, ver `docs/clicksign-pendencia-lancamento.md`)

## Documentação Técnica (pasta `/docs`)
- `pricing-ai-multi-platform-analysis.md` — Diagnóstico e plano de ação para multi-plataforma
- `clicksign-pendencia-lancamento.md` — Pendência ClickSign com API reference
- `plano-onboarding-demo-flow.md` — Plano de onboarding/demo em 5 etapas
- `plano-notificacoes-ia.md` — Plano de notificações automáticas com IA
- `plano-integracao-urbit.md` — Plano de integração com Urbit API
- `auditoria-clm-pendencias.md` — Auditoria de pendências do CLM
- `plano-ui-ux-clm-melhorias.md` — Plano de melhorias UI/UX para CLM (sessão 28, aguardando aprovação)
- `auditoria-clm-completa-claude-minimax.docx` — Relatório completo da auditoria CLM com pair programming Claude + MiniMax (sessões 30-31, 28 achados, plano de ação)
- `auditoria-clm-sessao34-claude-minimax.docx` — Auditoria CLM profunda sessão 34 (35 achados: 10 críticos, 11 warnings, 5 info, 9 melhorias estruturais, plano 5 fases ~44h)
- `diagnostico-comercial-sessao39-claude-minimax.docx` — Diagnóstico completo do módulo Comercial sessão 39 (27 achados: 8 CRITICAL, 7 HIGH, 9 MEDIUM, 3 LOW. Plano 4 fases ~32h)
- `varredura-benchmarking-clm-sessao41.docx` — Varredura CLM profunda (82+ arquivos) + Benchmarking vs 7 líderes de mercado (Icertis, Ironclad, Agiloft, DocuSign CLM, CobbleStone, Sirion, LinkSquares). 2 true CRITICAL, gap analysis, roadmap 3 horizontes
- `plano-estrategico-ia-native-sessao47.docx` — Plano estratégico IA-native completo (sessão 47). 20 funcionalidades novas, 5 categorias de integrações, 8 melhorias, 3 killer features, roadmap 3 horizontes (24 itens), arquitetura técnica 3 camadas, 12 KPIs
- `cronograma-ia-native-sessao52.xlsx` — Cronograma de execução do plano IA-native (sessão 52). 20 itens, 5 fases, ~254h, ~18 semanas. CLM→CRM→Integrações

## Pendências Estratégicas

| Pendência | Estimativa | Prioridade | Status | Doc |
|-----------|-----------|------------|--------|-----|
| **Onboarding auto-complete + tour** | ~12h (5 etapas) | P0 | ✅ Etapas 1-3 concluídas: checkAutoComplete wired em 6 componentes, CLMOnboardingChecklist renderizado em Contracts.tsx, tour ativo no 1º acesso. Pendente: demo mode, empty states | `plano-onboarding-demo-flow.md` |
| **Notificações automáticas + IA** | ~19h (5 etapas) | P0/P1 | ✅ Etapas 1-4 concluídas: 10 triggers em CLM, NotificationCenter ativo, seed automático, toast realtime. Pendente: email digest (Resend), pg_cron triggers, IA generativa | `plano-notificacoes-ia.md` |
| **Pricing-ai v24r8 (property type filter)** | ~3h | P1 | ✅ CONCLUÍDO — v24r8 deployada (version 41). Filtro por tipo de imóvel na URL + post-processing. Mapeamento Intentus→VivaReal/ZapImóveis slugs. Dual actor, round-robin | `pricing-ai-multi-platform-analysis.md` |
| **ClickSign integração** | ~8-12h | P2 | Tipos prontos, NÃO é blocker para lançamento | `clicksign-pendencia-lancamento.md` |
| **Outros provedores assinatura** | — | P3 | DocuSign, D4Sign, Registro de Imóveis, gov.br — tipados, não funcionais | — |
| **CLM APIs (contract/approvals/obligations/templates)** | ~8h | P1 | ✅ CONCLUÍDO (sessão 26) — 4 Edge Functions criadas e deployadas: clm-contract-api v7, clm-approvals-api v6, clm-obligations-api v5, clm-templates-api v2 | — |
| **Multi-tenant security audit** | ~4h | P0 | ✅ CONCLUÍDO (sessão 28) — 16 issues encontradas, 10 code fixes aplicados (4 EFs, RLS, 2 frontend) | — |
| **Plugin MiniMax M2.7** | ~3h | P1 | ✅ FUNCIONAL — v0.4.0 (upgrade M2.5→M2.7, sessão 90). 6 tools operacionais. M2.7 lançado 18/03/2026 | — |
| **UI/UX CLM melhorias** | ~8-12h | P1 | 📋 PLANO CRIADO (sessão 28) — Aguardando aprovação de Marcelo | `plano-ui-ux-clm-melhorias.md` |
| **Auditoria CLM completa (Claude+MiniMax)** | ~8h | P0 | ✅ CONCLUÍDO (sessões 30-31) — 28 achados, relatório .docx entregue. Próximo passo: executar plano de ação (4 fases, ~19h) | `auditoria-clm-completa-claude-minimax.docx` |
| **Fixes da auditoria CLM (plano de ação)** | ~19h (4 fases) | P0/P1 | ✅ CONCLUÍDO — 4 fases completas (sessões 32-33). Fase 1: Segurança, Fase 2: Arquitetura, Fase 3: UX/Nav, Fase 4: Qualidade. 28 achados resolvidos | `auditoria-clm-completa-claude-minimax.docx` |
| **Auditoria CLM sessão 34 (Claude+MiniMax)** | ~8h | P0 | ✅ CONCLUÍDO (sessão 34) — 35 achados (10 críticos, 11 warnings, 5 info, 9 melhorias). Fix bug Command Center (user_id). 4 EFs re-deployadas. Plano de ação 5 fases (~44h) | `auditoria-clm-sessao34-claude-minimax.docx` |
| **Fixes auditoria sessão 34 (5 fases)** | ~44h (5 fases) | P0/P1 | ✅ TODAS AS 5 FASES CONCLUÍDAS. Fase 1 (sessão 35, ~6h): Segurança. Fase 2 (sessão 36, ~8h): Arquitetura. Fase 3 (sessão 37, ~4h): UX+Qualidade. Fase 4 (sessão 38, ~6h): State Machine Enterprise. Fase 5 (sessão 40, ~6h): RBAC Granular — 22 actions × 7 roles, 3 layers defense-in-depth, 4 EFs deployadas, 5 componentes com UI guards | `auditoria-clm-sessao34-claude-minimax.docx` |
| **Diagnóstico Módulo Comercial** | ~8h diagnóstico | P0 | ✅ CONCLUÍDO (sessão 39) — 27 achados (8 CRITICAL, 7 HIGH, 9 MEDIUM, 3 LOW). 40+ arquivos. Pair programming Claudinho+Buchecha. Relatório .docx entregue. | `diagnostico-comercial-sessao39-claude-minimax.docx` |
| **Fixes Módulo Comercial (4 fases)** | ~32h (4 fases) | P0/P1 | ✅ TODAS AS 4 FASES CONCLUÍDAS (sessões 42-45). Fase 1 (Segurança): credenciais hardcoded removidas, tenant_id em 7 hooks, CORS whitelist 3 EFs, shared AI helpers. Fase 2 (Bugs): mock progress fix, DealMessages fix, status "fechado"→"concluido", Kanban dedup, EFs migradas Lovable→OpenRouter. Fase 3 (Arquitetura): server-side dashboard EF, useMyGoals batch queries, useDealAttachments auth dedup. Fase 4 (Qualidade): deal:any→DealRequest em 6 arquivos, navigate:any→typed. Build 0 erros. MiniMax pair programming (Claudinho+Buchecha) | `diagnostico-comercial-sessao39-claude-minimax.docx` |
| **Varredura CLM + Benchmarking (Sessão 41)** | ~8h diagnóstico | P0 | ✅ CONCLUÍDO (sessão 41) — 82+ arquivos auditados. 2 true CRITICAL (XSS AI output + mock data), 12 tenant_id gaps (mitigados por RLS), 7 N+1 queries. Benchmarking vs 7 líderes. Relatório .docx | `varredura-benchmarking-clm-sessao41.docx` |
| **TS-02: Atualizar tipos gerados Supabase** | ~4h | P2 | 📋 PENDENTE (sessão 45) — Requer `supabase gen types` CLI. Afeta 26+ arquivos com `as unknown as`. Melhoria codebase-wide, não localizada. Deferido da Fase 4 Comercial | — |
| **Fix XSS em useContractAI.ts** | ~1h | P0 | ✅ CONCLUÍDO (verificado sessão 48 — já implementado: 6 sanitization helpers em todos os hooks, DOMPurify aplicado em todos os outputs de IA) | — |
| **Fix mock data em useContractAIInsights.ts** | ~1h | P0 | ✅ CONCLUÍDO (verificado sessão 48 — já implementado: isSimulated flag + banner amber no PortfolioOverview + badge "⚠ Simulado" no ContractAnalysisPanel) | — |
| **E-signature nativa (ClickSign/D4Sign)** | ~8-12h | P1 | 📋 GAP IDENTIFICADO (sessão 41) — Todos os líderes CLM têm, Intentus tem proxy sem integração | `clicksign-pendencia-lancamento.md` |
| **Obligation auto-extraction via IA** | ~12h | P1 | ✅ CONCLUÍDO (sessão 51) — parse-contract-ai v10, ObligationPreviewPanel, 2 fluxos (importação + standalone), batch save | — |
| **Contract versioning com diff visual** | ~8h | P2 | ✅ CONCLUÍDO (sessão 51) — diffUtils.ts, VersionComparisonDialog (side-by-side + inline toggle), ContractVersionHistory compare, RedliningTab inline diff | — |
| **TS-02: Supabase generated types** | ~4h | P2 | 📋 PENDENTE — `supabase gen types` CLI, afeta 26+ arquivos. Melhoria codebase-wide | — |
| **Benchmarking CRM Comercial (Sessão 46)** | ~8h pesquisa | P0 | ✅ CONCLUÍDO (sessão 46) — 47 features × 5 plataformas. Relatório .docx entregue | `benchmarking-crm-sessao46.docx` |
| **CRM: Backend de automações** | ~20h | P0 | ✅ CONCLUÍDO (sessão 74) — commercial-automation-engine v2, 12 triggers, 8 ações, JSONB conditions, sequências multi-step | — |
| **CRM: Lead scoring automático** | ~12h | P1 | ✅ CONCLUÍDO (sessão 77) — commercial-lead-scoring v1, 8 fatores + AI boost, dashboard + batch scoring | — |
| **CRM: WhatsApp Business API** | ~16h | P1 | 📋 GAP (sessão 46) — Kenlo, Sell.Do, HubSpot têm. Canal #1 no Brasil | — |
| **CRM: Integração portais BR** | ~20h | P1 | 📋 GAP (sessão 46) — Kenlo integra ZapImóveis/VivaReal/OLX nativamente | — |
| **CRM: Mobile app** | ~40h | P2 | 📋 GAP (sessão 46) — Todos os concorrentes têm app nativo. Intentus só web | — |
| **Plano Estratégico IA-Native** | ~8h pesquisa | P0 | ✅ CONCLUÍDO (sessão 47) — Plano completo: 20 features novas, 5 cat. integrações, 8 melhorias, 3 killer features. Roadmap 24 itens. Relatório .docx | `plano-estrategico-ia-native-sessao47.docx` |
| **Varredura CLM pré-F3 (browser freeze + bugs)** | ~6h | P0 | ✅ CONCLUÍDO (sessão 64) — 8 fixes total: useContractKPIs reescrito, Contracts.tsx hook order, RealTimeAlerts props-based, prediction widgets lazy load, memoização alerts, AIInsightsPanel lazy loaded, refetchInterval normalizado 5min, .limit() em queries AI. Build 0 erros | — |
| **Fix produção CORS + RLS** | ~4h | P0 | ✅ CONCLUÍDO (sessão 65) — CORS: 11+ EFs re-deployadas com `app.intentusrealestate.com.br`. RLS: `user_roles` SELECT policies convertidas RESTRICTIVE→PERMISSIVE (3 novas policies). Command Center + /contratos verificados em produção | — |
| **Fix /contratos/ + /analytics + sidebar** | ~4h | P0 | ✅ CONCLUÍDO (sessão 66) — useContracts `.limit(200)` + staleTime, ContractAnalytics 4 queries com tenant_id + limits + Map O(n+m), filterByRole superadmin bypass, useTablePreferences user.id queryKey. Build 0 erros. Pair Claudinho+Buchecha | — |
| **Fix /analytics freeze persistente** | ~4h | P0 | ✅ CONCLUÍDO (sessões 67+68+69) — Sessão 67: revenueLeakage Map, staleTime, pre-computed Maps. Sessão 68: useContractsAnalytics lightweight (11 cols, 0 JOINs), lazy heatmap, useDrillDownContracts on-demand, Promise.all chunks. Sessão 69: numeric string parsing (Supabase numeric→Number()), error state UI. Build 0 erros. Pair Claudinho+Buchecha | — |
| **Rewrite ClmAnalytics do zero** | ~6h | P0 | ✅ CONCLUÍDO (sessão 70) — ContractAnalytics.tsx deletado (~1010 linhas). useAnalyticsMetrics.ts (540 linhas, 6 data hooks + 11 computed metrics). ClmAnalytics.tsx (480 linhas, 11 métricas). Map-based O(n), lazy heatmap, drill-down on-demand, Number() parsing. Build 0 erros. Pair Claudinho+Buchecha | — |
| **Verificação CLM completa pré-F3** | ~4h | P0 | ✅ CONCLUÍDO (sessão 72) — 19 bugs encontrados e fixados: React Error #310 (useClmSettings useMemo), 6 tenant_id leaks (3 hooks), unbounded bulk ops (MAX_BATCH_SIZE=50), 4 caching issues, 1 UI bug. 9 arquivos. Build 0 erros. Pair Claudinho+Buchecha | — |
| **Copilot CORS fix** | ~0.5h | P1 | ⚠️ PENDENTE (sessão 65) — copilot v11 precisa de `app.intentusrealestate.com.br` no CORS. Deploy manual via Dashboard (48KB excede MCP) | — |
| **CORS cleanup (clm-seed-demo + contract-draft-ai)** | ~1h | P3 | 📋 PENDENTE (sessão 65) — Ainda com CORS wildcard `*`. Melhoria de segurança, não blocker | — |
| **RLS user_roles INSERT/UPDATE/DELETE** | ~1h | P3 | 📋 PENDENTE (sessão 65) — Policies de escrita ainda ALL RESTRICTIVE sem PERMISSIVE. Afeta apenas operações admin | — |
| **Verificação CLM pré-F3 (sessão 72)** | ~4h | P0 | ✅ CONCLUÍDO (sessão 72) — 19 bugs: 1 CRITICAL (React #310 useClmSettings), 6 CRITICAL (tenant_id leaks em 3 hooks), 1 HIGH (unbounded bulk ops), 4 MEDIUM (caching), 1 LOW (UI). 9 arquivos fixados. Build 0 erros. Pair Claudinho+Buchecha | — |
| **Cronograma IA-Native (Execução)** | ~254h CLM + ~514h CRM | P0 | 🔄 EM ANDAMENTO — **CLM F1 COMPLETA (5/5 ✅)**, **CLM F2 COMPLETA (5/5 ✅)**. Verificação completa (sessão 72, 19 bugs fixados). **CRM F1 COMPLETA (13/13 ✅)** (A01 Engine Automação, A02 Multi-Funil, A02 Templates, P03 Pulse/Feed, P04 Lead Scoring IA, P05 Stalled Deals, L05 Distribuição Leads, P02 Cards Customizáveis, P06 Pipeline Analytics, G01 Metas Inteligentes, L03 Chatbot IA Leads, I05 Assistente IA Corretores, L02 Captação Multi-Canal). **CRM F2 COMPLETA (11/11 ✅)** (A03 Workflow Visual Builder, I07 Win/Loss Analysis, I06 ROI por Canal, E02 Exclusividades IA, E01 Calendário Visitas Avançado, I03 Relatórios IA Narrativa, I04 Forecast Receita, I01 AI Sales Assistant, I02 Matching Imóvel-Cliente, C04 Conversation Intelligence, C01 Email CRM). Próximo: **F3 Item #1 (CRM Captação & Engajamento)** | `cronograma-ia-native-sessao52.xlsx`, `docs/plano-crm-ia-native-sessao73.docx` |
