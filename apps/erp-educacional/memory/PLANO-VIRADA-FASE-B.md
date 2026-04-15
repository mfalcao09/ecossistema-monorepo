# Plano de Virada — Fase B (Supabase como Memória Primária)

**Data do plano:** 14/04/2026  
**Gatilho:** RAG Readiness Check confirmou 100% de embeddings (193/193)  
**Status:** Aguardando aprovação do Marcelo  
**Autor:** Claude (Claudinho) — verificação automatizada via scheduled task

---

## O que é a Fase B e por que importa

Hoje o sistema funciona em **dual-write (Fase A)**:
- Você escreve uma memória → ela vai para um arquivo `.md` local **E** para o Supabase ao mesmo tempo
- Claude lê a memória → lê os arquivos `.md` locais (TRACKER.md, MEMORY.md, etc.)
- O Supabase é alimentado, mas ainda não é consultado no início das sessões

A **Fase B** muda isso:
- Claude passa a **perguntar ao Supabase** no início de cada sessão, via função `bootstrap_session()`
- A função retorna automaticamente as memórias mais relevantes para aquela sessão específica
- Os arquivos `.md` locais continuam existindo como **backup de emergência** (leitura humana + fallback)
- O resultado: sessões mais rápidas, contexto mais inteligente, sem precisar ler 3 arquivos manualmente

---

## O que já está pronto (não precisa criar nada)

Antes de começar, confirmamos que toda a infraestrutura JÁ EXISTE no Supabase:

| Componente | Status | Detalhe |
|---|---|---|
| `ecosystem_memory` (tabela) | ✅ Pronta | 193 memórias, 193 com embedding |
| `bootstrap_session()` (função RPC) | ✅ Pronta | Busca semântica + keyword fallback |
| `match_ecosystem_memory()` (função) | ✅ Pronta | Busca por similaridade vetorial |
| `match_ecosystem_memory_keyword()` | ✅ Pronta | Fallback por palavras-chave |
| `increment_retrieval_count()` | ✅ Pronta | Rastreia quais memórias são mais usadas |
| RAG Engine (Railway) | ✅ Ativo | Gerando embeddings automaticamente |
| Embeddings | ✅ 100% | 193/193 memórias com vetor |

---

## Visão Geral das Mudanças

```
ANTES (Fase A — hoje)          DEPOIS (Fase B)
─────────────────────          ─────────────────
Início de sessão:              Início de sessão:
  1. Ler TRACKER.md              1. Chamar bootstrap_session()
  2. Ler sprint ativo                → Supabase retorna top-15 memórias
                                     relevantes para a tarefa
  Total: ~2.000 tokens           Total: ~800 tokens, mais inteligente

Escrita de memória:            Escrita de memória:
  1. Salvar .md local            1. INSERT no Supabase (primário)
  2. INSERT no Supabase          2. Salvar .md local (backup)
  (ordem: local primeiro)        (ordem: Supabase primeiro)
```

---

## Passo a Passo da Virada

### FASE B-1 — Preparação (pode fazer antes da sessão)

#### Passo 1 — Validar a função `bootstrap_session()` manualmente

Antes de qualquer mudança nos arquivos, testar se a função retorna resultados bons.

Execute este SQL no Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`):

```sql
select bootstrap_session(
  'diploma digital XML geração assinatura BRy',
  'erp',
  10
);
```

**O que esperar:** Um JSON com `retrieved_memories` contendo 10 memórias relevantes sobre diploma digital, XML, BRy, etc.

**Se retornar lista vazia ou irrelevante:** Não prosseguir. Investigar a função `match_ecosystem_memory_keyword` primeiro.

**Se retornar memórias relevantes:** ✅ Pode continuar para o Passo 2.

---

#### Passo 2 — Testar com o projeto Ecossistema também

```sql
select bootstrap_session(
  'agentes autônomos orquestrador ecossistema IA',
  'ecosystem',
  10
);
```

**O que esperar:** Memórias sobre o Ecossistema, agentes, arquitetura, Onda 2, etc.

---

#### Passo 3 — Criar os arquivos de backup com aviso

Antes de alterar os CLAUDE.md, adicionar um cabeçalho de aviso nos principais arquivos `.md` de memória para indicar que agora são backup:

**Arquivos para adicionar o aviso:**
- `ERP-Educacional/memory/TRACKER.md`
- `ERP-Educacional/memory/MEMORY.md`
- `Ecossistema/memory/MEMORY.md`
- `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md`

**Texto do aviso para adicionar no topo de cada um:**

```markdown
> ⚠️ FASE B ATIVA — Este arquivo é backup de emergência.
> A fonte primária de memória é o Supabase ECOSYSTEM (gqckbunsfjgerbuiyzvn).
> Para leitura humana ou quando Supabase indisponível, use este arquivo.
> Última sync automática: [data da última automação]
```

---

### FASE B-2 — Atualizar o CLAUDE.md do ERP-Educacional

**Arquivo:** `/Users/marcelosilva/Projects/GitHub/ERP-Educacional/CLAUDE.md`

#### O que mudar: Seção "Sistema de Rastreabilidade"

**ANTES (texto atual):**
```markdown
## Sistema de Rastreabilidade (Masterplan → Sprint → Sessão)
**Início de sessão (2 leituras obrigatórias):**
1. `memory/TRACKER.md` → estado atual, % por sprint, próxima sessão (~500 tokens)
2. Sprint ativo em `memory/sprints/` → escopo desta sessão (~1.500 tokens)
```

**DEPOIS (novo texto):**
```markdown
## Sistema de Rastreabilidade (Masterplan → Sprint → Sessão)

### FASE B — Supabase como memória primária

**Início de sessão (obrigatório):**
Chamar `bootstrap_session()` via Supabase MCP ANTES de qualquer trabalho:

```sql
select bootstrap_session(
  '[descrever a tarefa desta sessão em 1 frase]',
  'erp',
  15
);
```

A função retorna automaticamente as memórias mais relevantes (feedback, decisões, contexto, status de sprints). Não é mais necessário ler TRACKER.md ou arquivos de sprint manualmente — o Supabase já filtra o que importa para aquela sessão.

**Fallback (Supabase indisponível):**
1. `memory/TRACKER.md` → estado atual, % por sprint (~500 tokens)
2. Sprint ativo em `memory/sprints/` → escopo desta sessão (~1.500 tokens)

**Encerramento (7 passos):**
1. Salvar sessão com backlinks (masterplan→sprint→epic) em `memory/sessions/`
2. Atualizar sprint (✅ itens, registrar sessão)
3. Atualizar TRACKER.md (%, última/próxima sessão) — manter sync manual
4. INSERT no Supabase ECOSYSTEM (PRIORITÁRIO — fazer ANTES dos arquivos locais)
5. Atualizar MEMORY.md (rotacionar entradas, manter índice limpo)
6. Atualizar CENTRAL-MEMORY.md
7. Indicar próxima sessão se pré-planejada
```

---

### FASE B-3 — Atualizar o CLAUDE.md do Ecossistema

**Arquivo:** `/Users/marcelosilva/Projects/GitHub/Ecossistema/CLAUDE.md`

#### O que mudar: Seção "Sistema de Memória"

**ANTES (texto atual):**
```markdown
## Sistema de Memória (Orient → Work → Persist) — DUAL-WRITE
Antes de qualquer trabalho, ler nesta ordem:
1. Este arquivo (CLAUDE.md)
2. `memory/MEMORY.md` (índice de roteamento — aponta para tudo)
3. `ECOSSISTEMA-INOVACAO-IA.md` (documento-mãe com visão, arquitetura e inventário)
4. O arquivo temático relevante (architecture, preferences, sessions)
```

**DEPOIS (novo texto):**
```markdown
## Sistema de Memória — FASE B (Supabase Primário)

**Fonte da verdade:** Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`) — primário e ativo.  
**Arquivos locais:** Backup de emergência + leitura humana. Mantidos em sync pelas automações.

### Início de sessão
Chamar `bootstrap_session()` via Supabase MCP ANTES de qualquer trabalho:

```sql
select bootstrap_session(
  '[descrever a tarefa desta sessão em 1 frase]',
  'ecosystem',
  15
);
```

A função retorna as memórias mais relevantes para aquela tarefa específica.  
Não é necessário ler `MEMORY.md` ou `ECOSSISTEMA-INOVACAO-IA.md` manualmente — só quando precisar de visão geral completa.

### Fallback (Supabase indisponível)
1. Este arquivo (CLAUDE.md)
2. `memory/MEMORY.md`
3. `ECOSSISTEMA-INOVACAO-IA.md`
4. Arquivo temático relevante

### Final de sessão
Persistir SEMPRE nos dois destinos, **Supabase primeiro:**
1. INSERT em `ecosystem_memory` no Supabase ECOSYSTEM (project='ecosystem')
2. Arquivo .md em `memory/` (tipo correspondente)
```

---

### FASE B-4 — Inverter a ordem de escrita no protocolo de encerramento

Em **todos os CLAUDE.md e PROTOCOLO-MEMORIA.md**, a ordem de escrita de memória precisa ser invertida:

**ANTES:**
```
1. Salvar arquivo .md local
2. INSERT no Supabase (duplicar)
```

**DEPOIS:**
```
1. INSERT no Supabase (primário — fazer PRIMEIRO)
2. Salvar arquivo .md local (backup — confirmar que está em sync)
```

**Arquivo adicional a atualizar:**
- `/Users/marcelosilva/Projects/GitHub/PROTOCOLO-MEMORIA.md` — verificar se menciona ordem de escrita e inverter

---

### FASE B-5 — Atualizar a .auto-memory/MEMORY.md (memória do Cowork)

**Arquivo:** `/sessions/zen-brave-hypatia/mnt/.auto-memory/MEMORY.md`

Adicionar uma entrada de referência explicando que a Fase B está ativa, para que Claude saiba usar `bootstrap_session()` mesmo em sessões Cowork:

```markdown
- [reference_fase_b_supabase_primario.md](reference_fase_b_supabase_primario.md) — 🟢 FASE B ATIVA: usar bootstrap_session() no início de toda sessão ERP/Ecosystem
```

E criar o arquivo `reference_fase_b_supabase_primario.md` com:
```markdown
---
name: Fase B — Supabase como memória primária
description: RAG Engine ativo (100% embeddings). bootstrap_session() substitui leitura de TRACKER.md
type: reference
---

## Status
Fase B ativada em 14/04/2026. RAG Engine Railway: 193/193 embeddings (100%).

## Como usar no início de sessão

```sql
-- ERP
select bootstrap_session('descrever tarefa', 'erp', 15);

-- Ecossistema  
select bootstrap_session('descrever tarefa', 'ecosystem', 15);

-- Ambos (sem filtro de projeto)
select bootstrap_session('descrever tarefa', null, 20);
```

## Projeto Supabase
ID: gqckbunsfjgerbuiyzvn (us-east-2)
MCP: mcp__05dc4b38-c201-4b12-8638-a3497e112721__execute_sql

## Fallback
Se Supabase indisponível: ler TRACKER.md + sprint ativo (modo Fase A).
```

---

### FASE B-6 — Validação final antes de considerar concluído

Após todas as mudanças, executar este checklist numa sessão real de teste:

**Checklist de validação:**

- [ ] `bootstrap_session('diploma digital', 'erp', 15)` retorna ≥ 5 memórias relevantes
- [ ] `bootstrap_session('agentes ecossistema', 'ecosystem', 15)` retorna ≥ 5 memórias relevantes
- [ ] Claude abre nova sessão ERP e chama `bootstrap_session()` sem precisar ser lembrado
- [ ] Uma memória nova inserida via INSERT aparece nos resultados de `bootstrap_session()` na próxima sessão
- [ ] Arquivos `.md` locais continuam sendo atualizados (sync mantida)
- [ ] TRACKER.md continua sendo atualizado pelas automações (não foi abandonado)
- [ ] Automação `daily-cross-memory-sync` ainda funciona normalmente

---

## Resumo dos Arquivos a Modificar

| Arquivo | Mudança | Prioridade |
|---|---|---|
| `ERP-Educacional/CLAUDE.md` | Seção "Sistema de Rastreabilidade" — substituir leitura TRACKER por `bootstrap_session()` | P1 |
| `Ecossistema/CLAUDE.md` | Seção "Sistema de Memória" — atualizar para Fase B | P1 |
| `PROTOCOLO-MEMORIA.md` | Inverter ordem de escrita (Supabase primeiro) | P1 |
| `memory/TRACKER.md` | Adicionar aviso de backup no topo | P2 |
| `memory/MEMORY.md` (ERP) | Adicionar aviso de backup no topo | P2 |
| `Ecossistema/memory/MEMORY.md` | Adicionar aviso de backup no topo | P2 |
| `CENTRAL-MEMORY.md` | Adicionar aviso de backup no topo | P2 |
| `.auto-memory/MEMORY.md` | Adicionar entrada sobre Fase B | P2 |
| `.auto-memory/reference_fase_b_supabase_primario.md` | Criar arquivo de referência | P2 |

**Total:** 9 arquivos (2 alterações principais + 7 de suporte)

---

## O que NÃO muda

- As automações agendadas (daily-cross-memory-sync, plan-audit, weekly-memory-review) continuam igual
- Os arquivos `.md` locais continuam existindo e sendo atualizados
- O processo de inserção no Supabase continua o mesmo (mesmo SQL)
- A estrutura de sprints, sessões e masterplan não muda
- O protocolo de encerramento (7 passos) continua — só muda a ordem do Passo 7 (Supabase primeiro)

---

## Plano de Rollback (se algo der errado)

Se depois de ativar a Fase B algo não funcionar (ex: `bootstrap_session()` retornar resultados ruins, Supabase ficar instável), o rollback é simples:

1. Reverter os CLAUDE.md para as versões anteriores (copiar do git)
2. Continuar usando leitura de TRACKER.md + sprint ativo como antes
3. O Supabase continua sendo alimentado normalmente (dual-write mantido)
4. Investigar o problema com calma antes de tentar de novo

**O rollback não perde nada** — todos os dados continuam no Supabase e nos arquivos locais.

---

## Nota sobre novos embeddings

Toda vez que um novo INSERT é feito em `ecosystem_memory`, o Railway processa o embedding de forma assíncrona (em segundos a minutos). Portanto:

- Uma memória inserida agora pode não aparecer na busca vetorial imediatamente
- O `bootstrap_session()` tem fallback por palavras-chave — funciona mesmo sem embedding
- Após alguns minutos, o embedding é gerado e a memória aparece na busca semântica também

Isso é comportamento esperado e normal — não é um bug.

---

## Próximo Passo

Quando Marcelo confirmar que quer prosseguir, a execução começa pelo **Passo 1** (validar `bootstrap_session()` manualmente) e segue em ordem. Cada passo é confirmado antes de avançar.

**Palavra-chave para iniciar:** "Vamos ativar a Fase B"
