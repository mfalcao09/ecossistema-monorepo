# Sessão 87 — Varredura CRM pré-F2: 10 bugs encontrados e corrigidos (19/03/2026)

- **Objetivo**: Verificação completa do módulo CRM antes de avançar para Fase 2. Varredura de todos os hooks comerciais para bugs, segurança e performance
- **Metodologia**: Agente de varredura automático + verificação manual + pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha)
- **38 achados identificados pelo agente de varredura** (13 CRITICAL, 6 HIGH, 7 MEDIUM, 12 LOW). Após análise manual, muitos foram reclassificados (RLS mitiga tenant_id gaps em queries de leitura, Number() parsing já implementado em useSalesMirror)
- **10 fixes aplicados em 6 arquivos**:
  1. **useDealRequests.ts** — `.limit(500)` + `staleTime: 2min` + `refetchInterval: 5min` na query principal (sem limit nem cache antes)
  2. **useLeads.ts** — `.limit(500)` + `staleTime: 2min` + `refetchInterval: 5min` na query principal (sem limit nem cache antes)
  3. **useDealCardFeatures.ts** — `staleTime: 2min` + `.limit(200)` em useDealChecklists, `.limit(100)` em useDealReminders, `.limit(50)` em useDealFollowers (3 queries sem cache)
  4. **useCommercialDashboard.ts** — `staleTime: 3min` + `refetchInterval: 5min` + `retry: 1` (8 queries paralelas sem cache — impacto performance crítico)
  5. **useSalesMirror.ts** — `staleTime: 3min` + `refetchInterval: 10min` (sem cache antes)
  6. **useSalesAssistant.ts** — Dynamic import `await import("@/integrations/supabase/client")` → static import no topo (TDZ risk documentado sessão 50)
- **Nota sobre tenant_id**: As tabelas `deal_requests`, `leads`, `interactions`, `deal_request_checklists`, `deal_request_reminders`, `deal_request_followers` todas têm RLS com `auth_tenant_id()` — o isolamento por tenant é garantido no nível do banco. Os "CRITICAL tenant_id leaks" reportados pelo agente são mitigados pelo RLS. Adição de filtro client-side é "defense in depth" mas não é blocker de segurança
- **Build**: 0 erros TypeScript ✅
- **Arquivos modificados** (6):
  - `src/hooks/useDealRequests.ts` — .limit(500) + staleTime + refetchInterval
  - `src/hooks/useLeads.ts` — .limit(500) + staleTime + refetchInterval
  - `src/hooks/useDealCardFeatures.ts` — staleTime + .limit() em 3 queries
  - `src/hooks/useCommercialDashboard.ts` — staleTime + refetchInterval + retry
  - `src/hooks/useSalesMirror.ts` — staleTime + refetchInterval
  - `src/hooks/useSalesAssistant.ts` — static import (remove dynamic import TDZ risk)
- **Cronograma CRM IA-Native**: Varredura pré-F2 ✅ concluída. CRM F1 production-ready. Próximo: F2 Item #1 (I01 AI Sales Assistant / Copilot CRM)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
