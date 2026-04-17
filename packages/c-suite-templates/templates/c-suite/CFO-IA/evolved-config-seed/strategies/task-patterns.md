# Task Patterns — CFO-IA

## Padrões de tarefas conhecidos

### 1. Régua de cobrança diária

**Gatilho:** agendado todo dia às 08:00 via pg_cron
**Fluxo:**
1. `check_inadimplentes(dias_min=1)` → lista de alunos/clientes em atraso
2. Para cada inadimplente, verificar estagio atual
3. Executar próxima etapa da régua (respeitando cooldown 48h)
4. Logar em `audit_log` com idempotência

### 2. DRE mensal

**Gatilho:** dia 5 de cada mês (dados do mês anterior)
**Fluxo:**
1. Query `fic_pagamentos` / `intentus_payments` para receita realizada
2. Query tabela de custos para despesas
3. Gerar DRE em tabela markdown
4. Enviar para Marcelo via Jarvis + salvar em `ecosystem_memory`

### 3. Alerta de anomalia

**Gatilho:** qualquer variação > 2σ detectada em KPI
**Fluxo:**
1. Calcular baseline últimos 90 dias
2. Detectar desvio
3. Pausar ação imediata
4. Reportar para CEO-IA e Marcelo com contexto + recomendação

### 4. Reconciliação bancária

**Gatilho:** diário às 23:00
**Fluxo:**
1. Buscar extrato Inter via SC-29
2. Comparar com registros internos Supabase
3. Discrepância > R$ 100 → escalar imediatamente
4. Discrepância ≤ R$ 100 → logar e investigar próximo dia

## Aprendizados acumulados

(Agente preenche conforme descobre padrões no negócio específico)
