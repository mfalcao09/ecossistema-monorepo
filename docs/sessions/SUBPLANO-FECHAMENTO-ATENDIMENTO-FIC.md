# Subplano de Fechamento — Módulo Atendimento FIC

> **Criado:** 2026-04-22 · Sessão S089
> **Decisão Marcelo:** Focar em produto 100% funcional dentro da FIC. S12 (multi-tenant) e S13 (white-label/SaaS) ficam **stand-by até decisão futura**.
> **Objetivo:** Desligar o Nexvy e rodar 100% no ERP em **3-4 semanas**.

---

## Contexto — estado atual do módulo

**Em produção (main):** S4 Kanban · S5 Templates WABA + Agendamentos · S6 Cargos · S7 Dashboards · S8a Automações/API/n8n · S8b Chat interno/Links · S9 DS Voice

**Paridade funcional com Nexvy:** ~80% (198 features mapeadas, ~160 implementadas)

**Pendentes de merge:**
- **PR #60** — S10 DS Agente OpenAI + RAG — aberto, aguardando review/merge
- **S11 DS Bot** — código gerado mas **untracked** no worktree (stash `stash@{0}`); precisa commit + PR

**Ignoradas (decisão):**
- S12 multi-tenant · S13 white-label/planos/SaaS — stand-by

---

## 🗺️ Plano em 5 etapas (ordem decidida por Marcelo)

### 🔰 Etapa 0 — Housekeeping (merge pendências de código)

Antes de qualquer fix, consolidar S10 e S11 em main para ter base limpa.

- [ ] Mergear **PR #60 S10 DS Agente** (se CI verde e sem conflito; caso contrário rebase + fix)
- [ ] Recuperar stash da S11 DS Bot, commit, abrir PR
- [ ] Rebase + merge PR S11 em main
- [ ] Limpar worktrees/branches utilizados

**Duração estimada:** 1-3h dependendo de conflitos.

**Entrega:** main com S4..S11 todas mergeadas e deploys Vercel verdes.

---

### 🔴 Etapa 1 — Categoria D: débitos técnicos críticos

Fixes que **quebram operação real** se não forem resolvidos antes do go-live.

| ID | Débito | Esforço | Arquivo-chave |
|---|---|---|---|
| **P-108** | `send_message` action do engine S8a insere row `pending` mas **não dispara Meta API**. Resolução: criar worker cron que drena `atendimento_messages WHERE status='pending' AND source='automation'` chamando `POST /conversas/[id]/messages` + marcando `sent` | 0.5 dia | `automation-engine.ts` + novo `/api/cron/drain-automation-messages/route.ts` |
| **P-066** | `refresh_token` Google e `access_token` WABA em plain text no DB. Migrar para `@ecossistema/credentials` (SC-29 vault) | 1 dia | `lib/atendimento/google-oauth.ts` + `waba-credentials.ts` |
| **P-068** | FK `atendimento_calendar_events.deal_id` apontando para NULL (S5 deixou aguardando S4). ALTER simples adicionando `REFERENCES public.atendimento_deals(id) ON DELETE SET NULL` | 10min | migration nova `20260502_fk_calendar_events_deals.sql` |

**Duração estimada:** 1.5-2 dias.

**Entrega:** Automações respondem de verdade no WhatsApp · credenciais seguras · integridade referencial calendar↔deal.

---

### 🟠 Etapa 2 — Categoria B + A: Integrações FIC + Deploy operacional

#### Sub-etapa 2.1 — Categoria B (código novo FIC-specific)

Sprint **"S4.5 FIC Integration"** — código pequeno mas bloqueia uso real pelos atendentes.

| Feature | Esforço | Entrega |
|---|---|---|
| **Vincular `atendimento_contacts.aluno_id` ↔ tabela `alunos`** | 1 dia | ContactInfoPanel mostra: CPF, curso, turma, mensalidade atual, status de matrícula, vínculo com processo diploma |
| **Botão "Solicitar pagamento" no chat** | 1 dia | Toolbar chat → modal valor/vencimento → chama `@ecossistema/billing` (Inter) → gera boleto → envia PDF no WhatsApp |
| **Trigger auto: Deal "Matrícula ativa" → cria/atualiza `alunos`** | 0.5 dia | Trigger SQL ou automation rule S8a que dispara quando deal entra na etapa terminal do pipeline Alunos |
| **Protocolo = número processo acadêmico** | 0.5 dia | `ALTER TABLE protocols ADD COLUMN processo_academico_id` + UI mostra número do processo |

**Duração:** 3-4 dias (1 sprint curta).

#### Sub-etapa 2.2 — Categoria A (deploy operacional, zero código novo)

Executar itens do `CHECKLIST-POS-LEVA-1.md` + novos de S9/S10/S11:

**Migrations em Supabase (serializadas, 1 por dia conforme ADR-016 Regra 5):**
- [ ] P-028 · S4 Kanban (`20260421000000_atendimento_s4_kanban.sql`)
- [ ] P-050 · S6 Cargos (`20260421_atendimento_s6_cargos.sql`)
- [ ] P-060 · S5 Templates (`20260421_atendimento_s5_templates_expand.sql`)
- [ ] P-090 · S7 Dashboards (`20260425_atendimento_s7_metrics.sql`)
- [ ] P-104 · S8a Automações (`20260426_atendimento_s8a_automations.sql`)
- [ ] P-098 · S8b Chat/Links (`20260427_atendimento_s8b_chat_links.sql`)
- [ ] S9 DS Voice (migration que veio com PR #59)
- [ ] S10 DS Agente (via PR #60 — pgvector extension!)
- [ ] S11 DS Bot (via PR a abrir)

**Env vars Vercel (projeto erp-educacional):**
- [ ] `ATENDIMENTO_RBAC_ENABLED` + `NEXT_PUBLIC_*` (P-052)
- [ ] `NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED` (P-031)
- [ ] `NEXT_PUBLIC_ATENDIMENTO_DASHBOARDS_ENABLED`
- [ ] `ATENDIMENTO_AUTOMATIONS_ENABLED` (P-105)
- [ ] `ATENDIMENTO_CHAT_INTERNO_ENABLED` + `NEXT_PUBLIC_*`
- [ ] `ATENDIMENTO_LINKS_REDIRECT_ENABLED` + `NEXT_PUBLIC_*`
- [ ] `ATENDIMENTO_DS_VOICE_ENABLED` + `NEXT_PUBLIC_*`
- [ ] `ATENDIMENTO_DS_AGENTE_ENABLED` (após decidir provedor LLM — P-130)
- [ ] `ATENDIMENTO_DS_BOT_ENABLED`
- [ ] `CRON_SECRET` / `ADMIN_SECRET` (P-061, P-107)
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_OAUTH_REDIRECT_URI` (P-061)

**Google Cloud Console (P-062):**
- [ ] Projeto "FIC Atendimento" com Calendar API + People API
- [ ] OAuth consent External + Client ID Web com redirects prod+localhost

**Provider config WhatsApp FIC (P-063):**
- [ ] SQL: UPDATE `atendimento_inboxes.provider_config` com `waba_id`, `phone_number_id`, `access_token` reais

**LLM provider para DS Agente (P-130 — decisão):**
- [ ] Decidir: OpenAI / Anthropic Claude / Groq / local
- [ ] Configurar API key no vault
- [ ] Se trocar de OpenAI, reescrever apenas `openai-client.ts`

**Template WABA piloto (P-040):**
- [ ] Criar `fic_boas_vindas_matricula` no Meta Business Manager (aguarda 24-48h aprovação)

**Duração:** 4-5 dias total (3-4 dias B + 1 dia A paralelo enquanto Meta aprova template).

**Entrega:** ERP-FIC operacional em staging, credenciais seguras, feature flags ativáveis.

---

### 🟡 Etapa 3 — Categoria C: polish de dados e UX + treinamento

Popular o ERP com dados reais e treinar os 4 atendentes FIC.

| Item | Ação |
|---|---|
| **P-034 + P-042** Importar 245 contatos + 171 deals reais | Exportar CSV do Nexvy → rodar `scripts/nexvy_import.ts --dry-run` → revisar → rodar sem dry-run |
| **P-051** Seed 165 permissions (3 presets cargos) | `python scripts/seed_atendimento_permissions.py \| psql` |
| Sync Meta templates aprovados | Após P-040 aprovar, abrir `/atendimento/templates` → botão "Sincronizar Meta" |
| **Seed 5 automações pré-configuradas** | Criar na UI regras canônicas FIC: (1) keyword "matrícula" → tag + deal pipeline Matrículas, (2) keyword "financeiro" → transfere fila, (3) msg recebida fora horário comercial → auto-reply, (4) deal "Aprovado" → notifica responsável, (5) contato inativo 7d → re-engajamento |
| **P-041** QA visual `/dev/tokens` em staging | Conferir paridade com console.nexvy.tech |
| **Treinamento dos 4 atendentes** | 2h presencial (Fabiano, Jhiully, Cristina, Marcelo) + vídeo gravado para consulta |
| **Soft launch controlado** | 1 atendente opera no ERP por 1 semana, 3 continuam no Nexvy em paralelo. Monitorar Sentry + feedback diário |

**Duração:** 2 dias (config/seed) + 1 semana (soft launch).

**Entrega:** Atendentes treinados, operação piloto em paralelo com Nexvy, feedback validado.

---

### 🟢 Etapa 4 — Categoria E + Check-up geral

Encerramento do projeto FIC.

#### Sub-etapa 4.1 — Features opcionais/diferenciais

Avaliar e implementar conforme orçamento/energia:

- [ ] **DS Voice uso efetivo** — biblioteca populada com 30+ mensagens pré-aprovadas FIC + 5 funis drip (no-show, pós-venda, re-engajamento)
- [ ] **DS Agente ativação gradual** — começar com 1 agente FIC-Secretaria com RAG do regulamento acadêmico (P-131) — depende de decisão LLM (P-130)
- [ ] **DS Bot templates FIC** — 5 fluxos prontos: qualificação matrícula, LGPD consent, agendamento visita, coleta documento, pós-venda

#### Sub-etapa 4.2 — Check-up geral de implementação

Auditoria antes do full launch:

- [ ] **Varredura de pendências** — fechar P-NNN resolvidos, renumerar restantes
- [ ] **Smoke tests E2E** — P-032/P-033/P-056/P-064/P-065/P-110 (todos os "test" em PENDENCIAS)
- [ ] **Security review** — vault de credenciais OK? RLS permissiva explícita documentada? Secrets scan limpo?
- [ ] **Performance check** — kanban com 200+ deals, dashboard com 90d de dados, automações com 100+ execuções
- [ ] **Observability** — Sentry ativo no erp-educacional? Logs estruturados? Alertas configurados?
- [ ] **Documentação do operador** — runbook para Secretaria (o que fazer se cair WhatsApp, como criar template, como editar automação)
- [ ] **Backup/rollback plan** — se for preciso voltar pro Nexvy, qual o caminho?

#### Sub-etapa 4.3 — Full launch + desligamento Nexvy

- [ ] **Full launch** — todos 4 atendentes operando 100% no ERP
- [ ] **Cancelar licença Nexvy** (economia ~R$500/mês)
- [ ] **Post-mortem** — o que funcionou, o que errou, aprendizados para Fase 4 SaaS
- [ ] **ADR de encerramento** — `docs/adr/021-atendimento-fic-launched.md`

**Duração:** 1 semana.

**Entrega:** FIC 100% no ERP · Nexvy desligado · documentação completa · ADR canônico.

---

## 📊 Cronograma consolidado (estimativa)

| Semana | Etapa | Entrega |
|---|---|---|
| **Semana 1 — dias 1-2** | Etapa 0 + Etapa 1-D | S10/S11 em main · débitos críticos resolvidos |
| **Semana 1 — dias 3-5** | Etapa 2-B (código FIC-specific) | Integração aluno/boleto/processo |
| **Semana 2 — dias 1-3** | Etapa 2-A (deploy) | Migrations + env vars + Google Cloud + WABA |
| **Semana 2 — dias 4-5** | Etapa 2-A continua (espera aprovação Meta) | Template WABA aprovado · LLM escolhido |
| **Semana 3 — dias 1-2** | Etapa 3-C (dados + seed) | Import Nexvy · seed permissions · automações pré-config |
| **Semana 3 — dias 3-5** | Etapa 3-C (treinamento + soft launch) | Atendentes treinados · 1 atendente piloto no ERP |
| **Semana 4 — dias 1-5** | Etapa 3-C (soft launch) | Feedback consolidado · ajustes |
| **Semana 5 — dias 1-3** | Etapa 4-E (opcionais) | DS Voice populado · DS Agente FIC-Secretaria live |
| **Semana 5 — dias 4-5** | Etapa 4-E (check-up) | Auditoria · runbook |
| **Semana 6** | Etapa 4-E (full launch) | FIC 100% ERP · Nexvy desligado · ADR-021 |

**Duração total:** 5-6 semanas (conservador). Agressivo: 3-4 semanas se soft launch for curto.

---

## 🛡️ Riscos + mitigações

| Risco | Mitigação |
|---|---|
| PR #60 S10 com conflito grande ao rebase | Separar em commits menores se necessário; se travar, apagar DS Agente temporariamente (não é crítico para FIC imediata) |
| S11 DS Bot não reproduz no worktree | Stash `stash@{0}` preservado; se perder, apagar ramo e re-gerar (briefing S11 está em main) |
| Meta não aprovar template em 48h | Submeter 3 templates alternativos simultaneamente (UTILITY puro → maior chance) |
| LLM provider P-130 indecidido | Default: Anthropic Claude (Marcelo já tem vault + confiança). Reescreve `openai-client.ts` por 1h de trabalho |
| Atendentes resistentes a mudança | Treinamento presencial + 1 atendente campeão interno + rollback plan pronto |

---

## 📂 Artefatos canônicos

- **Plano-mestre:** `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` (1317 linhas)
- **Checklist operacional:** `docs/sessions/CHECKLIST-POS-LEVA-1.md`
- **Este subplano:** `docs/sessions/SUBPLANO-FECHAMENTO-ATENDIMENTO-FIC.md`
- **Pendências canônicas:** `docs/sessions/PENDENCIAS.md` (76+ entradas)
- **Briefings sprints:** `docs/sessions/BRIEFING-ATND-S4..S13.md`

---

*Documento criado em 2026-04-22 · Sessão S089 · Plano aprovado por Marcelo para execução em 4 etapas (+ Etapa 0 housekeeping)*
