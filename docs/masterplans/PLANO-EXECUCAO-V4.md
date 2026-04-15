# Plano de Execução V4 — Ecossistema IA Autônomo
## Do Cowork ao Jarvis: 12 semanas estruturadas

> **Versão:** 4.0 · **Data:** 2026-04-15
> **Substitui:** ANALISE-CONSOLIDADA-V3 (análise) e versões anteriores.
> **Natureza:** Este é o primeiro documento **executável** — as v1-v3 eram diagnósticos.
> **Baseado em:** 6 decisões arquiteturais tomadas por Marcelo em 15/04/2026.

---

## 0. Aviso crítico — Compactação desta sessão

**Sim, esta sessão do Code corre risco de compactação.** Já salvei as 6 decisões arquiteturais em memória persistente ao iniciar esta resposta:

- `/memory/plano_v4_decisoes_arquiteturais.md` — decisões canônicas
- `/memory/user_marcelo_preferencias_operacionais.md` — perfil de trabalho
- `/memory/MEMORY.md` — índice atualizado

Se esta sessão for compactada ou fechada: a nova sessão automaticamente lê esses arquivos e recupera contexto. Nada se perde — isso já é o **protótipo manual** da "memória online" que vamos construir na Fase 0.

**Protocolo válido até a Fase 0 estar pronta:**
1. Toda decisão nova = eu salvo em `/memory/*.md` imediatamente
2. Todo documento importante = commit no repo `Ecossistema`
3. Ao reabrir sessão: leitura de `MEMORY.md` + últimas 3 memórias como primeiro ato

---

## 1. As 6 Decisões Canonizadas

### D1. Plataforma dos agentes — **Managed Agents + Railway (híbrido)**

| Camada | Onde roda | O que faz |
|---|---|---|
| **Claudinho + C-Suite** | Anthropic Managed Agents | Orquestração, raciocínio, delegação |
| **Squad dev** (Buchecha, DeepSeek, Qwen, Kimi, Codestral) | MCPs via plugins | Execução de código |
| **FastAPI wrapper** | Railway | HTTP endpoints para chamar agentes de qualquer canal |
| **RAG-engine** | Railway (já existe) | Busca semântica em memórias |
| **Webhooks inbound** (Inter, MEC, Apollo) | Railway | Disparadores para agentes |
| **Scheduled jobs** | Trigger.dev + pg_cron | Bootstrap diário, digest semanal, alertas |

**Por que híbrido:** Managed Agents resolve resiliência dos agentes em si. Railway dá flexibilidade para tudo que não é agente (cola, webhooks, jobs, frontend). Não estamos presos a um provider.

### D2. Modelo de dados — **ECOSYSTEM compartilhado + DBs per-projeto**

**Regra de ouro:**
> *Se serve mais de um negócio → vai para ECOSYSTEM. Se é dado de domínio do negócio → vai para o DB dele.*

| Supabase | ID | Papel | Tabelas que abriga |
|---|---|---|---|
| **ECOSYSTEM** | `gqckbunsfjgerbuiyzvn` | Plataforma compartilhada | `ecosystem_memory`, `agent_tasks`, `credentials`, `boletos_engine`, `audit_log` |
| **ERP-FIC** | `ifdnjieklngcfodmtied` | Domínio educacional | `alunos`, `matriculas`, `diplomas`, `cadeia_custodia` |
| **Intentus** | `bvryaopfjiyxjgsuhjsb` | Domínio imobiliário | `empreendimentos`, `unidades`, `contratos_clm`, `leads` |
| **Klésis** (futuro) | a criar | Educação básica | `familias`, `alunos_menores` (LGPD reforçado) |
| **Splendori** (futuro) | a criar | Incorporação Piracicaba | `obras`, `compradores`, `repasses_sfh` |

**Exemplo concreto — emissão de boleto:**
- Lógica de emissão (chamada ao Banco Inter, idempotência, HMAC) → **package `@ecossistema/billing`** conectado ao ECOSYSTEM
- Dados do boleto (aluno_id, mes_ref, valor, status) → **DB do projeto (ERP-FIC)**
- ECOSYSTEM guarda o "motor", ERP-FIC guarda o "registro do boleto daquele aluno"

### D3. Interface com agentes — **Jarvis em 4 estágios**

Esta é a trilha longa. Cada estágio destrava o próximo; **não pular**.

| Estágio | O que é | Quando | Tech stack |
|---|---|---|---|
| **E1 — Cowork + CLI** | Onde estamos hoje | Agora (manter em paralelo) | Claude Code + Managed Agents direct |
| **E2 — Text-first Bot** | Marcelo manda mensagem pelo WhatsApp/Telegram → agente responde | Fase 1 (~semana 4) | WhatsApp Business API + Railway webhook → Managed Agents |
| **E3 — Voz + App próprio** | App macOS/iOS com push-to-talk; fala, recebe resposta falada | Fase 2 (~semana 8) | Swift/Electron + Deepgram (STT) + ElevenLabs (TTS) + Managed Agents |
| **E4 — Jarvis always-on** | Escuta ambiente (wake-word), responde por voz, age proativamente | Fase 3 (~semana 16+) | OpenAI Realtime API ou custom + sensors + proactive triggers |

**Filosofia:** cada estágio precisa ser **bom o suficiente para uso diário** antes de passar para o próximo. Melhor E2 excelente do que E4 mal-acabado.

### D4. Scheduled tasks — **Opções na mesa, aprofundar em conjunto**

Você marcou dúvida nesta decisão. Minha recomendação provisória com trade-offs:

| Opção | Prós | Contras | Quando usar |
|---|---|---|---|
| **Supabase pg_cron** | Nativo, sem ferramenta extra, SQL direto | Limitado a jobs simples | Jobs de dados (backup, cleanup, agregação) |
| **Trigger.dev** | UI visual, retries, logs, TypeScript | Custo após free tier | Orquestração de agentes, workflows multi-step |
| **Vercel Cron** | Simples se já usa Vercel | 1 cron por plano tier (Hobby) | Só se Vercel for o centro do stack |
| **GitHub Actions** | Grátis, conhecido | Não é ideal para jobs frequentes (>hora) | Backup diário, relatórios semanais |

**Recomendação:** começar **só com pg_cron** (já que Supabase é central). Avaliar Trigger.dev quando precisar de workflow visual. Decidimos juntos antes da Fase 0 terminar.

### D5. Estrutura de repositório — **Monorepo com packages (pnpm workspaces)**

Dada D2 (serviços reutilizáveis vs domínio), monorepo faz muito sentido. Estrutura:

```
ecossistema-monorepo/
├── packages/
│   ├── @ecossistema/agentes/       # Claudinho + C-Suite prompts
│   ├── @ecossistema/memory/        # Cliente do ecosystem_memory
│   ├── @ecossistema/credentials/   # SC-29 client (wrap Supabase Vault)
│   ├── @ecossistema/billing/       # Motor de boletos (Inter + idempotência)
│   ├── @ecossistema/task-registry/ # Client de agent_tasks
│   ├── @ecossistema/rag/           # Cliente do RAG-engine Railway
│   └── @ecossistema/tools/         # Tool wrappers genéricos (supabase, mcp)
├── apps/
│   ├── erp-educacional/            # Produto 1 (FIC + Klésis)
│   ├── intentus/                   # Produto 2 (imobiliário)
│   ├── orchestrator/               # FastAPI no Railway que expõe agentes
│   └── jarvis-app/                 # Futuro app E3/E4
├── infra/
│   ├── supabase/                   # Migrations do ECOSYSTEM
│   ├── railway/                    # IaC do Railway
│   └── triggerdev/                 # Jobs agendados
├── docs/
│   ├── adr/                        # Decisões arquiteturais
│   ├── masterplans/
│   └── sessions/                   # Gerado do ecosystem_memory (read-only)
├── pnpm-workspace.yaml
├── turbo.json                      # Ou pnpm scripts, sem turbo inicialmente
└── CLAUDE.md                       # Único, referência ao ECOSYSTEM
```

**Por que pnpm workspaces (e não turbo inicialmente):**
- Iniciante em programação → turbo adiciona complexidade conceitual
- pnpm workspaces é nativo ao pnpm, sem ferramenta extra
- Quando os builds ficarem lentos, migramos para turbo em 1 dia

### D6. Piloto — **ERP-Educacional (com padrões técnicos vindos do Intentus)**

- **ERP-Educacional** = piloto de autonomia (hoje 20% de maturidade)
- **Intentus** = template técnico (hoje 60% maduro no mesmo produto base)
- **Estratégia:** portar Edge Functions do Intentus (CLM copilot, lead scoring, automation engine) para o ERP-Educacional, adaptando para contexto educacional

---

## 2. Sobre as 4 sessões Code em paralelo (resposta 6)

Sim, funciona, mas **com protocolo**. Sem protocolo, gera deploy conflict e overwrite de memória.

### Regras de paralelismo

**1. Um worktree por sessão.** Cada sessão trabalha em um git worktree separado (`git worktree add ../eco-session-A feature/erp-financeiro`). Nunca no mesmo diretório.

**2. Escopo por package ou módulo, nunca sobreposto.**

| Sessão | Escopo | Worktree |
|---|---|---|
| Sessão A | `packages/@ecossistema/billing` + webhook Inter no ERP | eco-billing |
| Sessão B | `packages/@ecossistema/memory` + auto-sync | eco-memory |
| Sessão C | `apps/orchestrator` (FastAPI Railway) | eco-orchestrator |
| Sessão D | `apps/erp-educacional/crm` (porting do Intentus) | eco-crm |

**3. Lock via Task Registry (Fase 0).** Antes de começar, cada sessão faz:
```sql
UPDATE agent_tasks SET status='locked', assigned_to='session_A', locked_at=NOW()
WHERE task_id = 'T-042';
```
Se outra sessão tentar pegar a mesma task, vê o lock e escolhe outra.

**4. Deploy sempre serial.** Merges em `main` só via PR + CI green. Nunca 2 sessões fazem push direto em main.

**5. Sync diário.** Toda noite: cada sessão comita, empurra branch, abre PR. Primeira sessão do dia seguinte integra.

**Gargalo real:** Supabase migrations. Só **uma sessão por dia** aplica migration em ECOSYSTEM ou em DBs de produção. As outras usam branches Supabase (branching já suportado).

---

## 3. Arquitetura alvo (diagrama textual)

```
         ┌──────────────────────────────────────────┐
         │        Marcelo (CEO)                     │
         │  [E2 Text bot] → [E3 App] → [E4 Jarvis]  │
         └──────────────┬───────────────────────────┘
                        │ mensagens / voz
                        ▼
         ┌──────────────────────────────────────────┐
         │ apps/orchestrator (FastAPI @ Railway)    │
         │ Webhook → Managed Agent dispatcher       │
         └──────────────┬───────────────────────────┘
                        │ invoca
                        ▼
 ┌──────────────────────────────────────────────────┐
 │         Anthropic Managed Agents                 │
 │  Claudinho (Opus 4.6) —→ 7 diretores (Sonnet)    │
 │  callable_agents ATIVO                           │
 └──────────────┬──────────────────┬────────────────┘
                │                  │
    tools MCP   │                  │  persistent memory
                ▼                  ▼
 ┌──────────────────┐   ┌───────────────────────────┐
 │ ERP-Educacional  │   │   Supabase ECOSYSTEM      │
 │ Intentus         │   │ • ecosystem_memory (+RAG) │
 │ (DBs per domínio)│   │ • agent_tasks             │
 │ + Edge Functions │   │ • credentials (SC-29)     │
 └──────────────────┘   │ • billing engine          │
                        │ • audit_log               │
                        └───────────────────────────┘
                                 ▲
                                 │ jobs
                                 │
                        ┌────────┴──────────┐
                        │ pg_cron +         │
                        │ Trigger.dev       │
                        └───────────────────┘
```

---

## 4. Fase 0 — Fundação Macro (semanas 1-2)

**Missão:** parar de perder memória. Agentes online. Monorepo organizado.

### Sprint 0.1 — Monorepo e memória online (semana 1)

| # | Tarefa | Dono sugerido | Critério de aceite |
|---|---|---|---|
| 0.1.1 | Criar monorepo `ecossistema-monorepo` com pnpm workspaces | Marcelo + Claude | `pnpm install` funciona; 3 packages stub criados |
| 0.1.2 | Migrar conteúdo dos 3 repos atuais para `apps/` e `packages/` correspondentes | Buchecha + Claude | Todos os arquivos com histórico preservado (git subtree) |
| 0.1.3 | Package `@ecossistema/memory` com client TS/Py para `ecosystem_memory` | Buchecha | Função `saveMemory()` e `searchMemory()` testadas |
| 0.1.4 | Auto-sync por turno (não só "vou encerrar") | Claude + Buchecha | Toda resposta de Claudinho gera 1 row em `ecosystem_memory` |
| 0.1.5 | Remover truncamento `500/1000 chars` em `_save_to_memory` | Buchecha | Conteúdo inteiro armazenado |
| 0.1.6 | Rodar migration do schema `ecosystem_memory` completo com embedding + RAG | DeepSeek | `bootstrap_session()` retorna top-k relevante |

### Sprint 0.2 — Task Registry + agentes online (semana 2)

| # | Tarefa | Dono sugerido | Critério de aceite |
|---|---|---|---|
| 0.2.1 | Tabela `agent_tasks` em ECOSYSTEM + package `@ecossistema/task-registry` | DeepSeek | CRUD funciona; lock otimista testado |
| 0.2.2 | `apps/orchestrator` (FastAPI) com endpoints `/agent/{name}/invoke` | Buchecha + Qwen | Curl para endpoint retorna resposta do Managed Agent |
| 0.2.3 | Deploy orchestrator no Railway (https + domínio) | Claude | `https://orchestrator.ecossistema.dev/health` = 200 |
| 0.2.4 | Habilitar `callable_agents` em Claudinho (já tem acesso Managed Agents) | Claude | Claudinho delega para CFO-IA com sucesso |
| 0.2.5 | Corrigir bugs Fase 0 da v3: `SKILLS_DIR`, .gitignore Vite, commits pendentes Intentus | Buchecha | git status clean nos 3 origens |
| 0.2.6 | Documentar protocolo de paralelismo (worktrees + lock) em `docs/adr/001-parallelism.md` | Claude | ADR aprovado pelo Marcelo |

**Saída da Fase 0:**
- ✅ Monorepo funcional com packages reutilizáveis
- ✅ Memória persistente automática — nada se perde
- ✅ Task Registry cross-sessão
- ✅ Orchestrator FastAPI rodando → agentes chamáveis por HTTP
- ✅ callable_agents ativo → Claudinho orquestra de verdade
- ✅ 4 sessões Code podem trabalhar em paralelo sem colisão

---

## 5. Fase 1 — ERP-Educacional Piloto (semanas 3-6)

4 módulos, 1 por semana, ordem intencional.

### Semana 3 — Módulo Financeiro (CFO-IA)
- Fechar webhook Inter (implementar `_processar_item_webhook`)
- Package `@ecossistema/billing` com idempotência + HMAC + retry
- Edge Function `credential-agent` no ERP (proxy SC-29 cross-DB)
- MCP tools do ERP: `emitir_boleto`, `listar_inadimplentes`, `confirmar_pagamento`
- CFO-IA autônomo: régua de cobrança diária, alertas, relatório mensal
- Aprovação humana programática (não só prompt) para valores > R$5.000

### Semana 4 — Módulo CRM (CSO-IA)
- Portar 4 Edge Functions do Intentus: `commercial-lead-scoring`, `commercial-pulse-feed`, `commercial-lead-chatbot`, `commercial-automation-engine`
- Adaptar para contexto educacional (matrícula ≠ unidade imobiliária)
- **Lançamento do E2 Jarvis — text-first bot:** WhatsApp Business API → orchestrator → Claudinho
- Marcelo começa a falar com VP pelo WhatsApp

### Semana 5 — Módulo CLM (CLO-IA)
- Portar CLM Agentic Copilot do Intentus (12 tools, v11)
- Contratos educacionais: serviços, estágio, convênios
- Compliance Monitor com regras educacionais (MEC, PROCON, CDC)
- CLO-IA com disclaimer enforçado: "Marcelo PREPARA, Marcelo ASSINA"

### Semana 6 — Módulo Atendimento (COO-IA + CAO-IA)
- Tickets com classificação automática por área
- Chatbot 24/7 portado do Intentus
- CAO-IA: alertas MEC (SC-28 virando código finalmente)
- RLS versionada em SQL para todas as tabelas críticas

**Em paralelo toda a Fase 1:**
- PermissionEnforcer real (cada agente seu env + allowlist)
- Smoke tests por agente (Art. XVII operacional)
- Task Registry populado de verdade

---

## 6. Fase 2 — Replicação Intentus + voz (semanas 7-8)

### Semana 7 — Portar para Intentus
- Mesmos wrappers MCP (tools `intentus-mcp`)
- Adaptar prompts do C-Suite para vertical imobiliário (Splendori context)
- Fechar dívida técnica Intentus: auth 401 nas 30 EFs + patches pendentes
- Integrar Relationship Module (12 features — 0% hoje) como backlog claro

### Semana 8 — Voz (E3 Jarvis)
- App desktop simples (Electron ou Swift) com push-to-talk
- STT: Deepgram Nova-3 (ou OpenAI Whisper)
- TTS: ElevenLabs (voz customizada) ou OpenAI TTS
- Claudinho responde por áudio
- Ainda não é always-on; é push-to-talk

---

## 7. Fase 3 — Multi-negócio + Jarvis Always-On (semanas 9-12)

- **Klésis** (tenant separado, LGPD menores reforçado)
- **Splendori** (tenant Intentus)
- **Nexvy** (MVP ou integração como ferramenta de atendimento nos ERPs)
- **CHRO-IA** (8º diretor — gestão de pessoas)
- **E4 Jarvis always-on:** wake-word ("Claudinho") + escuta ambiente + triggers proativos
- Tech: OpenAI Realtime API ou Whisper streaming + agente proativo que consulta `agent_tasks` e sugere ações

---

## 8. Gestão de risco desta sessão Code (proteção contra compactação)

Já executei protocolo provisório:

**✅ Feito agora:**
1. 2 arquivos em `/memory/` com decisões canônicas
2. `MEMORY.md` atualizado como índice
3. Este documento `PLANO-EXECUCAO-V4.md` salva tudo

**📋 Protocolo até Fase 0 pronta:**
1. Toda decisão nova → eu escrevo em `/memory/*.md` IMEDIATAMENTE
2. Toda conversa longa → resumo salvo como "project" memory
3. Ao perceber compactação iminente (contexto > 80%) → escrever um `.md` de checkpoint antes
4. Você pode forçar salvamento dizendo "salva contexto" a qualquer momento — eu paro o que estiver fazendo e persisto

**📌 O que já está protegido:**
- 6 decisões arquiteturais
- Seu perfil operacional e cosmovisão
- Visão Jarvis em 4 estágios
- 4 versões de análise crítica (v1-v3 + esta v4)
- Estrutura de monorepo planejada

Se a sessão fechar agora, uma nova sessão minha lê `/memory/MEMORY.md` no boot e retoma exatamente daqui.

---

## 9. Próximos 3 dias concretos (se você aprovar este plano)

**Dia 1 (hoje ou amanhã):**
- Aprovar/ajustar este plano V4
- Fechar decisão D4 (scheduled tasks)
- Criar repo monorepo vazio: `gh repo create mfalcao09/ecossistema-monorepo --private`

**Dia 2:**
- Migrar 3 repos atuais para `apps/` via `git subtree` (preserva histórico)
- Criar stub dos 7 packages
- Primeira versão do `@ecossistema/memory` com `saveMemory()`

**Dia 3:**
- Schema `ecosystem_memory` + `agent_tasks` aplicado no Supabase ECOSYSTEM
- Auto-sync de memória por turno funcionando em sessão de teste
- Você encerra a sessão, reabre, Claudinho sabe tudo que foi dito — primeiro "zero perda de memória" oficial

---

## 10. Resumo em 1 quadro

| Fase | Prazo | Destrava |
|---|---|---|
| **0 — Fundação macro** | semanas 1-2 | Memória online, agentes online, monorepo, callable_agents |
| **1 — ERP-Educacional piloto** | semanas 3-6 | 5 agentes autônomos em 4 módulos + E2 Jarvis (WhatsApp) |
| **2 — Intentus + voz** | semanas 7-8 | Replicação vertical imobiliário + E3 Jarvis (voz push-to-talk) |
| **3 — Multi-negócio + always-on** | semanas 9-12 | Klésis, Splendori, Nexvy, CHRO-IA + E4 Jarvis proativo |

**Total:** 12 semanas para ecossistema completo com agentes autônomos em 5 negócios + VP com voz contínua.

---

**Canônico a partir de:** 2026-04-15 (sessão da resposta V4)
**Próxima revisão:** ao fim da Sprint 0.1 (semana 1)
**Arquivos relacionados:**
- `/memory/plano_v4_decisoes_arquiteturais.md`
- `/memory/user_marcelo_preferencias_operacionais.md`
- `ANALISE-CONSOLIDADA-AGENTES-ECOSSISTEMA-V3.md` (diagnóstico base)
- `/Projects/GitHub/Ecossistema/COMPACTION-PROTOCOL.md` (inspiração do protocolo)
