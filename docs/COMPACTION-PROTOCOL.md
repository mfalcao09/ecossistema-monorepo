# Protocolo de Compactação Automática de Sessão

> **Versão:** 1.0
> **Criado em:** 15/04/2026 (s098)
> **Fase:** 3.3 do Plano de Implementação v1
> **Inspiração:** `session_auto_compaction` do claw-code

---

## Problema

Quando o contexto de uma sessão atinge o limite, o Claude compacta automaticamente mensagens antigas. Sem protocolo, isso causa:
- Perda de decisões tomadas na sessão
- Perda de código escrito mas ainda não commitado
- Perda de erros encontrados e suas soluções
- Marcelo precisando repetir informações já dadas

## Solução: 3 Camadas de Preservacao

### Camada 1 — PRESERVAR SEMPRE (antes de qualquer compactacao)

Estes itens NUNCA podem ser perdidos durante uma sessao:

| Item | Por que preservar | Como preservar |
|------|-------------------|----------------|
| **Task atual** | Sem isso, nao sabe o que estava fazendo | Salvar em `agent_tasks` via `create_task()` |
| **Decisoes tomadas** | Decisoes perdidas = retrabalho | INSERT em `ecosystem_memory` tipo `decision` |
| **Codigo escrito** (path + conteudo) | Codigo nao commitado = trabalho perdido | Git commit antes de compactar |
| **Erros encontrados + solucoes** | Evita repetir investigacao | INSERT em `ecosystem_memory` tipo `feedback` |
| **Estado do sprint ativo** | Contexto de prioridades | Manter referencia ao TRACKER.md |

**Regra:** Se contexto > 80%, executar salvamento da Camada 1 IMEDIATAMENTE.

### Camada 2 — PRESERVAR SE ESPACO DISPONIVEL

| Item | Tamanho aprox. |
|------|---------------|
| Contexto do sprint ativo | ~1.500 tokens |
| Ultimas 5 memorias relevantes do Supabase | ~2.000 tokens |
| Estado do TRACKER.md | ~500 tokens |
| Permissoes do agente atual | ~300 tokens |

**Regra:** Manter se contexto < 90% apos salvar Camada 1.

### Camada 3 — DESCARTAR SEMPRE

| Item | Por que descartar |
|------|-------------------|
| Historico de raciocinio intermediario | Reconstruivel a partir das decisoes |
| Iteracoes de codigo descartadas | Ja foram substituidas pela versao final |
| Mensagens de confirmacao e ACKs | Sem valor informativo |
| Outputs longos de ferramentas ja processados | Informacao ja foi extraida |
| Conversas sobre o que fazer (pre-decisao) | A decisao final e o que importa |

---

## Protocolo de Execucao

### Trigger: Contexto > 80%

Quando o sistema detectar que o contexto esta proximo do limite:

```
1. PARAR o que esta fazendo
2. SALVAR Camada 1:
   a. Commitar codigo pendente (git add + commit)
   b. Salvar task atual no Supabase: create_task() ou update_task_status()
   c. Salvar decisoes: INSERT ecosystem_memory tipo 'decision'
   d. Salvar erros/solucoes: INSERT ecosystem_memory tipo 'feedback'
3. AVALIAR espaco restante
   - Se < 90%: manter Camada 2
   - Se >= 90%: descartar Camada 2 tambem
4. CRIAR resumo compactado com:
   - O que estava sendo feito (1 frase)
   - O que foi decidido (lista)
   - O que falta fazer (lista)
   - Arquivos modificados (paths)
5. CONTINUAR trabalho com o resumo compactado como contexto
```

### Trigger: "Vou encerrar" (fim de sessao)

Este trigger ja existe nas Regras de Sessao do CLAUDE.md. A compactacao complementa:

```
1. Executar salvamento COMPLETO (Camada 1 + 2)
2. Gerar sessao em memory/sessions/
3. INSERT no Supabase ECOSYSTEM
4. Commitar e push
```

---

## Edge Function: compact-session

**Endpoint:** `POST /functions/v1/compact-session`
**Auth:** `x-agent-secret` (SC-29)

**Input:**
```json
{
  "session_id": "s098",
  "project": "ecosystem",
  "current_task": "Implementando FASE 3.3 — Compaction Protocol",
  "decisions": [
    "Task Registry usa 8 estados",
    "Permission Model tem 5 niveis"
  ],
  "errors": [],
  "modified_files": [
    "PLANO-IMPLEMENTACAO-ECOSSISTEMA-V1.md",
    "CLAUDE.md"
  ],
  "pending_work": [
    "Commitar alteracoes",
    "Proximo: FASE 0.4"
  ]
}
```

**Output:**
```json
{
  "success": true,
  "compact_summary": "## Resumo Compactado s098\n### Task: FASE 3.3...\n### Decisoes: ...\n### Pendente: ...",
  "saved_to_supabase": true,
  "memory_id": "uuid-da-memoria"
}
```

**Logica da Edge Function:**
1. Recebe contexto da sessao
2. Salva em `ecosystem_memory` tipo `context` com tags `['compaction', 'session', project]`
3. Gera resumo compactado (texto markdown)
4. Retorna resumo para o agente usar como contexto pos-compactacao

---

## Integracao com bootstrap_session()

O `bootstrap_session()` ja retorna memorias relevantes. Apos uma compactacao:
- A memoria de compactacao fica no Supabase com tag `compaction`
- Na proxima chamada de `bootstrap_session()`, o resumo compactado aparece automaticamente
- Isso garante continuidade mesmo entre sessoes diferentes

---

## Metricas de Sucesso

| Metrica | Meta |
|---------|------|
| Decisoes perdidas por compactacao | 0 |
| Codigo nao commitado perdido | 0 |
| Tempo para retomar apos compactacao | < 30s |
| Intervencao de Marcelo necessaria | 0 |

---

## Comandos Rapidos

```sql
-- Salvar compactacao no Supabase
INSERT INTO ecosystem_memory (type, title, content, project, tags)
VALUES (
  'context',
  'Compactacao s098 — FASE 3.3',
  'Task: ...\nDecisoes: ...\nPendente: ...',
  'ecosystem',
  ARRAY['compaction', 'session', 's098']
);

-- Buscar ultima compactacao
SELECT * FROM ecosystem_memory
WHERE 'compaction' = ANY(tags) AND project = 'ecosystem'
ORDER BY created_at DESC LIMIT 1;
```
