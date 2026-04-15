# Sessão 38 — Fixes Auditoria Sessão 34: Fase 4 State Machine Enterprise (12/03/2026)

- **Objetivo**: Implementar Fase 4 (State Machine Enterprise) do plano de ação da auditoria sessão 34, usando MiniMax como pair programmer (Claudinho + Buchecha)
- **Metodologia**: Claude = Claudinho (commander/planner/reviewer), MiniMax = Buchecha (heavy lifter/code generator). Claude SEMPRE revisa output do MiniMax antes de aplicar.
- **6 sub-tasks implementadas**:
  1. **Phase 4.1 — Expansão do ENUM `contract_status`**: Adicionados 5 novos valores ao ENUM PostgreSQL: `negociacao`, `vigencia_pendente`, `em_alteracao`, `expirado`, `arquivado`. Via `ALTER TYPE contract_status ADD VALUE`. Total: 13 statuses
  2. **Phase 4.2 — Tabela `allowed_transitions`**: Criada tabela com colunas `id`, `tenant_id`, `from_status`, `to_status`, `required_role` (default 'any'), `description`, `is_active` (default true), `created_at`. Índice composto `(tenant_id, from_status, is_active)`. RLS habilitado com policy SELECT para tenant. Seed: 50 rows com transições role-based (ex: ativo→cancelado requer admin/gerente/superadmin = 3 rows)
  3. **Phase 4.3 — Trigger PostgreSQL `trg_validate_contract_transition`**: Defense-in-depth — valida que a transição `OLD.status → NEW.status` existe em `allowed_transitions` (sem role check devido a limitation de connection pooling do Supabase). Usa `SELECT EXISTS(...)` para evitar falha com múltiplas rows (mesmo from→to com roles diferentes)
  4. **Phase 4.4 — Edge Function `clm-contract-api` v14**: Reescrita completa com DB-driven transitions:
     - Nova action `get_transitions`: Retorna transições permitidas para status + role do usuário
     - `getUserRole()`: Query na tabela `user_roles` por (user_id, tenant_id)
     - `getAllowedTransitions()`: Query na `allowed_transitions` com `.or()` filter (required_role = 'any' OR required_role = userRole) + deduplicação
     - `handleTransition()`: Validação via DB em vez de map hardcoded
     - Dashboard: Summary com 13 statuses inicializados a 0
  5. **Phase 4.5 — Frontend sync (3 arquivos)**:
     - `src/lib/clmApi.ts`: ContractStatus union type (8→13), CONTRACT_STATUS_LABELS (13), CONTRACT_STATUS_COLORS (13, dark theme), CONTRACT_LIFECYCLE_PHASES (13 com ícones), VALID_TRANSITIONS (13 entries, mirror do DB)
     - `src/lib/contractSchema.ts`: Zod enum status (5→13), contractStatusLabels (5→13), contractStatusColors (5→13, light+dark theme)
     - `src/components/contracts/command-center/constants.ts`: STATUS_ICONS (8→13 com novos ícones lucide-react: MessageSquare, Clock, PenLine, AlertTriangle, FolderArchive)
  6. **Phase 4.6 — Deploy + Build**: clm-contract-api deployada como version 14 (ID: 11b89796-7dc6-4bdb-8b06-cd066e756a4b, ACTIVE). TypeScript build: 0 erros
- **Decisões técnicas importantes**:
  - **Sem role check no trigger**: Supabase connection pooling impede `SET LOCAL` de persistir entre queries. Trigger valida apenas path (from→to existe), role é validada na Edge Function
  - **Multi-role rows**: Mesmo from→to pode ter múltiplas rows (ex: ativo→cancelado com admin, gerente, superadmin = 3 rows). `getAllowedTransitions()` deduplica no retorno
  - **VALID_TRANSITIONS frontend mantido**: Mapa hardcoded no frontend serve como referência para UI hints (botões de transição). Backend é fonte de verdade (DB-driven)
  - **contract_type enum gap identificado**: Zod schema tem 4 tipos vs 12 em clmApi.ts — gap pré-existente, fora do escopo da Fase 4
- **Edge Functions — Versões atualizadas**:
  - `clm-contract-api` → version 14 (DB-driven transitions, get_transitions action)
- **Build**: 0 erros TypeScript
- **Arquivos modificados** (4 arquivos):
  - `supabase/functions/clm-contract-api/index.ts` — reescrito com DB-driven transitions
  - `src/lib/clmApi.ts` — 13 statuses, labels, colors, lifecycle phases, transitions
  - `src/lib/contractSchema.ts` — Zod enum 13 statuses, labels, colors
  - `src/components/contracts/command-center/constants.ts` — 13 STATUS_ICONS
  - `CLAUDE.md` — atualizado com sessão 38
