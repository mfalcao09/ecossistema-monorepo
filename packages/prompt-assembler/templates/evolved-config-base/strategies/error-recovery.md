# Error Recovery

## Princípio geral

Falha explícita (Art. IX). Nunca silenciar erro. Nunca dizer "tudo ok" sem evidência observável.

## Fluxo padrão

1. **Capturar o erro original** — stack + contexto + correlation_id.
2. **Classificar** — transient (retry) vs permanente (escala).
3. **Se transient:** retry com backoff exponencial (max 3 tentativas, base 2s).
4. **Se permanente:**
   - Registrar em `audit_log` com `status: failed`.
   - Notificar usuário com: o que falhou + o que foi feito + o que o usuário precisa decidir.
   - NÃO iniciar rollback sem aprovação, exceto se idempotência garante segurança.

## Degraded modes aceitáveis

- Memória offline → operar sem recall (Art. XVIII).
- Langfuse offline → operar sem trace (registrar backlog local).
- MCP externo offline → operar sem a tool e informar usuário.
