# Auditoria CLM — Pendências Identificadas

**Data da auditoria**: 10/03/2026 (Sessão 24)
**Build TypeScript**: ✅ 0 erros
**Total de arquivos**: 489 TS/TSX, 55 Edge Functions, 45 componentes CLM

---

## 🔴 P0 — Onboarding NÃO está wired

**Status**: Infraestrutura 80% pronta, 0% conectada

### O que existe (funciona):
- Hook `useOnboardingProgress.ts` com 8 steps definidos e dual persist (Supabase + localStorage)
- Função `checkAutoComplete(actionType)` mapeando 8 ações para steps
- Componente `CLMOnboardingChecklist.tsx` (227 linhas) com UI completa, gradient Intentus, progress bar
- Componente `CLMOnboardingTour.tsx` (200+ linhas) com tour em 8 etapas, navegação por setas
- Persistência em `user_onboarding_progress` (Supabase) + fallback localStorage

### O que falta:
1. **`CLMOnboardingChecklist` não é renderizado em nenhuma página** — precisa importar na página de Contratos
2. **`CLMOnboardingTour` não é renderizado em nenhum lugar** — precisa lançar no primeiro acesso
3. **`checkAutoComplete()` nunca é chamado** — precisa wiring em 8 componentes:

| Ação | `actionType` | Componente onde chamar |
|------|-------------|----------------------|
| Criar contrato | `contract_created` | `ContractFormDialog.tsx` (no onSuccess do form) |
| Configurar template | `template_created` | `TemplatesManager.tsx` (após salvar template) |
| Importar contrato | `contract_imported` | `AIContractImportDialog.tsx` (após importação OK) |
| Rodar análise IA | `ai_analysis_run` | `PricingAIDialog.tsx` ou `AIInsightsPanel.tsx` (após resultado) |
| Configurar aprovações | `approval_configured` | `ApprovalRulesManager.tsx` (após salvar regras) |
| Ver relatórios | `report_viewed` | `ContractAnalytics.tsx` (no mount/primeira vez) |
| Usar chatbot | `chatbot_used` | `LegalChatbot.tsx` (após primeira mensagem) |
| Ver dashboard | `dashboard_viewed` | `ClmCommandCenter.tsx` (no mount/primeira vez) |

### Estimativa: ~12h (5 etapas)
### Documento detalhado: `docs/plano-onboarding-demo-flow.md`

---

## 🔴 P0/P1 — Notificações automáticas sem triggers

**Status**: Infraestrutura 100% pronta, triggers 5% implementados

### O que existe (funciona):
- Hook `useNotifications.ts` (307 linhas) — CRUD completo, 7 categorias, realtime via Supabase channel
- Função `createNotification({userId, title, message, category, referenceType, referenceId})` — pronta e funcional
- Preferências por categoria × role (email/in-app, frequency immediate/daily/weekly)
- UI de notificações (bell icon, dropdown, mark as read)

### O que falta:
- `createNotification()` é chamado em **apenas 1 lugar** (`useDealRequests.ts` — deal movement)
- **0 triggers no CLM** — nenhum evento do módulo de contratos gera notificação:

| Evento | Categoria sugerida | Trigger necessário |
|--------|-------------------|-------------------|
| Contrato expirando em X dias | `vencimento` | Cron/scheduled job ou check no login |
| Aprovação pendente | `aprovacao` | Após criar solicitação de aprovação |
| Aprovação concedida/rejeitada | `aprovacao` | Após approve/reject no workflow |
| Obrigação vencida | `alerta` | Cron/scheduled ou check periódico |
| Contrato importado com sucesso | `contrato` | Após parse-contract-ai retornar |
| Análise de preço concluída | `ia` | Após pricing-ai retornar resultado |
| Assinatura recebida | `contrato` | Futuro — após integração de assinatura |
| Cobrança em atraso | `cobranca` | Check em installments vencidas |

### Estimativa: ~19h (5 etapas)
### Documento detalhado: `docs/plano-notificacoes-ia.md`

---

## 🟡 P1 — 4 CLM Edge Functions inexistentes

**Status**: Frontend wired, backend NÃO existe

### Situação:
O arquivo `src/lib/clmApi.ts` (340 linhas) define 15+ funções que chamam 4 Edge Functions que **não existem** no repositório:

| Edge Function | Funções do frontend que chamam | Existe? |
|---------------|-------------------------------|---------|
| `clm-contract-api` | `fetchClmDashboard()`, `transitionContractStatus()` | ❌ NÃO |
| `clm-approvals-api` | `fetchPendingApprovals()`, `fetchApprovalHistory()`, `approveItem()`, `rejectItem()`, `delegateApproval()` | ❌ NÃO |
| `clm-obligations-api` | `fetchObligationsDashboard()`, `fetchOverdueObligations()`, `fetchUpcomingObligations()`, `batchCreateObligations()` | ❌ NÃO |
| `clm-templates-api` | `fetchTemplates()`, `renderTemplate()` | ❌ NÃO |

### Impacto:
- **Command Center** (`ClmCommandCenter.tsx`) — **NÃO FUNCIONA** (depende das 3 primeiras APIs)
- **`useClmLifecycle.ts`** — Transições de status e aprovações via API **NÃO FUNCIONAM**
- **Aba Lifecycle** — Importa constantes de `clmApi.ts` (funciona parcial, só labels/cores)

### Impacto NÃO afeta:
- **Hooks diretos** funcionam normalmente (acessam Supabase direto, sem Edge Function):
  - `useContractApprovals.ts` — CRUD de aprovações via `supabase.from("contract_approvals")` ✅
  - `useContractObligations.ts` — CRUD de obrigações via `supabase.from("contract_obligations")` ✅
  - `useContractTemplates.ts` — Templates via Supabase direto ✅
- **Todas as 9 tabs do contrato** funcionam ✅
- **ContractFormDialog, PricingAIDialog, AIContractImportDialog** funcionam ✅

### Opções de resolução:
1. **Criar as 4 Edge Functions** (~16-24h) — implementar lógica de dashboard consolidado, transições de status com validação, workflow de aprovação avançado, e rendering de templates
2. **Refatorar o Command Center para usar Supabase direto** (~8-12h) — como os hooks já funcionam direto no Supabase, podemos reescrever o Command Center sem Edge Functions
3. **Desabilitar o Command Center temporariamente** (~1h) — esconder o menu/rota até implementar

### Recomendação: Opção 2 (refatorar para Supabase direto) — mais simples e consistente com o padrão dos outros hooks

---

## 🟡 P2 — Assinatura digital: 0/5 provedores funcionais

**Status**: Tipado e configurado, nenhuma integração real

### O que existe:
- `signatureProvidersDefaults.ts` — 5 provedores tipados (ClickSign, DocuSign, D4Sign, Registro de Imóveis, Gov.br)
- `signature-proxy` Edge Function (212 linhas) — roteador que só tem implementação "manual" (sem provider real)
- Tab de assinaturas no detalhe do contrato (`ContractSignaturesTab.tsx`)
- Botão "Enviar Lembrete" — **stub vazio** (`// TODO: Integração real com Clicksign`)

### O que falta:
- Integração real com qualquer provedor de assinatura
- ClickSign tem MVP documentado (~8-12h, ver `docs/clicksign-pendencia-lancamento.md`)
- **NÃO é blocker para lançamento** — workaround manual funciona

---

## 🟢 P2 — pricing-ai em standby

**Status**: v24r8 (version 42) com erros non-2xx. Aguardando alternativa Urbit API.

- **Plano**: `docs/plano-integracao-urbit.md`
- **Próximo passo**: Marcelo negociando credenciais/pricing com Urbit
- **Estimativa pós-credenciais**: ~8-12h de implementação

---

## 📋 Resumo Consolidado

| # | Pendência | Prioridade | Estimativa | Blocker? | Doc |
|---|-----------|-----------|-----------|----------|-----|
| 1 | Onboarding wiring (checklist + tour + auto-complete) | 🔴 P0 | ~12h | Sim — UX de primeiro uso | `plano-onboarding-demo-flow.md` |
| 2 | Notificações automáticas (triggers CLM) | 🔴 P0/P1 | ~19h | Sim — sem alertas proativos | `plano-notificacoes-ia.md` |
| 3 | Command Center / CLM APIs (4 EFs inexistentes) | 🟡 P1 | ~8-24h | Parcial — CC não funciona | — |
| 4 | Assinatura digital (ClickSign MVP) | 🟡 P2 | ~8-12h | Não — workaround manual | `clicksign-pendencia-lancamento.md` |
| 5 | pricing-ai (alternativa Urbit) | 🟢 P2 | ~8-12h | Não — aguardando comercial | `plano-integracao-urbit.md` |
| **Total** | | | **~55-79h** | | |

---

## 🏆 O que FUNCIONA bem

Para registro — o que está sólido no CLM:

- ✅ **Build**: 0 erros TypeScript
- ✅ **CRUD de contratos**: Criar, editar, listar, filtrar, buscar
- ✅ **9 tabs do detalhe**: Pricing, Approvals, Audit, Documents, Lifecycle, Negotiation, Obligations, Redlining, Signatures
- ✅ **Parse de contratos PDF**: `parse-contract-ai` v9 (Gemini 2.0 Flash)
- ✅ **Geração de minutas**: `contract-draft-ai` v5 (auditada, XSS sanitizado)
- ✅ **Extração de cláusulas**: `extract-clauses-ai` v4 (auditada)
- ✅ **Copilot IA**: `copilot` v9 (streaming, Gemini via OpenRouter)
- ✅ **CLM AI Insights**: `clm-ai-insights` v6 (health score)
- ✅ **Segurança XSS**: DOMPurify aplicado em 4 componentes
- ✅ **RLS**: Políticas PERMISSIVE na tabela contracts
- ✅ **Hooks de aprovações/obrigações**: Funcionam direto no Supabase
- ✅ **Renovações**: Tab funcional com dialog de renovação realizada
- ✅ **Parcelas/Financeiro**: InstallmentManager, DelinquencyDashboard
