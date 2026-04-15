# Sessão 7 — Auditoria completa + novas features + segurança

- Confirmado: pricing-ai v25 funcionando (trazendo dados de locação)
- Auditoria de todas as Edge Functions de IA (7 functions verificadas)
- **Nova tabela**: `pricing_analyses` (migration via Supabase MCP) — persiste histórico de análises
- **Novo componente**: `ContractPricingTab.tsx` — aba "Precificação IA" no detalhe do contrato com histórico
- **Auto-persist**: `usePricingAI.ts` agora salva automaticamente no banco (fire-and-forget)
- **Segurança XSS**: Criado `src/lib/sanitizeHtml.ts` com DOMPurify
  - `markdownToSafeHtml()` — para markdown de IA (insights, pricing analysis)
  - `sanitizeContractHtml()` — para HTML de contratos gerados
  - Aplicado em 4 componentes: PricingAIDialog, ContractPricingTab, ContractDraftDialog, ContractDraftWizard
- **Bug fixes**:
  - `.single()` → `.maybeSingle()` em ApprovalWorkflowPanel e RenovacaoRealizadaDialog (previne crash quando nenhum registro existe)
