# BRIEFING — Atendimento S4 · Kanban CRM + Lead Detail + Protocolos

> **Para copiar e colar no início da sua sessão Claude Code**
> **Worktree:** `../eco-atnd-s4` · **Branch:** `feature/atnd-s4-kanban`
> **Duração estimada:** 5-7 dias úteis · **Dependências:** nenhuma (é fundação)
> **Prioridade:** P0 · **Slot de migração do dia:** ✅ (essa sessão aplica migrations S4)

---

## Missão

Construir o **Kanban CRM do módulo Atendimento** com as 2 pipelines reais da FIC (ATENDIMENTOS-GERAL + Alunos), Lead Detail Modal completo (4 abas), sistema de Protocolos e Central de Atividades. Ao fim da sessão, Marcelo consegue migrar as 171 deals reais do Nexvy e operar o Kanban dentro do ERP em paridade funcional com Nexvy/helenaCRM.

## Por que é crítica

Toda a jornada de matrícula da FIC passa pelo Kanban (ATENDIMENTOS-GERAL: AGUARDANDO → SECRETARIA → FINANCEIRO → NOVAS MATRÍCULAS). Sem S4, os atendentes continuam usando o Nexvy em paralelo e pagando licença. S4 é a primeira entrega que **substitui** o Nexvy de verdade em um fluxo real da FIC.

## Leituras obrigatórias (antes de começar)

1. `CLAUDE.md` na raiz do monorepo
2. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — **leia a Parte 4 Sprint S4 INTEIRA** (tem SQL pronto)
3. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — Parte 2.3 seção C (CRM Kanban — 22 features detalhadas) e seção K (tudo mapeado)
4. `docs/adr/016-protocolo-sessoes-paralelas.md` — como não colidir com S5-Templates e S6-Cargos
5. **Benchmark visual:** abra os READMEs destes vídeos (frames + timestamps):
   - `docs/research/nexvy-whitelabel/y3CFR97J2Bo/` — visão geral CRM (109 frames)
   - `docs/research/nexvy-whitelabel/hu38xgDc-l8/` — criação passo a passo do painel (39 frames)
   - `docs/research/nexvy-whitelabel/ssG53BDi1K0/` — cards no CRM (40 frames)
   - `docs/research/nexvy-whitelabel/VAa4tqrsFqI/` — cadastro de contato (58 frames)
   - `docs/research/nexvy-whitelabel/g0_lGAnSzdY/` — consulta/edição contato (43 frames)
6. Migrations existentes: `infra/supabase/migrations/20260412_atendimento_modulo_init.sql` + `20260413_atendimento_s3_queues.sql`
7. Código produção atual: `apps/erp-educacional/src/app/(erp)/atendimento/conversas/*`

## Escopo preciso

### Pode mexer (exclusivo desta sessão)
- `apps/erp-educacional/src/app/(erp)/atendimento/crm/**` — nova rota
- `apps/erp-educacional/src/app/(erp)/atendimento/atividades/**` — nova rota
- `apps/erp-educacional/src/components/atendimento/kanban/**` — novos componentes
- `apps/erp-educacional/src/components/atendimento/shared/BreadcrumbPipeline.tsx` — NOVO
- `apps/erp-educacional/src/components/atendimento/shared/TicketNumberPill.tsx` — NOVO
- `apps/erp-educacional/src/app/api/atendimento/pipelines/**` — rota API
- `apps/erp-educacional/src/app/api/atendimento/deals/**` — rota API
- `apps/erp-educacional/src/app/api/atendimento/protocols/**` — rota API
- `infra/supabase/migrations/20260421_atendimento_s4_kanban.sql` — NOVA migration
- `apps/erp-educacional/scripts/nexvy_import.ts` — NOVO script de import dos 171 deals reais
- `apps/erp-educacional/docs/PENDENCIAS-S4.md` (append-only)

### NÃO mexer (conflito com outras sessões)
- `tailwind.config.ts` — **congelado** pela sessão base
- `apps/erp-educacional/src/app/(erp)/atendimento/layout.tsx` — TopBar existente, compartilhado
- `apps/erp-educacional/src/app/(erp)/atendimento/conversas/**` — S3 produção (só adicionar o BreadcrumbPipeline no header, change mínima)
- `apps/erp-educacional/src/app/(erp)/atendimento/contatos/**` — S6 vai reformar
- `infra/supabase/migrations/20260421_atendimento_s5_templates_expand.sql` — se existir, é da sessão B (S5)
- `infra/supabase/migrations/20260421_atendimento_s6_cargos.sql` — da sessão C (S6)
- `packages/*` — nenhuma mudança cross-package aqui

## Entregas obrigatórias (checklist de aceite)

### A. Migration SQL aplicada e testada
- [ ] `20260421_atendimento_s4_kanban.sql` cria: `pipelines`, `pipeline_stages`, `deals`, `deal_activities`, `deal_notes`, `deal_history_events`, `protocols`, `campaigns`, `contact_custom_fields`
- [ ] Seed das 2 pipelines FIC + 11 stages (4 ATENDIMENTOS-GERAL + 7 Alunos com cores e SLA)
- [ ] `ALTER` em `atendimento_conversations` (+ `deal_id`, `protocol_count`) e `atendimento_contacts` (+ `aluno_id`, `source`, `color_hex`)
- [ ] Índices: `deals(pipeline_id, stage_id)`, `deals(contact_id)`, `deals(assignee_id)`, `deal_history_events(deal_id, created_at DESC)`
- [ ] Trigger `deal_history_events` auto-insert quando `stage_id` muda em `deals`
- [ ] Aplicada primeiro em Supabase branch `atnd-s4`, testada, depois em prod no **slot do dia 21/04**

### B. Backend APIs
- [ ] `GET/POST/PATCH /api/atendimento/pipelines`
- [ ] `GET /api/atendimento/pipelines/[id]/deals?stage=X&filters=...`
- [ ] `GET/PATCH /api/atendimento/deals/[id]` (PATCH stage dispara trigger)
- [ ] `POST /api/atendimento/deals/[id]/activities` · `POST /api/atendimento/deals/[id]/notes`
- [ ] `GET /api/atendimento/deals/[id]/history`
- [ ] `POST /api/atendimento/conversations/[id]/protocols`
- [ ] `GET /api/atendimento/activities?filter=upcoming|today|overdue|completed` (Central de Atividades)

### C. Frontend — rota `/atendimento/crm`
- [ ] `KanbanBoard.tsx` — colunas draggable via `@dnd-kit` (instalar se não tiver), horizontal scroll, `height: calc(100vh - 2*topbar)`
- [ ] `StageColumn.tsx` — header com nome/cor/contador + menu ⋮ (Editar/Transferir/CSV/Automações — placeholder p/ S8)
- [ ] `DealCard.tsx` — modo `compact` (default) e `preview` (toggle global mostra última mensagem)
- [ ] `PipelineSelector.tsx` — drawer lateral 480px + seletor + "+ Criar nova pipeline"
- [ ] `LeadDetailModal.tsx` — modal full-height com 2 colunas (perfil + 4 abas: Negócios/Atividades/Histórico/Notas)
- [ ] `DealActivityEditor.tsx` — TipTap rich editor + upload anexo
- [ ] `ProtocolModal.tsx` — abrir dentro de conversa, número sequencial auto
- [ ] Persistência do drag: `PATCH /api/atendimento/deals/[id]` on drop → optimistic update + rollback em erro
- [ ] Filtros Kanban: pills Tags/Campanhas/Filas/Período + chip ativo + checkbox "não lidas / com tarefa"

### D. Integração com conversas (mínima, change cirúrgica)
- [ ] Em `ChatPanel.tsx` (arquivo existente, uma única edição): adicionar `<BreadcrumbPipeline dealId={conversation.deal_id}/>` no header do chat. Componente fica em `shared/`.

### E. Central de Atividades — rota `/atendimento/atividades`
- [ ] 4 contadores clicáveis (Próximas / Hoje / Atrasadas / Concluídas)
- [ ] Filtros: Categoria (task/call/meeting/email) · Status · Tipo · Responsável
- [ ] Lista paginada com ações (completar, editar, excluir)

### F. Script de import Nexvy → ERP
- [ ] `scripts/nexvy_import.ts` lê CSV exportado do Nexvy (Marcelo baixa via `console.nexvy.tech → API → export`)
- [ ] Upsert contatos (por `phone_e164`), cria deals com mapping de coluna→stage
- [ ] Dry-run + rollback
- [ ] Docs em `apps/erp-educacional/docs/IMPORT-NEXVY.md`

### G. Testes mínimos
- [ ] Unit: lógica de SLA (amarelo após sla_warning_days, vermelho após sla_danger_days)
- [ ] Integration: POST `/api/atendimento/deals/[id]` com `{ stage_id: novo }` cria evento em `deal_history_events`
- [ ] E2E (Playwright): drag de um card entre 2 colunas persiste no DB

### H. PR
- [ ] Branch `feature/atnd-s4-kanban` → PR para `main`
- [ ] Título: `feat(atendimento): S4 Kanban CRM + Lead Detail + Protocolos`
- [ ] Body: checklist desta seção + link para vídeos de referência + screenshots do staging
- [ ] CI verde (lint + unit + build)
- [ ] Deploy preview Vercel testado com feature flag `ATENDIMENTO_CRM_KANBAN_ENABLED=true`

## Referências técnicas

- **`@dnd-kit`**: https://docs.dndkit.com — escolhido ao invés de `react-beautiful-dnd` (deprecated)
- **TipTap**: https://tiptap.dev — editor rich para atividades/notas
- **Virtualização (se >200 cards/coluna):** `react-virtuoso`
- **Supabase Branching:** `supabase branches create atnd-s4` para testar migration isolada

## SQL pronto (extrair do plano, copiar literal)

Abrir `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` na seção **Sprint S4 → Entregas → DB Migrations**. O bloco SQL (incluindo seeds) está pronto para copy-paste direto no arquivo `20260421_atendimento_s4_kanban.sql`.

**Ajustes necessários antes de aplicar:**
- Renomear `atendimento_` → prefix consistente com produção (já é `atendimento_`)
- Revisar FKs que apontam para `atendimento_contacts` / `atendimento_conversations` / `atendimento_queues` (nomes reais)
- Adicionar RLS permissiva (Fase 1 ainda single-tenant)

## Regras de paralelismo (ADR-016)

1. Este worktree é seu — `../eco-atnd-s4` · branch `feature/atnd-s4-kanban`
2. **Slot de migração do dia: VOCÊ**. Avise no `docs/sessions/logs/LOG-ATND-S4.md` quando aplicar em prod.
3. Conflito de arquivos compartilhados: **você não mexe em** `tailwind.config.ts`, `layout.tsx` atendimento, nada em `contatos/` ou `templates/`. Só o `ChatPanel.tsx` para adicionar `BreadcrumbPipeline` (1 linha).
4. Memory: grave em `~/.claude/.../memory/project_atnd_s4.md`. Nunca `project_atnd_s5.md` (é da outra sessão).
5. PENDÊNCIAS: append-only em `docs/sessions/PENDENCIAS.md` — se outra sessão editou antes de você commitar, rebase + re-append.
6. Merge: PR primeiro; S5 e S6 mergeiam depois (ordem A → C → B).

## Feedback loop

- **Dia 2:** demo do SQL aplicado + seed FIC no staging para Marcelo
- **Dia 4:** demo do KanbanBoard + DealCard funcionando em staging
- **Dia 6:** Lead Detail Modal + Protocolo + Central de Atividades
- **Dia 7:** Script import + PR aberto + preview Vercel com flag

## Ações do dia 1 (execute sem pensar muito)

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-atnd-s4 feature/atnd-s4-kanban
cd ../eco-atnd-s4
pnpm install
claude --permission-mode bypassPermissions

# Dentro do Claude:
# 1. Ler este briefing + Parte 4 do plano
# 2. Criar migration SQL (copy do plano)
# 3. Aplicar em Supabase branch `atnd-s4`
# 4. Gerar types: `pnpm supabase gen types --project-id <atnd-s4-branch> > src/types/supabase.atendimento.ts`
# 5. Instalar @dnd-kit/core @dnd-kit/sortable @tiptap/react @tiptap/pm @tiptap/starter-kit
# 6. Skeleton de /atendimento/crm/page.tsx (loading + error + main)
```

---

*Briefing criado em 2026-04-20 · Sessão S089 paralela · Plano-mestre v1*
