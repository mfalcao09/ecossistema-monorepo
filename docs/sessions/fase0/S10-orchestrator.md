# S10 — Orchestrator FastAPI (Railway)

**Sessão:** S10 · **Dia:** 2 · **Worktree:** `eco-orchestrator` · **Branch:** `feature/orchestrator`
**Duração estimada:** 1 dia (8h) · **Dependências:** Managed Agents API key, S1 hooks (stubs ok), S2 assembler (stubs ok)
**Bloqueia:** S16 (Piloto CFO-FIC), S17 (Validação E2E)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte III** (4 camadas), **§ Parte X** (Jarvis 4-stage)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — phantom runtime + Claude Agent SDK
3. `research-repos/phantom/src/agent/runtime.ts` — referência de SDK wrapper production-grade
4. `research-repos/claude-agent-sdk-python/src/claude_agent_sdk/query.py` + `client.py`
5. Cookbook: `research-repos/claude-cookbooks/managed_agents/CMA_operate_in_production.ipynb`
6. FastAPI docs: SSE pattern com `EventSourceResponse`

---

## Objetivo

Criar `apps/orchestrator/` — **FastAPI no Railway** que expõe Managed Agents via HTTP/SSE. É o **ponto de entrada único** para todos os agentes (Claudinho, C-Suite, Diretores).

---

## Escopo exato

```
apps/orchestrator/
├── pyproject.toml
├── Dockerfile
├── railway.json
├── README.md
├── src/
│   └── orchestrator/
│       ├── __init__.py
│       ├── main.py                  # FastAPI app
│       ├── config.py                # env vars
│       ├── agents/
│       │   ├── __init__.py
│       │   ├── factory.py           # create agent from AgentDefinition
│       │   ├── registry.py          # in-memory registry of agents
│       │   └── runtime.py           # core run loop (phantom-inspired)
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── agents.py            # /agents/... endpoints
│       │   ├── webhooks.py          # /webhooks/...
│       │   ├── sessions.py          # session resume
│       │   └── health.py
│       ├── hooks/
│       │   ├── __init__.py
│       │   └── loader.py            # carrega @ecossistema/constitutional-hooks
│       ├── prompt/
│       │   ├── __init__.py
│       │   └── assembler.py         # wrapper do @ecossistema/prompt-assembler
│       ├── clients/
│       │   ├── __init__.py
│       │   ├── litellm.py           # cliente LiteLLM proxy
│       │   ├── langfuse.py          # trace emitter
│       │   ├── memory.py            # cliente @ecossistema/memory (via HTTP?)
│       │   └── credentials.py       # cliente SC-29 Modo B
│       └── security/
│           ├── __init__.py
│           └── wrapping.py          # [SECURITY]...[/SECURITY] bookends (phantom)
└── tests/
    ├── test_agents.py
    ├── test_sse.py
    ├── test_resume.py
    └── test_hitl.py
```

---

## Decisões-chave

1. **Python 3.12** — compat com `claude-agent-sdk-python`
2. **FastAPI + uvicorn** em Railway
3. **SSE para streaming** agentes (melhor UX que WebSocket para stream unidirecional)
4. **Session persistence** via `claude-agent-sdk` nativo (arquivo) + mirror em Supabase `ecosystem_sessions`
5. **Hooks via bridge HTTP** — como `@ecossistema/constitutional-hooks` é TypeScript, orchestrator chama via Edge Function ou via cliente HTTP local (decidir: opção B — spawn Node child process `node hooks-bridge.mjs`)
6. **Agent registry** carregado de Supabase `agents_registry` table (próxima sessão criará) ou YAML local inicial

---

## Spec endpoints

### `POST /agents/{agent_id}/run` — streaming SSE

```
POST /agents/cfo-fic/run
Content-Type: application/json
Authorization: Bearer <jwt_or_owner_token>

{
  "query": "Quantos alunos estão inadimplentes há mais de 15 dias?",
  "user_id": "marcelo",
  "session_id": "optional-resume-id",
  "context": { "channel": "whatsapp", ... }
}
```

Response: `text/event-stream`:
```
event: init
data: {"session_id":"uuid","agent":"cfo-fic","model":"claude-sonnet-4-6"}

event: thinking
data: {"text":"Consultando base de alunos..."}

event: tool_use
data: {"tool":"check_inadimplentes","input":{"dias_min":15}}

event: tool_result
data: {"tool":"check_inadimplentes","result":{"count":42}}

event: assistant_message
data: {"text":"Existem 42 alunos inadimplentes há mais de 15 dias..."}

event: end
data: {"total_tokens":1342,"cost_usd":0.0021,"trace_id":"lf-xxx"}
```

### `POST /agents/{agent_id}/resume` — retoma sessão

```json
{
  "session_id": "uuid",
  "message": "continua"
}
```
Retorna SSE igual ao `/run`.

### `POST /webhooks/status-idled` — HITL cookbook pattern

Managed Agents chama este endpoint quando sessão entra em `status_idled` (aguardando aprovação humana):

```json
{
  "session_id": "uuid",
  "agent_id": "cfo-fic",
  "requires_action": {
    "type": "approval",
    "summary": "CFO-FIC quer emitir 42 boletos totalizando R$ 42.500 — Art. II aprovação necessária",
    "tool_input_hash": "...",
    "approval_url": "https://approvals.ecossistema.internal/req/xxx"
  }
}
```
Orchestrator:
1. Grava em `approval_requests` (Supabase)
2. Notifica via WhatsApp (Evolution API) → Marcelo
3. Retorna 200 — Managed Agents aguarda
4. Quando Marcelo responde via WhatsApp → webhook resume sessão

### `GET /agents` — lista agentes registrados
```json
[
  {"id":"claudinho","model":"claude-opus-4-7","role":"VP Executivo"},
  {"id":"cfo-fic","model":"claude-sonnet-4-6","role":"CFO FIC","business":"fic"},
  ...
]
```

### `GET /sessions/{id}` — inspecionar sessão
Retorna histórico + tokens + custo (dados do Langfuse + sessão SDK).

### `GET /health`
```json
{"status":"ok","litellm":"up","memory":"up","credentials":"up","langfuse":"up"}
```

---

## Spec do `runtime.py` — core run loop

```python
from claude_agent_sdk import query, ClaudeSDKClient
from claude_agent_sdk.types import AgentDefinition, PermissionMode

class AgentRuntime:
    def __init__(self, agent_id: str, config: AgentConfig):
        self.agent_id = agent_id
        self.config = config
        self.assembler = PromptAssembler(config)
        self.hooks = HooksBridge()
        self.memory = MemoryClient()
        self.litellm = LiteLLMClient()
        self.langfuse = LangfuseClient()

    async def run(self, req: RunRequest) -> AsyncIterator[RuntimeEvent]:
        # 1. Recall memory
        memories = await self.memory.recall(query=req.query, filters={...})
        
        # 2. Assemble prompt (9-layer)
        assembled = await self.assembler.assemble(
            agent_config=self.config,
            query_context=QueryContext(
                query=req.query, user_id=req.user_id, session_id=req.session_id,
                memories=memories,
            )
        )
        
        # 3. Start Langfuse trace
        trace = self.langfuse.trace(name=f"{self.agent_id}:run", session_id=req.session_id)
        
        # 4. Security wrap (phantom pattern)
        wrapped_query = wrap_security(req.query, direction='inbound')
        
        # 5. Run via Claude Agent SDK
        async with ClaudeSDKClient(
            model=self.config.model,
            system_prompt={"type": "preset", "preset": "claude_code", "append": assembled.system_prompt},
            permission_mode=self.config.permission_mode or "default",
            # MCPs do ecossistema
            mcp_servers=self._load_mcps(),
            # Session persistence
            persist_session=True,
            resume=req.session_id,
            # Hooks bridge
            hooks={
                "preToolUse": self.hooks.pre_tool_use,
                "postToolUse": self.hooks.post_tool_use,
                "sessionEnd": self.hooks.session_end,
            },
        ) as client:
            async for event in client.stream(wrapped_query):
                # Emit SSE event
                yield self._to_runtime_event(event)
                # Log to Langfuse
                trace.span(name=event.type, input=event.payload)
        
        trace.end()
```

---

## Hooks Bridge — TypeScript hooks no Python

Como `@ecossistema/constitutional-hooks` é TS, usamos uma bridge HTTP ou child process.

**Escolha:** Child process Node ouvindo stdin/stdout (simples e rápido, zero HTTP):

```python
# hooks/loader.py
import asyncio, json

class HooksBridge:
    def __init__(self):
        self.proc = None

    async def _ensure_proc(self):
        if self.proc: return
        self.proc = await asyncio.create_subprocess_exec(
            'node', 'hooks_bridge.mjs',
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        )

    async def pre_tool_use(self, ctx: dict) -> dict:
        await self._ensure_proc()
        self.proc.stdin.write((json.dumps({"hook":"preToolUse","ctx":ctx}) + "\n").encode())
        await self.proc.stdin.drain()
        line = await self.proc.stdout.readline()
        return json.loads(line)
```

E `hooks_bridge.mjs`:
```javascript
import * as hooks from '@ecossistema/constitutional-hooks';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  const { hook, ctx } = JSON.parse(line);
  const result = await hooks[hook](ctx);
  console.log(JSON.stringify(result));
}
```

Alternativa: expor hooks como Edge Function HTTP (mais caro mas isolado).

---

## Session persistence

SDK já persiste sessão local. Mirror em Supabase:

```sql
create table ecosystem_sessions (
    id uuid primary key,
    agent_id text not null,
    business_id text not null,
    user_id text,
    sdk_session_id text,        -- id interno do claude-agent-sdk
    state jsonb,                -- state atual (permission_mode, etc.)
    started_at timestamptz,
    ended_at timestamptz,
    total_tokens int,
    total_cost_usd numeric,
    created_at timestamptz default now()
);
```

Insert ao `/run`, update ao `/resume`, finalize ao `event: end`.

---

## Dockerfile

```dockerfile
FROM python:3.12-slim

# Node.js for hooks bridge
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# Node deps (for hooks bridge)
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# App code
COPY src/ ./src/
COPY hooks_bridge.mjs ./

EXPOSE 8000
HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

## Env vars

```
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# LiteLLM (S5)
LITELLM_URL=https://litellm.ecossistema.internal
LITELLM_MASTER_KEY=sk-litellm-master-xxx

# Langfuse (S9)
LANGFUSE_HOST=https://langfuse.ecossistema.internal
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# Supabase ECOSYSTEM
SUPABASE_URL=https://gqckbunsfjgerbuiyzvn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# SC-29 (S8)
CREDENTIAL_GATEWAY_URL=https://gqckbunsfjgerbuiyzvn.supabase.co/functions/v1/credential-gateway-v2

# Auth
JWT_SECRET=...
OWNER_TOKEN_HASH=...

# Agent runtime
ORCHESTRATOR_PORT=8000
LOG_LEVEL=INFO
```

---

## Teste E2E básico

```bash
# 1. Deploy orchestrator no Railway
railway up

# 2. Health
curl https://orchestrator.ecossistema.internal/health

# 3. List agents (inicialmente só Claudinho stub)
curl https://orchestrator.ecossistema.internal/agents \
  -H "Authorization: Bearer <OWNER_TOKEN>"

# 4. Run (stream SSE)
curl -N https://orchestrator.ecossistema.internal/agents/claudinho/run \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query":"Olá, teste.","user_id":"marcelo"}'

# Esperado: stream com init → assistant_message → end
```

---

## Testes obrigatórios

- `test_agents.py` — GET /agents retorna lista correta
- `test_sse.py` — /run emite eventos na ordem esperada
- `test_resume.py` — /resume retoma sessão sem reinicializar
- `test_hitl.py` — agente em `status_idled` dispara webhook

---

## Critério de sucesso

- [ ] Orchestrator deployado em Railway, `/health` verde
- [ ] Claudinho stub responde `/run` com SSE funcional
- [ ] Tools chamadas aparecem em Langfuse trace
- [ ] Hooks bridge responde (PreToolUse bloqueia quando Art. II dispara)
- [ ] Session resumption funciona (2 calls → segunda retoma histórico)
- [ ] HITL webhook testado (mock approval → sessão retoma)
- [ ] README com: como adicionar agente novo, endpoints, exemplos curl
- [ ] Commit: `feat(orchestrator): FastAPI expondo Managed Agents + hooks + SSE`

---

## Handoff

- **S11 (C-Suite templates)** popula agent registry com templates
- **S13 (Clients)** provê `@ecossistema/credentials` que orchestrator usa internamente
- **S16 (Piloto CFO-FIC)** é primeiro agente real deployado aqui
- **S17 (Validação E2E)** usa orchestrator como entry-point

---

**Boa sessão. Esse é o coração runtime do ecossistema. Capricho.**
