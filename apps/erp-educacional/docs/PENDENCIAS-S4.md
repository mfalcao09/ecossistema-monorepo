# Pendências específicas — S4 Kanban CRM

> Append-only. Fonte canônica cross-sessão fica em `docs/sessions/PENDENCIAS.md`
> (P-028 … P-038). Este arquivo é a lista operacional do dia a dia da S4.

## 🔴 Bloqueadores para PR merge

- [ ] **P-029** · `pnpm install` em `apps/erp-educacional/` — senão build quebra
- [ ] **P-028** · Aplicar migration em Supabase branch `atnd-s4` e validar schema
- [ ] **P-033** · Rodar `E2E=1 pnpm test` com branch aplicada — trigger history
- [ ] **P-032** · Escrever E2E Playwright de drag entre colunas

## 🟡 Antes de "pronto em produção"

- [ ] **P-028** · Aplicar migration em prod no slot do dia (21/04)
- [ ] **P-030** · Regerar types Supabase para eliminar `any` casts
- [ ] **P-031** · Env var `NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED=true` em Vercel
- [ ] **P-034** · Exportar CSV Nexvy (171 deals) + rodar import real
- [ ] Screenshots de staging no PR body

## 🟢 Débitos técnicos (fora do escopo S4)

- [ ] **P-035** · Implementar modal completo "Criar pipeline" (substitui `alert()`)
- [ ] **P-036** · Ações reais do menu ⋮ das stage (editar/transferir/CSV) — S8
- [ ] **P-037** · Virtualização `react-virtuoso` se stage passar de 200 cards
- [ ] **P-038** · Assignee matching do import Nexvy via email — depende de S6 Cargos

## Riscos observados durante a implementação

| Risco | Mitigação atual | Follow-up |
|-------|-----------------|-----------|
| RLS permissiva em `deals/*` | OK para Fase 1 single-tenant | S6 Cargos refina para `access_role_ids` |
| `ChatPanel.tsx` — mudança cirúrgica conflita com S5 e S6 | Adicionado apenas 1 import + 1 componente em 1 local | Garantir ordem de merge (A → C → B) |
| Migration altera `atendimento_conversations` (S3 produção) | Colunas com `IF NOT EXISTS`, default seguros, triggers não-breaking | Testar realtime channel após migration aplicada |
| Import CSV com 171 deals duplicando contatos | `upsert` por `phone_number` antes de criar contato | Validar em dry-run primeiro |
