# BRIEFING — Atendimento S11 · DS Bot (Visual Flow Builder)

> **Worktree:** `../eco-atnd-s11` · **Branch:** `feature/atnd-s11-ds-bot`
> **Duração:** 6-8 dias · **Dependências:** S4 + S5 + S9 + S10 em main (para envio de mensagem, template WABA, biblioteca, e integração IA opcional)
> **Prioridade:** P1 — complementa o DS Agente com fluxos determinísticos pré-desenhados

---

## Missão

Implementar o **DS Bot** — construtor visual de fluxos conversacionais no estilo Typebot/Manychat/Nexvy, com canvas drag-and-drop, componentes de bubble (Texto/Imagem/Vídeo/Áudio/Embed), inputs (Texto/Número/Email/Telefone/Data/Botão/Arquivo), ações (Fluxo/Contato/Mensagem/Atendimento) e vinculação a filas/canais. Substitui a camada determinística de qualificação de leads antes do DS Agente ou atendente humano.

## Por que importa

DS Agente (S10) é poderoso mas não-determinístico. Para fluxos **regulatórios** (qualificação LGPD, coleta de documento, agendamento de visita com regras de horário), o DS Bot garante previsibilidade. **Padrão do mercado educacional**: primeira mensagem → DS Bot coleta nome/CPF/curso → se qualifica, passa pro humano; se não, agradece e encerra.

## Leituras obrigatórias

1. `CLAUDE.md` (raiz)
2. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — Parte 4 Sprint S10 + Parte 2.3 seção L (DS Bot — 12 features)
3. `docs/sessions/PENDENCIAS.md` — use P-140+ para suas pendências
4. **Benchmark visual (CRÍTICO, 4 vídeos):**
   - `docs/research/nexvy-whitelabel/RFn_fw6wYOw/` — Ações de Fluxo (27 frames)
   - `docs/research/nexvy-whitelabel/Xf6tFnM4va4/` — Ações de Contato (7 frames)
   - `docs/research/nexvy-whitelabel/6RFcmRoD4E0/` — Ações de Mensagem (27 frames)
   - `docs/research/nexvy-whitelabel/AMDg3hbrui0/` — Ações de Atendimento (17 frames)
   - `docs/research/nexvy-whitelabel/YpFcjGiMw2I/` — Construtor Avançado (36 frames, sem timestamps — vídeo visual)
5. **Schema**: `permissions-constants.ts` já tem `ds_ai` (compartilhado com S10) — suas grants também entram aí

## Avisos pré-código

1. **Biblioteca de canvas**: use `@xyflow/react` v12 (ex-React Flow). **NÃO** use `reactflow` (v11 deprecated).
2. **Persistence**: salvar grafo como JSONB (`flow_json`) no DB. Serializable e versionável.
3. **Runtime**: máquina de estados simples (current_node_id + variables JSONB + history) em `ds_bot_executions`.
4. **Integração com S10**: um node especial "Chamar DS Agente" que delega pro agente IA (hand-off reverso).
5. **Integração com S9**: node "Enviar da biblioteca DS Voice" que permite reusar áudios/mídias.
6. **Integração com S5**: node "Enviar template WABA" que respeita janela 24h.
7. **Feature flag**: `ATENDIMENTO_DS_BOT_ENABLED` dupla (server+client).

## Escopo preciso (EXCLUSIVO)

- `apps/erp-educacional/src/app/(erp)/atendimento/ds-bot/**` — lista, editor canvas, playground, logs
- `apps/erp-educacional/src/components/atendimento/ds-bot/**`
  - `FlowCanvas.tsx` — React Flow
  - `nodes/BubbleNode.tsx`, `InputNode.tsx`, `ActionNode.tsx`, `ConditionalNode.tsx`, `AgentNode.tsx`
  - `NodePalette.tsx` — barra lateral de drag
  - `NodeConfigDrawer.tsx` — painel direito para config do node selecionado
- `apps/erp-educacional/src/app/api/atendimento/ds-bots/**`
- `apps/erp-educacional/src/lib/atendimento/ds-bot-runner.ts` — máquina de estados (evaluate next node)
- `apps/erp-educacional/src/lib/atendimento/ds-bot-actions.ts` — executores de cada tipo de ação
- `infra/supabase/migrations/20260430_atendimento_s11_ds_bot.sql`
- `apps/erp-educacional/docs/PENDENCIAS-S11.md`

## NÃO MEXA

- Rotas `/atendimento/*` de outras sessões
- `permissions.ts` (server) — só seed Python
- `tailwind.config.ts`

## Entregas obrigatórias

### A. Migration SQL (3 tabelas)
- [ ] `ds_bots` (id, account_id NULL, name, description, trigger_type VARCHAR, -- keyword|tag_added|new_conversation|manual, trigger_value TEXT, channels VARCHAR[], flow_json JSONB, enabled BOOL, version INT=1, created_by, created_at, updated_at)
- [ ] `ds_bot_versions` (id, bot_id FK, version INT, flow_json JSONB, created_by, created_at) — histórico para rollback
- [ ] `ds_bot_executions` (id, bot_id FK, conversation_id FK, contact_id FK, current_node_id VARCHAR, variables JSONB, history JSONB[], status VARCHAR='running', -- running|completed|aborted|error, started_at, completed_at, error TEXT NULL)
- [ ] Índice `ds_bot_executions(status, updated_at)` para worker retomar execuções

### B. Runner `ds-bot-runner.ts`
- [ ] `findTriggeredBot(conversation, message)` — match por keyword/tag/new_conv
- [ ] `startExecution(bot, conversation, message)` — cria row em `ds_bot_executions`, executa primeiro node
- [ ] `resumeExecution(execution_id, user_input)` — retoma no node atual com resposta do usuário
- [ ] `executeNode(node, context)` — despacha por tipo → chama handler em `ds-bot-actions.ts`
- [ ] `evaluateConditional(node, variables)` — para branches (if/else simples)

### C. Handlers de node (`ds-bot-actions.ts`)
- [ ] **Bubbles (5)**: Texto · Imagem · Vídeo · Áudio · Embed (iframe)
- [ ] **Inputs (8)**: Texto · Número · Email · Website · Data · Telefone · Botão (opções) · Arquivo (upload Supabase Storage)
- [ ] **Ações de Fluxo (4)**: Ir para node X · Voltar · Encerrar · Aguardar resposta (timeout configurável)
- [ ] **Ações de Contato (3)**: Adicionar tag · Remover tag · Atualizar campo custom
- [ ] **Ações de Mensagem (3)**: Enviar template WABA · Enviar item DS Voice · Encaminhar mensagem histórica
- [ ] **Ações de Atendimento (4)**: Transferir fila · Atribuir agente · Abrir protocolo · Fechar conversa
- [ ] **Special**: Node "Chamar DS Agente" (hand-off para IA S10)

### D. UI Editor canvas `/atendimento/ds-bot/[id]/editor`
- [ ] React Flow com zoom/pan/drag
- [ ] NodePalette à esquerda (arraste para adicionar)
- [ ] NodeConfigDrawer à direita (config do node selecionado — form específico por tipo)
- [ ] Botão "Salvar versão" (cria row em `ds_bot_versions`)
- [ ] Botão "Publicar" (toggle `enabled=true`)
- [ ] Validação visual: nodes órfãos, loops infinitos, inputs sem output

### E. Playground `/atendimento/ds-bot/[id]/playground`
- [ ] Simulação de chat mock + execução do bot
- [ ] Timeline de nodes executados com variáveis em cada passo
- [ ] Botão "Resetar" e "Exportar log"

### F. Criação em 3 formas
- [ ] **Do zero** — canvas vazio
- [ ] **De template** — biblioteca de 5 templates FIC (qualificação matrícula, agendamento visita, LGPD consent, coleta doc, pós-venda)
- [ ] **Import .json** — upload + validação

### G. Vinculação a filas (expande S3 queues)
- [ ] Campo `ds_bot_id UUID NULL` em `atendimento_queues` (já existe como `ds_agent_id` — add nova coluna)
- [ ] Config da fila: toggle "Executar bot antes de atendente" + seleção de bot

### H. Integração no webhook Meta (cirúrgica)
- [ ] Na entrada de mensagem: se conversa tem `ds_bot_execution_id` ativa → `resumeExecution`
- [ ] Se não tem e `new_conversation` ou `keyword_match` → `startExecution`
- [ ] Commit isolado, <20 linhas tocadas em `webhook/route.ts`

### I. Widget home atualizado (S7)
- [ ] Adicionar contador "Bots executando" ao widget "Agentes IA" da home

### J. Testes
- [ ] Unit: `evaluateConditional({type: 'eq', left: 'var.nome', right: 'João'}, {nome:'João'})` → true
- [ ] Unit: `executeNode` para cada tipo de node (10 testes)
- [ ] Integration: criar bot simples (bubble → input → bubble) → simular 2 mensagens → validar state machine

### K. PR
- [ ] `feat(atendimento): S11 DS Bot — visual flow builder + 20 tipos de node`
- [ ] Feature flag `ATENDIMENTO_DS_BOT_ENABLED=false` default

## Pendências externas (registrar)

- **P-140** Design dos 5 templates FIC (copy + fluxo) — Marcelo
- **P-141** Decidir quando migrar de DS Bot para DS Agente (feature flag gradual)

## Stack técnica

- `@xyflow/react` v12 + `@xyflow/controls` para canvas
- Nodes custom tipados por `type` discriminated union
- Storage flows como JSONB (evita tabela por node)
- Runtime: sync via Supabase Realtime se quiser ver execução ao vivo (opcional)

## Regras de paralelismo

1. Worktree `../eco-atnd-s11`, branch `feature/atnd-s11-ds-bot`
2. Paralelo com S10 — zero colisão
3. Memory: `project_atnd_s11.md`
4. P-IDs: P-140..P-149

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git checkout main && git pull
git worktree add ../eco-atnd-s11 -b feature/atnd-s11-ds-bot
cd ../eco-atnd-s11
pnpm install
pnpm add @xyflow/react
claude --permission-mode bypassPermissions

# Primeiro prompt: "Leia o briefing docs/sessions/BRIEFING-ATND-S11-DS-BOT.md e execute ponta-a-ponta."
```

---

*Briefing S089 · leva 3 · Plano-mestre v1*
