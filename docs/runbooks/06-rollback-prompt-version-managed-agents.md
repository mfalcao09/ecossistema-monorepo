# Runbook 06 — Rollback de prompt version (Managed Agents)

> **Quando:** nova versão de prompt degradou qualidade de um agente.
> **Dono:** D-Infra + D-Governanca.
> **Fontes canônicas:** ADR-001 (Managed Agents), V9 § Parte VIII §28 (padrão 5).

## Pré-requisitos

- [ ] Acesso à API Managed Agents com credenciais do ecossistema
- [ ] `agent_id` do agente degradado
- [ ] Número da versão atual (`N`) e anterior (`N-1`)
- [ ] Dashboards Langfuse abertos para monitoramento

## Gatilhos que acionam este runbook

- Queda súbita de success rate no Langfuse (> 20% abaixo do baseline 7d)
- Aumento de violações de hooks constitucionais para o mesmo agente
- Reclamação direta de Marcelo / usuário final
- Regressão em eval automatizado pós-merge de prompt

## Passo-a-passo

### 1. Identificar versão problemática

Via Langfuse ou dashboard Anthropic:

```bash
# Listar versões
curl -s https://api.anthropic.com/v1/agents/<agent_id>/prompts \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

Confirmar que versão `N` é pior que `N-1` usando:
- `success_rate` últimas 100 sessões em cada versão
- Média de violações de hook por sessão
- Feedback explícito de Marcelo

### 2. Pinar sessões novas na versão anterior

Managed Agents não desfaz versão; **cria pinning**. Fluxo:

```python
# Marca policy default para novas sessions:
# (via SDK — método oficial conforme cookbook `CMA_prompt_versioning_and_rollback.ipynb`)
client.agents.set_default_version(agent_id="<agent_id>", version=N-1)
```

Novas sessões passam a usar `N-1`. Sessões já abertas em `N` podem continuar — se bug for severo, encerrar sessões em `N` via dashboard.

### 3. Monitoramento 1h

Em Langfuse, observar:
- Success rate volta ao baseline?
- Violações de hook caem?
- Latência normal?

Se **SIM** → rollback estabilizou. Seguir passo 4.
Se **NÃO** → problema não era o prompt; voltar ao runbook 05 (incidente).

### 4. Decisão permanente

Duas opções:

**A) Manter `N-1` como versão ativa indefinidamente.** `set_default_version` permanece.

**B) Iterar `N+1`:** criar novo prompt corrigindo o problema, testar em eval, promover.

```python
client.agents.update(agent_id="<agent_id>", prompt=novo_prompt)
# cria versão N+1 automaticamente
# deixar default em N-1 até eval confirmar N+1 é melhor
```

### 5. Registrar learning

Abrir issue GitHub ou entry em `docs/incidents/prompt-regressions/YYYY-MM-DD-<agent>.md`:

```markdown
## Regressão prompt <agent_id> v<N>

**Sintoma:** <o que piorou>
**Root cause:** <qual mudança no prompt causou>
**Learning:** <o que levar para próxima iteração>
**Eval case adicionado:** <link para eval Langfuse>
```

### 6. Atualizar eval suite

Para evitar regressão futura do mesmo padrão, adicionar caso ao eval do agente:

- Em Langfuse Evals: criar dataset item que capture o comportamento desejado
- Rodar eval antes de promover qualquer `N+2`

### 7. Notificar D-Governanca

Entry no briefing diário: "Rollback de prompt de `<agent_id>` de v`N` → v`N-1`. Causa: `<resumo>`. Novo eval case adicionado."

## Critérios de sucesso

- [ ] Success rate de `<agent_id>` voltou ao baseline (± 5%) em 1h
- [ ] Violações de hook caíram para nível pré-N
- [ ] Postmortem curto registrado em `docs/incidents/prompt-regressions/`
- [ ] Eval case adicionado ao dataset do agente
- [ ] Briefing diário menciona o rollback

## Notas

- Managed Agents mantém histórico de todas as versões — rollback é barato e seguro
- Prefira ajustar via **novo prompt N+1** em vez de "editar N" — versioning é imutável por design
- Se o prompt degradado era herdado de template (`packages/c-suite-templates/`), a correção volta ao template após validar em um agente piloto
