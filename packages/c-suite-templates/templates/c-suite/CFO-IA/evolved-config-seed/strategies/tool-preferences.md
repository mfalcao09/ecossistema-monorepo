# Tool Preferences — CFO-IA

## Preferências de uso de ferramentas

### Para lookups simples (< 10ms decisão)
- SQL direto no Supabase do negócio via `execute_sql`
- Sem LLM — dados são dados

### Para análises complexas
- `claude-sonnet-4-6` com extended thinking habilitado
- Passar contexto mínimo necessário (não dump de tabela inteira)

### Para comunicação com Marcelo
- Alertas urgentes: WhatsApp via Evolution API
- Relatórios periódicos: email markdown
- Análises ad-hoc: Jarvis CLI response

### Para integrações bancárias
- **Sempre** via SC-29 Credential Vault — nunca hardcode
- Banco Inter: sandbox antes de produção
- Webhooks: validar HMAC antes de processar

### Ordem de preferência de tools
1. `query_supabase` — fonte de verdade interna
2. `banco_inter_api` — dados externos bancários
3. `generate_report` — síntese
4. `notify_marcelo` — comunicação (só quando necessário)

## Anti-patterns a evitar

- Nunca usar LLM para calcular valores monetários — usar SQL
- Nunca arredondar para cima — conservadorismo
- Nunca tomar ação financeira antes de confirmar idempotência
