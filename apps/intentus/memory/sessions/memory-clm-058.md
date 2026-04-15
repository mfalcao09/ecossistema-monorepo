# Sessão 58 — F2 Item #1: Auto-Compliance Monitoring (14/03/2026)

- **Objetivo**: Implementar primeiro item da Fase 2 do cronograma IA-Native: Monitoramento automático de compliance contratual com 18 regras, scoring ponderado, IA para ações corretivas, dashboard dedicado e execução automática via pg_cron
- **Backend — `supabase/functions/clm-compliance-monitor/index.ts` (CRIADO — ~860 linhas, self-contained, v1)**:
  - **4 actions**: `scan_all` (cron/service role), `scan_contract` (on-demand), `get_dashboard` (aggregated view), `resolve_violation` (status update)
  - **18 regras em 5 módulos**: Prazos (PZ-01 a PZ-04), Garantias (GA-01 a GA-03), Obrigações (OB-01 a OB-03), Documentação (DC-01 a DC-04), Financeiro (FN-01 a FN-03)
  - **Scoring**: Ponderado por severidade (critical=4, high=3, medium=2, low=1). Fails deduzem 100%, warnings 30%
  - **IA corrective actions**: Gemini 2.0 Flash via OpenRouter (JSON mode) + fallback rule-based
  - **Deploy**: v1 via Supabase MCP (ID: cd25a66e-9f14-4dca-9ed8-565f09ec1423, ACTIVE, verify_jwt: false)
- **Database migration**: `compliance_checks` + `compliance_violations` (6 indexes, RLS tenant isolation)
- **pg_cron**: Job ID 4, `0 9 * * *` (09:00 UTC = 06:00 BRT), chama `scan_all` via `extensions.http_post()`
- **Frontend**: `useComplianceMonitor.ts` (3 hooks), `ClmCompliance.tsx` (~310 linhas, 4 KPIs, 3 tabs: Contratos/Violações/Por Módulo)
- **RBAC**: `clm.compliance.view` + `clm.compliance.manage` × 7 roles em 3 camadas (frontend + backend mirror + DB RLS)
- **Rota + Sidebar**: `/contratos/compliance` + item "Compliance" (ShieldCheck) no sidebar
- **Build**: 0 erros TypeScript ✅
- **Arquivos criados** (3): `clm-compliance-monitor/index.ts`, `useComplianceMonitor.ts`, `ClmCompliance.tsx`
- **Arquivos modificados** (5): `clmPermissions.ts` (frontend + backend), `usePermissions.ts`, `App.tsx`, `AppSidebar.tsx`
- **Cronograma IA-Native**: F2 Item #1 ✅ concluído. Próximo: F2 Item #2 Smart Notifications v2
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
