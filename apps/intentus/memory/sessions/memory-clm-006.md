# Sessão 6 — Pricing-ai rental fix + UI

- **Problema**: contratos de locação mostravam preços de venda
- **Causa**: frontend não enviava `contract_type` ao Edge Function
- **Fix (v25)**: frontend passa `contract_type` → EF resolve `transactionType=rent|sale` → Apify busca correto
- Arquivos alterados:
  - `src/components/contracts/PricingAIDialog.tsx` — prop `contractType`
  - `src/hooks/usePricingAI.ts` — param `contract_type`
  - `src/components/contracts/ContractRenewalTab.tsx` — passa `contractType`
- UI fixes:
  - `src/pages/ContractAnalytics.tsx` — scroll interno no dialog AI Analysis (ScrollArea→overflow-y-auto)
  - `src/components/AICopilot.tsx` — header compacto + scroll nas mensagens
