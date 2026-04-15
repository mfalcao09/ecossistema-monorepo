# BRIEFING — Sessão C · Orchestrator (FastAPI no Railway)

> **Para copiar e colar no início da sua sessão Claude Code**
> **Worktree:** `../eco-C` · **Branch:** `feature/C-orchestrator`
> **Duração estimada:** 3-4 dias · **Dependências:** A e B em ~80% · **Prioridade:** P0

---

## Missão

Criar `apps/orchestrator` — um servidor FastAPI rodando no Railway que expõe os Anthropic Managed Agents (Claudinho + C-Suite) via HTTP. Isso tira os agentes do "off-line / CLI Cowork" e permite chamá-los de qualquer canal (WhatsApp, webhook, frontend, cron).

## Por que é crítica

Hoje Claudinho só existe em sessão Code local. Marcelo quer evoluir para E2 Jarvis (WhatsApp) e E3/E4 (voz/always-on). Tudo isso depende de ter um endpoint HTTP. Esta é a **porta de entrada** do ecossistema.

## Leituras obrigatórias

1. `CLAUDE.md` e `MEMORY.md` na raiz
2. `docs/masterplans/PLANO-EXECUCAO-V4.md` seções 1 (D1), 3 (diagrama), 4 (Sprint 0.2)
3. `docs/adr/001-parallelism.md`
4. Código existente do orchestrator antigo em `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/agentes/claudinho_orchestrator.py` (1.542 linhas — inspiração, não cópia)
5. Docs Anthropic Managed Agents: https://docs.anthropic.com/en/api/managed-agents

## Escopo preciso

**Pode mexer:**
- `apps/orchestrator/**`
- `infra/railway/orchestrator.*`
- `docs/sessions/LOG-SESSAO-C-YYYYMMDD.md`

**NÃO pode mexer:**
- Packages (consumir como dependências via `workspace:*`)
- Outros apps

## Entregas

### E1. FastAPI skeleton
`apps/orchestrator/src/main.py`:
```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Ecossistema Orchestrator", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/agent/{agent_name}/invoke")
async def invoke_agent(agent_name: str, payload: InvokeRequest):
    # chama Managed Agent apropriado, stream de volta
    ...
```

### E2. Managed Agents client
Wrapper em torno do SDK `anthropic` para criar/atualizar/chamar agents. Usa IDs persistidos em Supabase ECOSYSTEM (tabela `agent_registry` — criar se não existir).

### E3. Roteamento por agente
Endpoints:
- `POST /agent/claudinho/invoke` → Opus orquestrador
- `POST /agent/{cfo,cao,cto,cmo,cso,clo,coo}/invoke` → Sonnet diretor
- `GET /agents/list` → lista agents ativos e versões

### E4. Integração com memory + task-registry
- Toda chamada de agente **cria um task** em `agent_tasks` (usa Sessão B)
- Toda resposta do agente **grava 1 memória** em `ecosystem_memory` (usa Sessão A)
- `bootstrap_session()` chamado no início de cada invocation para contextualizar

### E5. Autenticação
Header `x-agent-secret` com token via SC-29. Rate limiting básico.

### E6. Deploy Railway
- `Dockerfile` ou `nixpacks.toml`
- Env vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `AGENT_SECRET`
- Custom domain: `orchestrator.ecossistema.dev` (ou subdomínio Railway)

### E7. Habilitar callable_agents
Assim que Marcelo confirmar que o acesso Managed Agents inclui Research Preview, descomentar o bloco que conecta Claudinho aos 7 diretores como `callable_agents`.

## Critério de aceite final

```bash
curl -X POST https://orchestrator-ecossistema.up.railway.app/agent/claudinho/invoke \
  -H "x-agent-secret: $AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá Claudinho, que dia é hoje?"}'
```
Retorna resposta do Claudinho. A chamada cria 1 task e 1 memória. Marcelo consegue ver ambas no Supabase.

## Dependências

- Sessão A (memory) — precisa do package `@ecossistema/memory` importável
- Sessão B (task-registry) — precisa do package `@ecossistema/task-registry` importável
- **Estratégia:** começar com stubs locais (mocks); integrar quando A e B estiverem merged

## Protocolo de encerramento

1. `docs/sessions/LOG-SESSAO-C-YYYYMMDD.md`
2. `MEMORY.md` atualizado
3. Commit + push `feature/C-orchestrator`
4. Não mergear em main até A e B estarem integrados
