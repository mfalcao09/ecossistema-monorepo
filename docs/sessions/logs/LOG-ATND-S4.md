# LOG — ATND-S4 · Kanban CRM + Lead Detail + Protocolos

**Worktree:** `affectionate-nobel-65e3c0`
**Branch:** `claude/affectionate-nobel-65e3c0` → PR para `main`
**Briefing:** `docs/sessions/BRIEFING-ATND-S4-KANBAN.md`
**Início:** 2026-04-21
**Executor:** Claude Opus 4.7 (1M)

---

## Entregas consolidadas (1ª janela)

### A. Database
- `infra/supabase/migrations/20260421000000_atendimento_s4_kanban.sql` (+rollback)
- Cria: `pipelines`, `pipeline_stages`, `deals`, `deal_activities`, `deal_notes`,
  `deal_history_events`, `protocols`, `campaigns`, `contact_custom_fields`
- Altera: `atendimento_conversations.deal_id/protocol_count`,
  `atendimento_contacts.aluno_id/source/color_hex`
- Triggers: `atnd_s4_log_deal_history` (INSERT + UPDATE) + `atnd_s4_bump_protocol_count`
  + `atnd_s4_touch_updated_at`
- RLS permissiva `authenticated` + `service_role` (refinado em S6)
- Seed: 2 pipelines FIC + 11 stages com cores e SLAs

### B. API routes (10)
- `GET/POST /api/atendimento/pipelines`
- `GET/PATCH /api/atendimento/pipelines/[id]`
- `GET /api/atendimento/pipelines/[id]/deals` (agrupa por stage)
- `POST /api/atendimento/deals`
- `GET/PATCH/DELETE /api/atendimento/deals/[id]`
- `GET/POST/PATCH /api/atendimento/deals/[id]/activities`
- `GET/POST /api/atendimento/deals/[id]/notes`
- `GET /api/atendimento/deals/[id]/history`
- `GET/POST/PATCH /api/atendimento/conversas/[id]/protocols`
- `GET /api/atendimento/activities` (Central)

### C. UI
- `/atendimento/crm` — KanbanBoard + StageColumn + DealCard + PipelineSelector + KanbanFilters
- `LeadDetailModal` com 4 abas (Negócios · Atividades · Histórico · Notas)
- `DealActivityEditor` (TipTap + anexo + agenda)
- `ProtocolModal` com número sequencial
- Shared: `BreadcrumbPipeline`, `TicketNumberPill`
- Integração em `ChatPanel.tsx` — 1 import + 1 `<BreadcrumbPipeline/>`
- `/atendimento/atividades` — Central com 4 contadores

### D. Script de import
- `scripts/nexvy_import.ts` com `--dry-run` e `--rollback <run-id>`
- `docs/IMPORT-NEXVY.md` — passo a passo + stage mapping

### E. Testes
- Unit: `sla.test.ts` (9 casos, cobre green/yellow/red/none + edge cases)
- Integration: `integration.deal-history.test.ts` (skipado sem `E2E=1`)
- `vitest.config.ts` já existe no repo

### F. Deps adicionadas em `package.json`
- runtime: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- runtime: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`
- dev: `vitest`, `@vitest/coverage-v8`
- scripts: `test`, `test:watch`

---

## Decisões no caminho

1. **Path mapping para protocols** — briefing usou `/conversations/[id]/protocols`;
   o repo já tem tree `/conversas/[id]`. Manti `conversas/` para não criar rotas duplicadas.
2. **`deal_id` no retorno de `GET /api/atendimento/conversas/[id]`** — adicionado ao
   select para que `BreadcrumbPipeline` receba o id via props do ChatPanel.
3. **CSRF** — `skipCSRF: true` seguindo padrão das rotas existentes de atendimento.
   RBAC mais robusto fica para S6.
4. **RLS** — policies `authenticated USING (true) WITH CHECK (true)` + `service_role`.
   Fase 1 single-tenant; em S6 vira `admin_role_ids`/`access_role_ids`.
5. **Menu ⋮** e **criar pipeline** ficam com placeholders (`alert()`) — fecham em S8/S5+.
6. **Virtualização** — não aplicada ainda (`react-virtuoso`); risco citado no plano.
   Fazer quando uma stage passar de 200 cards em produção.

---

## Timeline

- **t0** — Briefing lido, plano S4 mapeado
- **t+1** — Migration + rollback escritos
- **t+2** — 10 rotas API prontas
- **t+3** — Shared components + Kanban (board, column, card, filters, selector)
- **t+4** — LeadDetailModal + DealActivityEditor + ProtocolModal
- **t+5** — Central de Atividades + wiring no ChatPanel
- **t+6** — Script nexvy_import + IMPORT-NEXVY.md
- **t+7** — Unit + integration tests
- **t+8** — PENDENCIAS-S4, PENDENCIAS.md, este LOG
- **t+9** — Commit + PR

---

## Próximos passos (sequência recomendada para Marcelo)

1. `cd apps/erp-educacional && pnpm install`
2. Criar branch Supabase: `supabase branches create atnd-s4`
3. Aplicar migration via MCP `mcp__supabase__apply_migration` (projeto `gqckbunsfjgerbuiyzvn`, branch `atnd-s4`)
4. Regenerar types (`pnpm supabase gen types typescript --project-id <branch>`)
5. `pnpm dev` e testar `/atendimento/crm` com seed das 2 pipelines
6. `E2E=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm test` para validar trigger
7. Exportar CSV Nexvy e rodar `scripts/nexvy_import.ts --dry-run`
8. Deploy preview Vercel com `NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED=true`
9. Aplicar migration em prod no slot do dia 21/04 (após validação em branch)
10. Rodar import real dos 171 deals

---

## Pendências escritas em `docs/sessions/PENDENCIAS.md`

`P-028` … `P-038` — ver tabela "Abertas".
