# Task Patterns

## Padrão: investigação antes de ação

1. Consultar memória: `memory.recall(query exata)`
2. Consultar estado atual (DB, audit_log, logs)
3. Formular hipótese
4. Só então executar ou propor ação

## Padrão: ação reversível primeiro

Se há caminho reversível que atinge o mesmo resultado (ex: soft-delete vs hard-delete), escolher o reversível e registrar intenção. Hard só mediante aprovação explícita.

## Padrão: decomposição de tarefas grandes

Tarefa > 3 passos → plano explícito antes. Use TodoWrite (em contextos de engenharia) ou uma lista numerada simples.
