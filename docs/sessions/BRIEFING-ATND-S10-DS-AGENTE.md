# BRIEFING — Atendimento S10 · DS Agente (IA autônoma OpenAI + RAG)

> **Worktree:** `../eco-atnd-s10` · **Branch:** `feature/atnd-s10-ds-agente`
> **Duração:** 5-7 dias · **Dependências:** S4 (deals) + S6 (RBAC) + S9 (DS Voice — se mergeada) em main
> **Prioridade:** P0 — **diferencial competitivo** (nenhum concorrente educacional tem agente IA com RAG de regulamento)

---

## Missão

Implementar o **DS Agente** — agente de IA autônomo integrado ao OpenAI GPT-4o + RAG (base de conhecimento FIC) que responde alunos automaticamente dentro do chat, com regras de ativação por tag, hand-off inteligente para humano, parâmetros configuráveis e logging completo. Substitui a primeira camada de atendimento da Secretaria em dúvidas comuns (matrícula, regulamento, horários).

## Por que importa

Os 4 atendentes FIC respondem 200+ mensagens/dia, 70% sobre matrícula/regulamento/grade (perguntas repetitivas). DS Agente com RAG treinado no regulamento + FAQ FIC resolve 40-50% dessas automaticamente, liberando atendentes para casos complexos. **Impacto:** 2h/atendente/dia economizadas + NPS maior (resposta em <5s vs. 5-30min).

## Leituras obrigatórias

1. `CLAUDE.md` (raiz)
2. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — Parte 4 Sprint S10 + Parte 2.3 seção K (DS Agente — 11 features)
3. `docs/sessions/CHECKLIST-POS-LEVA-1.md` — estado operacional atual
4. `docs/sessions/PENDENCIAS.md` — última pendência é P-112; suas novas usam P-130+
5. **Benchmark visual** — abra README + transcrição:
   - `docs/research/nexvy-whitelabel/y3CFR97J2Bo/` (CRM "burro" vs Inteligente — 109 frames com demo IA)
6. **Packages reutilizáveis (IMPORTANTE):**
   - `packages/agentes/` — `@ecossistema/agentes` (prompts Claudinho + C-Suite) → reuse padrão de system prompts
   - `packages/rag/` — `@ecossistema/rag` (cliente RAG Railway) → usar para ingestion + retrieval
   - `packages/credentials/` — `@ecossistema/credentials` (SC-29 vault) → para `OPENAI_API_KEY`
7. **Schema atual**: `permissions-constants.ts` já tem `ds_ai` como módulo — suas permissões entram aí

## Avisos pré-código (aprendidos com S7-S9)

1. **permissions-constants.ts**: módulo `ds_ai` JÁ EXISTE. Adicione apenas grants no `scripts/seed_atendimento_permissions.py` (Admin tudo; Atendente view/create/edit; restrito só view).
2. **Integração webhook Meta**: seu hook de IA vai DEPOIS de runAutomations (S8a) e DEPOIS de DS Voice triggers (S9). Edição cirúrgica em `webhook/route.ts`, commit próprio.
3. **Storage de embeddings**: Supabase pgvector (instalar extensão na migration). Evita Pinecone/Weaviate externo.
4. **OpenAI SDK**: usar `openai` npm (não `@ai-sdk/openai` — Claudinho e outros agentes usam `openai` direto).
5. **Layout.tsx**: adicionar "DS Agente" como item de menu, feature flag `ATENDIMENTO_DS_AGENTE_ENABLED`.
6. **Feature flag dupla**: `ATENDIMENTO_DS_AGENTE_ENABLED` (server) + `NEXT_PUBLIC_ATENDIMENTO_DS_AGENTE_ENABLED` (client).

## Escopo preciso (EXCLUSIVO seu)

- `apps/erp-educacional/src/app/(erp)/atendimento/ds-agente/**` — UI (lista, config, playground, logs)
- `apps/erp-educacional/src/components/atendimento/ds-agente/**`
- `apps/erp-educacional/src/app/api/atendimento/ds-agentes/**`
- `apps/erp-educacional/src/app/api/atendimento/ds-agentes/[id]/knowledge/**` — upload docs RAG
- `apps/erp-educacional/src/app/api/atendimento/ds-agentes/[id]/execute` — inferência + hand-off
- `apps/erp-educacional/src/lib/atendimento/openai-client.ts` — wrapper (com vault creds)
- `apps/erp-educacional/src/lib/atendimento/rag-client.ts` — wrapper do `@ecossistema/rag`
- `apps/erp-educacional/src/lib/atendimento/ds-agente-runner.ts` — motor de execução (tag check → contexto → RAG → LLM → hand-off)
- `infra/supabase/migrations/20260429_atendimento_s10_ds_agente.sql`
- `apps/erp-educacional/docs/PENDENCIAS-S10.md`

## NÃO MEXA (território de outras sessões)

- Nenhuma outra rota `/atendimento`
- `permissions.ts` (server) — só adicione grants via seed Python
- `tailwind.config.ts`, `package.json` deps pesadas sem necessidade
- `ChatPanel.tsx` — apenas 1 linha adicional no hover (placeholder "DS Agente sugeriu...") se quiser

## Entregas obrigatórias (checklist)

### A. Migration SQL (4 tabelas + pgvector)
- [ ] `CREATE EXTENSION IF NOT EXISTS vector;` (pgvector em ECOSYSTEM)
- [ ] `ds_agents` (id, account_id NULL, name, description, system_prompt TEXT, model VARCHAR='gpt-4o-mini', temperature NUMERIC=0.7, max_tokens INT=200, max_history INT=10, delay_seconds INT=2, activation_tags UUID[], tag_logic VARCHAR='OR', channels VARCHAR[], split_messages BOOL=true, process_images BOOL=false, handoff_on_human BOOL=true, enabled BOOL, created_by, created_at)
- [ ] `ds_agent_knowledge` (id, agent_id FK, title, content TEXT, embedding vector(1536), source_url TEXT NULL, created_at)
- [ ] `ds_agent_executions` (id, agent_id FK, conversation_id FK, message_id FK NULL, input_text TEXT, rag_chunks JSONB, output_text TEXT, tokens_used INT, latency_ms INT, handoff_triggered BOOL, error TEXT NULL, executed_at TIMESTAMPTZ)
- [ ] Índice HNSW em `ds_agent_knowledge.embedding` para busca vetorial rápida
- [ ] RLS permissiva (P-130 aperta quando multi-tenant)

### B. `openai-client.ts` (server-only)
- [ ] Busca `OPENAI_API_KEY` via `@ecossistema/credentials` (fail-fast se ausente)
- [ ] Funções: `generateEmbedding(text)`, `chatCompletion(messages, params)`, `splitMessageNaturally(text)` (quebra em 2-3 mensagens estilo humano)

### C. RAG (via `@ecossistema/rag` OU pgvector direto)
- [ ] `ingestKnowledge(agent_id, title, content)` — chunk texto (500-800 tokens) + embedding + insert em `ds_agent_knowledge`
- [ ] `retrieveRelevantChunks(agent_id, query, top_k=5)` — cosine similarity
- [ ] Upload de arquivos (PDF/DOCX/TXT) via `/api/atendimento/ds-agentes/[id]/knowledge`

### D. Motor de execução `ds-agente-runner.ts`
- [ ] `shouldActivate(conversation, agent)` — check tags com lógica AND/OR
- [ ] `shouldHandoff(conversation, agent)` — se agent humano respondeu nas últimas N mensagens, desativa
- [ ] `buildContext(conversation, limit=10)` — últimas N mensagens formatadas
- [ ] `runAgent(conversation, incoming_message)`:
  1. Checa regras de ativação
  2. Busca chunks RAG relevantes
  3. Monta prompt (system + RAG + histórico + pergunta)
  4. Chama OpenAI
  5. Split se `split_messages=true`
  6. Envia via `sendMessage` (reusa lib existente)
  7. Log em `ds_agent_executions`

### E. UI `/atendimento/ds-agente`
- [ ] Lista de agentes (cards) + toggle ativo/inativo + badge execuções últimas 24h
- [ ] "+ Novo Agente" → wizard 4 steps:
  - Step 1: nome + descrição + modelo
  - Step 2: system prompt (editor com preview + templates FIC sugeridos)
  - Step 3: parâmetros (temperature, max_tokens, max_history, delay, toggles)
  - Step 4: ativação (tags com matriz AND/OR + canais + handoff config)
- [ ] Aba "Base de Conhecimento" — upload de documentos + listagem chunks + teste de retrieval
- [ ] Aba "Playground" — input manual + vê resposta + chunks retrieved + latência
- [ ] Aba "Logs" — tabela `ds_agent_executions` paginada + filtros

### F. Ingestion FIC inicial (seed)
- [ ] Script `scripts/seed_fic_knowledge.py` que ingesta:
  - Regulamento acadêmico (PDF existente)
  - FAQ matrícula (Marcelo fornece markdown)
  - Grade curricular por curso (JSON)
  - Calendário acadêmico 2026
- [ ] Cria agente "FIC Secretaria" com tag `matricula` OR `duvida` → handoff ao humano se cliente pedir

### G. Integração no webhook Meta (cirúrgica)
- [ ] Após `runAutomations` (S8a) e triggers DS Voice (S9), chamar `runAgent(conversation, message)` fire-and-forget
- [ ] Commit isolado — 1 arquivo tocado, <15 linhas

### H. Widget home (placeholder S7 atualizado)
- [ ] Atualizar widget "Agentes IA" no DashboardHome (S7): contador real de agentes ativos + execuções últimas 24h + erros

### I. Testes
- [ ] Unit: `shouldActivate(conversation_com_tag_matricula, agent_com_tag_matricula)` → true
- [ ] Unit: `shouldHandoff(conversation_agente_humano_5min_atras, agent_handoff_on=true)` → true
- [ ] Integration: `runAgent` com prompt fake + mock OpenAI → registra execução em `ds_agent_executions`

### J. PR
- [ ] `feat(atendimento): S10 DS Agente — OpenAI GPT-4o + RAG + hand-off inteligente`
- [ ] Feature flag `ATENDIMENTO_DS_AGENTE_ENABLED=false` default
- [ ] Custo estimado por execução na descrição (~$0.01 por resposta com gpt-4o-mini)

## Pendências externas (você registra, Marcelo executa)

- **P-130** Cadastrar `OPENAI_API_KEY` no vault ECOSYSTEM (ou usar a já existente se tiver)
- **P-131** Upload do regulamento acadêmico FIC em PDF para Marcelo, rodar `seed_fic_knowledge.py`
- **P-132** Definir ativação do agente piloto em dev → staging → prod após validação E2E
- **P-133** Moderação: criar guardrails para o agente (ex: "nunca prometa preços/descontos específicos")

## Stack técnica

- **LLM**: OpenAI `gpt-4o-mini` (custo/qualidade ótimos) via `openai` npm
- **Embeddings**: `text-embedding-3-small` (1536 dim)
- **Vector store**: Supabase pgvector (HNSW index)
- **Chunking**: texto recursivo por parágrafo, overlap 100 tokens
- **SDK**: `openai` npm direto (não AI SDK)

## Regras de paralelismo

1. Worktree `../eco-atnd-s10`, branch `feature/atnd-s10-ds-agente`
2. Paralelo com S11 (DS Bot) — zero colisão
3. Memory: `project_atnd_s10.md`
4. P-IDs: P-130..P-139

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git checkout main && git pull
git worktree add ../eco-atnd-s10 -b feature/atnd-s10-ds-agente
cd ../eco-atnd-s10
pnpm install
pnpm add openai
claude --permission-mode bypassPermissions

# Primeiro prompt: "Leia o briefing docs/sessions/BRIEFING-ATND-S10-DS-AGENTE.md e execute ponta-a-ponta."
```

---

*Briefing S089 · leva 3 · Plano-mestre v1 com aprendizados da leva 2*
