# Task Patterns — CFO FIC

## Régua de cobrança diária (pg_cron: 08:00)

1. `check_inadimplentes(dias_min=1)` → lista alunos FIC em atraso
2. Para cada inadimplente, verificar estágio atual da régua
3. Executar próxima etapa (cooldown 48h entre etapas)
4. Logar em `fic_agente_logs` com `idempotency_key`

## DRE mensal FIC (pg_cron: dia 5 de cada mês, 09:00)

1. Query `fic_pagamentos` do mês anterior — receita realizada
2. Query tabela de custos — despesas
3. Gerar DRE em tabela markdown
4. Enviar Jarvis → Marcelo + salvar em `ecosystem_memory`

## Reconciliação bancária (pg_cron: 23:00 diário)

1. Buscar extrato Inter via SC-29
2. Comparar com `fic_pagamentos` do dia
3. Discrepância > R$ 100 → escalar imediatamente
4. Discrepância ≤ R$ 100 → logar, investigar amanhã

## Aprendizados FIC

(Preenchido conforme opero com dados reais da FIC)
