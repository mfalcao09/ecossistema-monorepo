# Runbook 05 — Resposta a incidente (D-Infra + SC-27)

> **Quando:** agente/EF/serviço com erro P0-P3 em produção.
> **Dono:** D-Infra (coord) + SC-27 Incident Commander (diagnóstico).
> **Fontes canônicas:** V9 § Parte IV SC-27, ADR-005 (Langfuse), Art. IX (Falha Explícita).

## Severity triage

| Severity | Critério | Ação imediata |
|---|---|---|
| **P0** | Produção down | Fluxo crítico ( FIC boleto, Intentus assinatura ). Marcelo **agora** via WhatsApp |
| **P1** | Degradação forte | > 50% erros em 1 agente/EF. Marcelo em 15min via WhatsApp |
| **P2** | Degradação parcial | < 50% erros OU feature não crítica quebrada. Briefing diário |
| **P3** | Warning | Anomalia, tendência ruim, não afeta usuário. Log interno |

## Passo-a-passo

### 1. Triage

Quando alerta dispara (Langfuse → webhook ou D-Governanca detectou violação):

- Ler `audit_log` das últimas 2h filtrando `decision=block` ou `success=false`
- Identificar blast radius: quantos usuários/negócios afetados?
- Atribuir severity (tabela acima)

### 2. Notificar (P0/P1)

```sql
insert into approval_requests (requester_agent_id, action, payload, severity, channel)
values ('sc27-incident-commander', 'notify_incident',
        jsonb_build_object(
          'severity', '<P0|P1>',
          'title', '<1 linha>',
          'affected', '<negócios/agentes>',
          'status_page_url', '<url>'
        ),
        '<severity>', 'whatsapp');
```

Marcelo recebe via WhatsApp/Jarvis. **Não esperar resposta** para iniciar mitigação.

### 3. Diagnóstico (SC-27)

D-Infra consulta:

- **Langfuse:** traces com erro, latência p95, success rate
- **Railway metrics:** CPU, memory, deploys recentes, logs
- **Supabase dashboard:** slow queries, connection pool, disk
- **audit_log ECOSYSTEM:** violações de hook, rejections por idempotência

Identificar **root cause provável**:
- Que agente? `agent_id`
- Que EF/serviço? `tool_name`
- Que mudança recente? `prompt_version_bump` ou `deploy_id`

### 4. Mitigação imediata

Escolher a opção **menos invasiva que funciona**:

| Root cause | Mitigação |
|---|---|
| Prompt novo ruim (regressão qualidade) | Runbook 06 — rollback prompt version |
| Agente loop/allucinando | Pausar agente: `update agent_sessions set status='paused' where agent_id='<x>'` |
| EF quebrada pós-deploy | Redeploy versão anterior (runbook 03 rollback) |
| Provider LLM fora | Verificar LiteLLM fallback ativo; forçar fallback via config |
| DB lento | Kill query longa; ativar `statement_timeout` reduzido temporariamente |
| Rate limit externo | Circuit-breaker no LiteLLM |

### 5. Confirmar estabilização

Aguardar 15-30min monitorando:
- Success rate volta acima do baseline
- Erros param de crescer no `audit_log`
- Usuários afetados não reportam novos

### 6. Postmortem

**Obrigatório para P0/P1.** Criar `docs/incidents/YYYY-MM-DD-<titulo-curto>.md`:

```markdown
# Incidente YYYY-MM-DD — <título>

## Resumo
- Severity: P0 | P1 | P2 | P3
- Início: HH:MM BRT
- Detecção: HH:MM BRT
- Mitigação: HH:MM BRT
- Resolução: HH:MM BRT
- Impacto: <quem, quantos, o quê>

## Timeline
- HH:MM — <evento>
- ...

## Root cause
<explicação>

## O que foi bem
- <lista>

## O que foi mal
- <lista>

## Ação corretiva
- [ ] Abrir ADR-NNN se for mudança arquitetural
- [ ] Criar hook novo em `@ecossistema/constitutional-hooks` se for violação não pega
- [ ] Ajustar alerta/threshold no Langfuse
- [ ] Atualizar runbook pertinente
```

### 7. Ação corretiva long-term

Cada incidente P0/P1 deve gerar **pelo menos uma** das ações:
- ADR novo (se mudança arquitetural)
- Hook novo (se violação não pega pelos 11 hooks atuais)
- Ajuste de threshold/budget
- Atualização de runbook

## Critérios de sucesso

- [ ] Severity triage feito em < 5min
- [ ] Marcelo notificado em P0/P1 conforme SLA
- [ ] Mitigação aplicada em < 30min para P0, < 2h para P1
- [ ] Postmortem publicado em até 48h
- [ ] Ação corretiva mergeada em até 1 semana
