# Sessão 85 — CRM F1 Item #12: I05 Assistente IA para Corretores — Fix & Deploy (19/03/2026)

- **Objetivo**: Implementar décimo segundo item da Fase 1 do plano CRM IA-Native: I05 — Assistente IA para Corretores
- **Descoberta**: Feature JÁ EXISTIA no código (sessão 81) mas estava QUEBRADA — 3 bugs impediam funcionamento
- **3 fixes aplicados**:
  1. **Deploy**: `commercial-broker-assistant` v1 deployada via Supabase MCP (ID: `8b767407-2da6-4d46-a345-bbf42fba689e`, ACTIVE, verify_jwt: false). 646 linhas, 4 actions (suggest_script, generate_proposal, prepare_meeting, analyze_profile), Gemini 2.0 Flash + fallback rule-based
  2. **Hook fix nome EF**: `useSalesAssistant.ts` — `"commercial-sales-assistant"` → `"commercial-broker-assistant"` (nome correto da Edge Function)
  3. **Hook fix import**: `useSalesAssistant.ts` — `@/lib/supabase` → `@/integrations/supabase/client` (path correto)
- **Componentes existentes confirmados funcionais**: `SalesAssistantPanel.tsx` (4 tabs: Script, Visita, Proposta, Objeções), `SalesAssistantDashboard.tsx` (rota `/comercial/assistente-ia`), integração no `DealDetailDialog`, sidebar item "Assistente IA"
- **Build**: 0 erros TypeScript ✅
- **Arquivos modificados** (1): `src/hooks/useSalesAssistant.ts`
- **Edge Functions — Versões atualizadas**: `commercial-broker-assistant` → version 1
- **Cronograma CRM IA-Native**: F1 Item #12 ✅ concluído (I05 Assistente IA Corretores). **CRM F1: 12/13 itens concluídos**. Próximo: F1 Item #13 (L02 Captação Multi-Canal IA)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
