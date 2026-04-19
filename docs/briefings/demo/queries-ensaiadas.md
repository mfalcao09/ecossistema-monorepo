# Queries Ensaiadas — Demo Fase 0

Copiar direto no Supabase Studio SQL Editor antes da demo.

---

## Q1 — Audit log da última conversa

```sql
-- Substituir <trace_id> pelo correlation ID do último evento SSE
select
  tool_name,
  action,
  article_ref,
  decision,
  reason,
  agent_id,
  created_at
from audit_log
where trace_id = '<trace_id>'
order by created_at;
```

**Resultado esperado:** 10–20 linhas mostrando cada tool use, o artigo que verificou, e a decisão (allow/block).

---

## Q2 — Histórico de memória do CFO-FIC com Marcelo

```sql
select
  content,
  memory_type,
  importance,
  agent_id,
  created_at
from memory_semantic
where user_id = 'marcelo'
  and agent_id = 'cfo-fic'
order by created_at desc
limit 10;
```

**Resultado esperado:** últimas memórias gravadas pelo CFO-FIC — preferências, decisões tomadas, contexto de sessões anteriores.

---

## Q3 — Últimas aprovações HITL pendentes

```sql
select
  id,
  agent_id,
  tool_name,
  payload->>'amount' as valor,
  payload->>'reason' as motivo,
  status,
  created_at
from hitl_approvals
order by created_at desc
limit 5;
```

**Resultado esperado:** última ação bloqueada pelo Art. II com status `pending`.

---

## Q4 — Budget consumido por agente (últimas 24h)

```sql
select
  agent_id,
  sum((metadata->>'cost_usd')::numeric) as total_usd,
  count(*) as n_calls,
  max(created_at) as ultima_chamada
from audit_log
where created_at > now() - interval '24 hours'
  and action = 'llm_call'
group by agent_id
order by total_usd desc;
```

**Resultado esperado:** custo por agente nas últimas 24h — mostrar que CFO-FIC está abaixo do budget configurado.

---

## Q5 — Verificar que audit_log é imutável (tentar deletar)

```sql
-- Esta query VAI FALHAR — é o ponto da demo
delete from audit_log where id = (select id from audit_log limit 1);
```

**Resultado esperado:** `ERROR: Audit log entries cannot be deleted (Art. IV)`

---

## Q6 — Estado das credenciais (sem expor valores)

```sql
select
  name,
  service,
  business_id,
  created_at,
  updated_at,
  -- NUNCA mostrar encrypted_value
  case when encrypted_value is not null then '***cifrado***' else 'ausente' end as status
from credentials_v2
order by service, name;
```

**Resultado esperado:** lista de credenciais registradas com status cifrado — valores nunca aparecem.

---

## Q7 — Últimas consolidações de memória

```sql
select
  user_id,
  agent_id,
  memories_processed,
  patterns_extracted,
  started_at,
  completed_at,
  (extract(epoch from (completed_at - started_at)))::int as duracao_s
from memory_consolidation_runs
order by started_at desc
limit 5;
```

**Resultado esperado:** histórico de quando o Memory Consolidator rodou — mostra o sistema aprendendo automaticamente.

---

## Q8 — Saúde geral do sistema (dashboard rápido)

```sql
select
  'audit_log' as tabela, count(*) as registros from audit_log
union all
select 'memory_semantic', count(*) from memory_semantic
union all
select 'memory_episodic', count(*) from memory_episodic
union all
select 'credentials_v2', count(*) from credentials_v2
union all
select 'hitl_approvals', count(*) from hitl_approvals
order by tabela;
```

**Resultado esperado:** overview de quantos registros existem em cada tabela — prova que o sistema está sendo usado.
