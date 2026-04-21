# BRIEFING — Atendimento S6 · Cargos + Permissões Granulares

> **Para copiar e colar no início da sua sessão Claude Code**
> **Worktree:** `../eco-atnd-s6-auth` · **Branch:** `feature/atnd-s6-cargos`
> **Duração estimada:** 3-4 dias úteis · **Dependências:** nenhuma (totalmente independente)
> **Prioridade:** P0 para Fase 2 SaaS · P1 para FIC single-tenant

---

## Missão

Implementar o **sistema de cargos e permissões granulares** do módulo Atendimento, com 13 módulos de permissão (paridade Nexvy), 3 presets iniciais (Admin / Atendente / Atendente restrito), matrix visual de permissões e middleware `requirePermission` aplicado em todas as rotas sensíveis. Quando terminar, Marcelo tem controle fino sobre o que Secretaria / Financeiro / Atendente de Matrícula podem fazer — e isso fica pronto para a Fase 2 (multi-tenant SaaS).

## Por que é importante

Hoje todos os 4 agentes da FIC (Fabiano / Jhiully / Cristina / Marcelo) veem tudo. Isso não escala e quebra quando virar SaaS. Cargos granulares resolvem **2 problemas de uma vez**:
1. **Segurança FIC:** Financeiro não vê conversas da Secretaria e vice-versa
2. **Base Fase 2 SaaS:** quando Nexvy virar whitelabel próprio, cargos já estão prontos — só mudar RLS

## Leituras obrigatórias

1. `CLAUDE.md` raiz
2. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — Parte 4 Sprint S6 + Parte 2.3 seção O (Usuários/Cargos)
3. `docs/adr/016-protocolo-sessoes-paralelas.md`
4. **Benchmark visual (Nexvy):**
   - `docs/research/nexvy-whitelabel/XWd-0Gj6R6E/` — Permissão de Acesso (12 frames)
   - `docs/research/nexvy-whitelabel/_KeeL_5wG5k/` — Equipes (17 frames)
   - `docs/research/nexvy-whitelabel/-LctSvm1Mzo/` + `LsdXRmS7Agk/` — Usuários conceitos (24 frames total)
   - `docs/research/nexvy-whitelabel/Lus6OhCWhrg/` (2:13–2:35) — 3 níveis Administrador / Atendimento / Atendimento restrito
5. Supabase Auth atual: `apps/erp-educacional/src/middleware.ts` + hooks em `apps/erp-educacional/src/hooks/use-auth*`

## Escopo preciso

### Pode mexer
- `apps/erp-educacional/src/app/(erp)/atendimento/configuracoes/cargos/**` — NOVA
- `apps/erp-educacional/src/app/(erp)/atendimento/configuracoes/usuarios/**` — NOVA
- `apps/erp-educacional/src/app/(erp)/atendimento/configuracoes/equipes/**` — NOVA
- `apps/erp-educacional/src/components/atendimento/permissions/**` — novos componentes
- `apps/erp-educacional/src/app/api/atendimento/roles/**`
- `apps/erp-educacional/src/app/api/atendimento/teams/**`
- `apps/erp-educacional/src/app/api/atendimento/invites/**`
- `apps/erp-educacional/src/lib/atendimento/permissions.ts` — utilitário `requirePermission(module, action)`
- `apps/erp-educacional/src/middleware.ts` — adicionar interceptor para rotas `/atendimento/api/*` (change mínima, aditiva)
- `infra/supabase/migrations/20260421_atendimento_s6_cargos.sql`
- `apps/erp-educacional/docs/PENDENCIAS-S6.md`

### NÃO mexer
- `tailwind.config.ts` — congelado
- Nada em `/conversas/`, `/crm/`, `/templates/`, `/agendamentos/`, `/contatos/` — **outras sessões estão ali**
- Migrations S4 e S5 — você tem arquivo próprio
- Packages (`packages/*`) — se precisar permissions cross-módulo, crie `@ecossistema/permissions` em sprint futura

## Entregas obrigatórias

### A. Migration SQL
- [ ] `20260421_atendimento_s6_cargos.sql` (numeração independente, não colide com S4/S5 pois arquivos diferentes):
  ```sql
  CREATE TABLE agent_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOL DEFAULT false,  -- true para os 3 presets (não deletáveis)
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE role_permissions (
    role_id UUID REFERENCES agent_roles ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- view/create/edit/delete/export
    granted BOOL DEFAULT true,
    PRIMARY KEY (role_id, module, action)
  );

  CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color_hex VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE team_members (
    team_id UUID REFERENCES teams ON DELETE CASCADE,
    agent_id UUID REFERENCES atendimento_agents ON DELETE CASCADE,
    PRIMARY KEY (team_id, agent_id)
  );

  CREATE TABLE agent_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(200) NOT NULL,
    role_id UUID REFERENCES agent_roles,
    invited_by UUID,
    token VARCHAR(64) UNIQUE,
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE atendimento_agents ADD COLUMN role_id UUID REFERENCES agent_roles;

  -- SEED: 3 presets de cargo (is_system=true, não deletáveis)
  INSERT INTO agent_roles (name, description, is_system) VALUES
    ('Administrador',        'Acesso total ao módulo Atendimento',                          true),
    ('Atendente',            'Atendimento padrão: vê conversas das suas filas, edita deals', true),
    ('Atendente restrito',   'Apenas suas próprias conversas, sem acesso a CRM',            true);
  ```

- [ ] Seed matrix de permissões (13 módulos × 5 ações = 65 linhas × 3 cargos = 195 inserts com grants específicos)
- [ ] Migration NÃO usa slot do dia (S4 ocupa dia 21, S5 dia 22) — você aplica em qualquer dia de 23-24

### B. 13 módulos canônicos (slugs)

| Slug | Nome FIC |
|---|---|
| `dashboard` | Dashboard |
| `conversations` | Conversas |
| `contacts` | Contatos |
| `pipelines` | CRM / Pipelines (deals, atividades, protocolos) |
| `schedules` | Agendamentos |
| `templates` | Modelos de Mensagem (WABA) |
| `automations` | Automações |
| `webhooks` | Webhooks e API |
| `inboxes` | Canais |
| `users` | Usuários |
| `roles` | Cargos |
| `ds_voice` | DS Voice (biblioteca) |
| `ds_ai` | DS Agente / DS Bot (IA) |
| `reports` | Relatórios |
| `settings` | Configurações gerais |

Ações por módulo: `view`, `create`, `edit`, `delete`, `export` (nem todos aplicáveis a todos módulos).

### C. Seed matrix (3 presets × 15 módulos)

**Administrador:** tudo `granted=true`.
**Atendente:** view/create/edit em `conversations`, `contacts`, `pipelines`, `schedules`, `templates` (view only), `ds_voice` (view only). Sem `users`/`roles`/`webhooks`/`reports` (view only)/`settings`.
**Atendente restrito:** view/edit em `conversations` (só suas — reforçado por RLS/query filter), view em `contacts` (só relacionados às suas conversas). Sem CRM, sem agendamentos.

Gerar script Python `scripts/seed_atendimento_permissions.py` que emite os INSERTs — mais fácil de manter do que SQL gigante.

### D. Backend APIs
- [ ] `GET/POST/PATCH/DELETE /api/atendimento/roles` (is_system não pode deletar)
- [ ] `GET/PATCH /api/atendimento/roles/[id]/permissions` (grant/revoke individual)
- [ ] `GET/POST/PATCH/DELETE /api/atendimento/teams` + `/teams/[id]/members`
- [ ] `POST /api/atendimento/invites` → gera token + envia email (usar Resend ou Supabase Auth magic link)
- [ ] `GET /api/atendimento/invites/accept?token=` → cria agent + vincula role

### E. Middleware de permissão
- [ ] `src/lib/atendimento/permissions.ts`:
  ```ts
  export async function requirePermission(
    supabase: SupabaseClient,
    userId: string,
    module: string,
    action: 'view'|'create'|'edit'|'delete'|'export'
  ): Promise<boolean> {
    // 1. pega role_id do agent por userId
    // 2. check role_permissions (role_id, module, action, granted=true)
    // 3. cache por requisição (React cache ou Map)
  }
  ```
- [ ] Wrapper HOC para rotas API: `withPermission('pipelines', 'edit')(handler)`
- [ ] Aplicar em: todas as rotas de `/api/atendimento/*` (revisar uma a uma)
- [ ] Em client components: hook `useCan(module, action)` que retorna boolean → esconder botões/rotas

### F. UI — rota `/atendimento/configuracoes/cargos`
- [ ] Lista de cargos (cards) + botão "+ Novo Cargo"
- [ ] Modal/drawer editar cargo:
  - Nome + descrição
  - **PermissionMatrix.tsx** — tabela responsiva 15 linhas × 5 colunas, toggles por célula
  - Botão "Copiar de outro cargo"
  - Save → PATCH roles/[id]/permissions
- [ ] Presets system (Admin/Atendente/Atendente restrito) não editáveis (edit button desabilitado + aviso)

### G. UI — rota `/atendimento/configuracoes/usuarios`
- [ ] Tabela usuários (nome / email / cargo / time / status / ações)
- [ ] "+ Convidar usuário" → modal (email + cargo + time opcional) → gera invite
- [ ] Editar usuário → mudar role, desativar, resetar senha (magic link)
- [ ] Status realtime (online/offline/pausado) já existe em `agent_statuses` — renderizar dot colorido

### H. UI — rota `/atendimento/configuracoes/equipes`
- [ ] Lista de times (cards) + botão criar
- [ ] Criar/editar: nome + cor + membros (multi-select agents)
- [ ] Uso futuro: filtros de Kanban "só equipe X", relatórios por equipe

### I. Testes
- [ ] Unit: `requirePermission('pipelines', 'edit')` retorna false para Atendente, true para Admin
- [ ] Integration: POST `/api/atendimento/roles` como Atendente → 403
- [ ] Integration: POST `/api/atendimento/invites` gera token, aceitar cria agent

### J. PR
- [ ] `feat(atendimento): S6 Cargos + Permissões Granulares + Equipes + Convites`
- [ ] Feature flag `ATENDIMENTO_RBAC_ENABLED` (pode ser ativado antes de S4/S5 se aprovado)

## Regras de paralelismo

1. Worktree `../eco-atnd-s6-auth`, branch `feature/atnd-s6-cargos`
2. **Sem slot de migração** — você escolhe dia após S4
3. Arquivos compartilhados: `middleware.ts` (change aditiva: só adicionar matcher para `/atendimento/api/*`)
4. Memory: `project_atnd_s6.md`
5. Ordem de merge: A(S4) → **C(S6 você)** → B(S5). Quando S4 mergear, rebase e merge.

## Referências técnicas

- Supabase RLS + JWT claims: https://supabase.com/docs/guides/auth/row-level-security
- Magic link invites: https://supabase.com/docs/reference/javascript/auth-signinwithotp
- Resend API (se preferir a magic link): https://resend.com/docs
- Next.js middleware (matcher pattern): https://nextjs.org/docs/app/building-your-application/routing/middleware

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-atnd-s6-auth feature/atnd-s6-cargos
cd ../eco-atnd-s6-auth
pnpm install
claude --permission-mode bypassPermissions

# Dentro do Claude:
# 1. Ler este briefing + Parte 4 Sprint S6 do plano
# 2. Aplicar migration em Supabase branch `atnd-s6`
# 3. Python script seed permissions (mais manutenível que SQL gigante)
# 4. PermissionMatrix component primeiro (é o visual carro-chefe)
```

---

*Briefing criado em 2026-04-20 · Sessão S089 paralela · Plano-mestre v1*
