# BRIEFING — Atendimento S8b · Chat Interno + Links de Redirecionamento

> **Worktree:** `../eco-atnd-s8b` · **Branch:** `feature/atnd-s8b-chat-interno`
> **Duração:** 3-4 dias · **Dependências:** S6 mergeado (teams/permissions)
> **Prioridade:** P1

---

## Missão

Implementar o **chat interno entre atendentes** (DMs + grupos de time, Supabase Realtime) + sistema de **links de redirecionamento inteligentes** (slugs rastreáveis com 4 tipos de distribuição de leads: sequencial, aleatório, ordenado, por horário). Atendente da FIC conversa com colega em tempo real, e Marcelo publica links no Instagram que distribuem leads automaticamente pro WhatsApp do atendente certo.

## Por que importa

- **Chat interno:** hoje atendentes FIC alinham por WhatsApp pessoal (ruído, vazamento, sem histórico). Chat interno dentro do ERP = colaboração com contexto (pode referenciar conversa/deal/contato).
- **Links redirecionamento:** Marcelo investe em anúncios Instagram; sem link rastreável, não sabe qual criativo trouxe matrícula. Com links por horário, noturno vai pro atendente plantão, diurno pra secretaria.

## Leituras obrigatórias

1. `CLAUDE.md` · Plano mestre Parte 4 Sprint S8 + seções I (Links) e M (Chat Interno)
2. `docs/research/nexvy-whitelabel/X115LzVAliA/` — Chat Interno (18 frames)
3. ADR-016 (paralelismo)
4. Tabelas já existentes: `teams` + `team_members` (vêm do S6)

## Escopo preciso

### Pode mexer
- `apps/erp-educacional/src/app/(erp)/atendimento/chat-interno/**`
- `apps/erp-educacional/src/app/(erp)/atendimento/links-redirecionamento/**`
- `apps/erp-educacional/src/components/atendimento/chat-interno/**`
- `apps/erp-educacional/src/components/atendimento/link-redirects/**`
- `apps/erp-educacional/src/app/api/atendimento/team-chats/**`
- `apps/erp-educacional/src/app/api/atendimento/link-redirects/**`
- `apps/erp-educacional/src/app/api/l/[slug]/route.ts` — handler público de redirecionamento
- `infra/supabase/migrations/20260427_atendimento_s8b_chat_links.sql`

### NÃO mexer
- `tailwind.config.ts`, qualquer outra rota de `/atendimento`
- `/automacoes`, `/webhooks`, `/api-keys`, `/integracoes` — S8a

## Entregas obrigatórias

### A. Migration SQL
- [ ] `CREATE TABLE team_chats (id, account_id, name, type VARCHAR, -- dm | group | broadcast, team_id FK NULL, created_by, created_at)`
- [ ] `CREATE TABLE team_chat_members (chat_id FK, agent_id FK, last_read_at, joined_at, PRIMARY KEY (chat_id, agent_id))`
- [ ] `CREATE TABLE team_messages (id, chat_id FK, author_id, content TEXT, mentions UUID[], attachment_url TEXT, reply_to UUID NULL, reactions JSONB DEFAULT '{}', created_at, edited_at)`
- [ ] `CREATE TABLE link_redirects (id, account_id, slug UNIQUE, name, distribution_type VARCHAR, -- sequential | random | ordered | by_hour, target_channel VARCHAR, -- whatsapp | instagram | messenger, agent_ids UUID[], schedule_config JSONB, active BOOL, click_count INT DEFAULT 0, last_click_at TIMESTAMPTZ, created_at)`
- [ ] `CREATE TABLE link_clicks (id, link_id FK, clicked_at, ip_hash VARCHAR, user_agent TEXT, target_agent_id UUID, utm JSONB)`
- [ ] Índices: `team_messages(chat_id, created_at DESC)`, `link_redirects(slug)`, `link_clicks(link_id, clicked_at DESC)`
- [ ] Supabase Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE team_messages`

### B. Chat Interno `/atendimento/chat-interno`
- [ ] 2 painéis: esquerda (320px) lista de chats · direita (flex) conversa aberta
- [ ] **Lista:** DMs (contato direto) + Grupos de time · busca · badge unread count
- [ ] **Conversa:** bubbles in/out + avatar + nome · input com botão "@" para mentions · upload de anexo · reação emoji no hover
- [ ] Supabase Realtime: novas mensagens aparecem live sem polling
- [ ] **Reply-to:** clicar em mensagem → opção "Responder" → bubble com quote
- [ ] **Referência cross-módulo:** digitar `#` → menciona conversa/deal/contato (autocomplete) — vira link clicável no bubble
- [ ] "+ Novo chat" → modal (DM: select 1 agente · Grupo: select time ou multi-agent)
- [ ] Typing indicator via Realtime Presence
- [ ] Last-read tracking (badge "novo desde 14:23")

### C. Links de Redirecionamento `/atendimento/links-redirecionamento`
- [ ] CRUD de links com slug único (validado: `/^[a-z0-9-]{3,32}$/`)
- [ ] Form: nome · canal destino · agentes elegíveis · tipo distribuição:
  - **Sequencial:** agent[n], agent[n+1]... (round-robin)
  - **Aleatório:** pick random do array
  - **Ordenado:** primeiro online > segundo online > etc
  - **Por Horário:** `schedule_config` JSONB com `[{from:"08:00",to:"18:00",agent_id:X}, {from:"18:00",to:"23:00",agent_id:Y}]`
- [ ] Rota pública `/l/[slug]` → seleciona target agent → monta URL `wa.me/<numero>?text=Olá` → redirect 302
- [ ] Registra em `link_clicks` com hash IP (SHA-256) + UA + UTM (query params)
- [ ] Relatório por link: cliques total · por agente · por dia · gráfico last 30d

### D. Relatórios básicos (placeholders — S7 detalha)
- [ ] `/atendimento/links-redirecionamento/[id]/relatorio` com tabela + chart simples

### E. Testes
- [ ] Unit: `selectAgentForLink(link, now)` retorna agent correto (4 tipos)
- [ ] Integration: POST mensagem no team_chat → Realtime emite evento
- [ ] E2E: hit GET `/l/slug-x` → redireciona + click_count++

### F. PR
- [ ] `feat(atendimento): S8b Chat Interno + Links de Redirecionamento`
- [ ] Feature flags: `ATENDIMENTO_CHAT_INTERNO_ENABLED` + `ATENDIMENTO_LINKS_REDIRECT_ENABLED`

## Regras de paralelismo

1. Worktree `../eco-atnd-s8b`, branch `feature/atnd-s8b-chat-interno`
2. Migração independente (arquivo próprio)
3. Dependência soft: `teams/team_members` do S6 — se ainda não mergeado, criar schema seu próprio e ajustar depois
4. Zero arquivos compartilhados — tudo rotas novas
5. Memory: `project_atnd_s8b.md`

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-atnd-s8b feature/atnd-s8b-chat-interno
cd ../eco-atnd-s8b
pnpm install
claude --permission-mode bypassPermissions

# 1. Migration team_chats/messages/link_redirects/link_clicks
# 2. Chat interno com Realtime primeiro (bubble básico)
# 3. Depois links redirect (distribuição sequencial primeiro, outros depois)
```

---

*Briefing S089 · leva 2 paralela · Plano-mestre v1*
