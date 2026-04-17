# S3 — FastMCP Template

**Sessão:** S03 · **Dia:** 1 · **Worktree:** `eco-mcp-template` · **Branch:** `feature/mcp-template`
**Duração estimada:** 1 dia (8h) · **Dependências:** nenhuma
**Bloqueia:** todos os futuros MCP servers (S10, S16, Fase 1)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VIII § 30** (Padrão 7 — FastMCP v3)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — seção FastMCP completa
3. `research-repos/fastmcp/CLAUDE.md` — dev guide oficial
4. `research-repos/fastmcp/src/fastmcp/server/server.py` — classe FastMCP
5. `research-repos/fastmcp/src/fastmcp/server/auth/` — AuthProvider pattern
6. `research-repos/fastmcp/src/fastmcp/server/middleware/` — middleware stack
7. `research-repos/fastmcp/src/fastmcp/server/providers/openapi/` — OpenAPI auto-gen
8. `research-repos/fastmcp/src/fastmcp/server/proxy.py` — FastMCPProxy

---

## Objetivo

Criar o **scaffold base Python** em `packages/@ecossistema/mcp-servers/template/` que todos os MCP servers do ecossistema vão herdar. Incluir:
- `@mcp.tool`, `@mcp.resource`, `@mcp.prompt` com schema auto-gerado
- AuthProvider para Supabase JWT + owner tokens + scopes
- Middleware stack (logging, rate-limit, tracing, errors)
- FastMCPProxy exemplo para wrap third-party MCP servers
- OpenAPI auto-gen exemplo
- Dockerfile Railway pronto
- CLI generator `pnpm create-mcp-server <name>`

---

## Escopo exato

```
packages/@ecossistema/mcp-servers/
├── template/                          # o scaffold base
│   ├── pyproject.toml
│   ├── README.md
│   ├── src/
│   │   └── template_mcp/
│   │       ├── __init__.py
│   │       ├── server.py              # FastMCP app
│   │       ├── auth/
│   │       │   ├── __init__.py
│   │       │   ├── supabase_jwt.py    # AuthProvider Supabase
│   │       │   ├── owner_token.py     # owner bearer
│   │       │   └── scopes.py          # reader|operator|admin
│   │       ├── middleware/
│   │       │   ├── __init__.py
│   │       │   ├── logging.py
│   │       │   ├── rate_limit.py
│   │       │   ├── tracing.py         # OTel via openllmetry
│   │       │   └── errors.py
│   │       ├── tools/                 # @mcp.tool exemplos
│   │       │   └── hello.py
│   │       ├── resources/             # @mcp.resource exemplos
│   │       │   └── status.py
│   │       └── config.py              # env vars, logging config
│   ├── tests/
│   │   ├── test_auth.py
│   │   ├── test_middleware.py
│   │   └── test_server.py
│   ├── Dockerfile                     # Railway-ready
│   └── railway.json                   # Railway config
├── _shared/                           # utils comuns a todos MCP servers
│   ├── supabase_client.py
│   ├── audit.py
│   └── credentials.py                 # usa SC-29 Modo B
├── generator/                         # CLI create-mcp-server
│   ├── package.json
│   ├── bin/create-mcp-server.js
│   └── templates/                     # arquivos do scaffold copiáveis
└── README.md                          # guia "como criar novo MCP server"
```

---

## Decisões-chave

1. **Python, não TypeScript** — FastMCP v3 é Python-first; tem TS mas menor community. SDK oficial Anthropic aceita MCP via HTTP/stdio, linguagem é irrelevante.
2. **Streamable HTTP como transport default** (suporta SSE, resumo de sessão, multiplexing)
3. **Auth via Supabase JWT** + owner token opcional (para ops administrativas)
4. **Scopes padronizados:** `reader` (get), `operator` (call tools), `admin` (manage)
5. **Middleware order fixa:** errors → tracing → logging → rate_limit → auth → tool handler
6. **Generator é Node.js** (facilita integração com pnpm workspaces)

---

## Spec do AuthProvider

### `auth/supabase_jwt.py`

```python
from fastmcp.server.auth import AuthProvider, AuthCheck, AuthContext
import httpx
import jwt

class SupabaseJWTProvider(AuthProvider):
    """
    Auth via Supabase JWT. Header esperado:
      Authorization: Bearer <supabase_user_jwt>
    """
    def __init__(self, supabase_url: str, supabase_anon_key: str, expected_aud: str = "authenticated"):
        self.supabase_url = supabase_url
        self.anon_key = supabase_anon_key
        self.aud = expected_aud
        self._jwks = None  # lazy load

    async def authenticate(self, request) -> AuthContext | None:
        token = self._extract_bearer(request)
        if not token:
            return None
        try:
            payload = await self._verify_jwt(token)
            return AuthContext(
                principal_id=payload["sub"],
                principal_type="user",
                scopes=self._scopes_from_claims(payload),
                metadata={"business_id": payload.get("user_metadata", {}).get("business_id")},
            )
        except jwt.InvalidTokenError as e:
            raise AuthCheck.failure(f"Invalid JWT: {e}")
```

### `auth/owner_token.py`

```python
class OwnerTokenProvider(AuthProvider):
    """
    Owner bearer token. Usado por Marcelo/admin scripts.
    Token armazenado cifrado em Supabase Vault; valor vem por env var.
    """
    def __init__(self, expected_token_hash: str):  # nunca o valor cru
        self.expected_hash = expected_token_hash

    async def authenticate(self, request) -> AuthContext | None:
        token = self._extract_bearer(request)
        if not token:
            return None
        if not timing_safe_eq(sha256(token), self.expected_hash):
            raise AuthCheck.failure("Invalid owner token")
        return AuthContext(
            principal_id="owner",
            principal_type="owner",
            scopes=["reader", "operator", "admin"],
        )
```

### `auth/scopes.py`

```python
SCOPES = ["reader", "operator", "admin"]

def require_scope(scope: str):
    """Decorator usado em @mcp.tool para exigir scope mínimo."""
    def decorator(fn):
        fn._required_scope = scope
        return fn
    return decorator

def get_required_scope(tool_name: str, tool_func) -> str:
    return getattr(tool_func, "_required_scope", "operator")  # default
```

---

## Spec do Middleware Stack

### `middleware/errors.py`

```python
from fastmcp.server.middleware import Middleware, MiddlewareContext

class ErrorsMiddleware(Middleware):
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        try:
            return await call_next(context)
        except Exception as e:
            # Log structured, não vaza stack em produção
            log.error("tool_error", tool=context.tool_name, error=str(e), exc_info=True)
            raise ToolError(
                code="INTERNAL_ERROR",
                message="Tool execution failed. See correlation_id in logs.",
                data={"correlation_id": context.correlation_id}
            )
```

### `middleware/tracing.py`

```python
from opentelemetry import trace

class TracingMiddleware(Middleware):
    async def on_call_tool(self, context, call_next):
        tracer = trace.get_tracer("fastmcp-ecossistema")
        with tracer.start_as_current_span(f"mcp.tool.{context.tool_name}") as span:
            span.set_attribute("mcp.tool.name", context.tool_name)
            span.set_attribute("mcp.principal.id", context.auth.principal_id)
            span.set_attribute("mcp.business_id", context.auth.metadata.get("business_id", "ecosystem"))
            return await call_next(context)
```

### `middleware/rate_limit.py`

Token bucket por principal (Redis-backed; fallback in-memory em dev):

```python
class RateLimitMiddleware(Middleware):
    def __init__(self, redis_url: str | None = None, default_rpm: int = 60):
        self.redis = redis.asyncio.from_url(redis_url) if redis_url else None
        self.default_rpm = default_rpm

    async def on_call_tool(self, context, call_next):
        principal = context.auth.principal_id
        if not await self._allow(principal):
            raise ToolError(code="RATE_LIMIT_EXCEEDED", message=f"Max {self.default_rpm}/min")
        return await call_next(context)
```

### `middleware/logging.py`

Structured logs (JSON):

```python
class LoggingMiddleware(Middleware):
    async def on_call_tool(self, context, call_next):
        start = time.monotonic()
        result = await call_next(context)
        duration_ms = (time.monotonic() - start) * 1000
        log.info("tool_call", 
            tool=context.tool_name,
            principal=context.auth.principal_id,
            duration_ms=round(duration_ms, 1),
            success=True,
        )
        return result
```

---

## Spec do Server Template (`src/template_mcp/server.py`)

```python
from fastmcp import FastMCP
from .auth.supabase_jwt import SupabaseJWTProvider
from .auth.owner_token import OwnerTokenProvider
from .auth.scopes import require_scope
from .middleware import ErrorsMiddleware, TracingMiddleware, LoggingMiddleware, RateLimitMiddleware
from .config import Config

config = Config.from_env()

mcp = FastMCP(
    name=config.server_name,
    version="1.0.0",
    auth_providers=[
        SupabaseJWTProvider(config.supabase_url, config.supabase_anon_key),
        OwnerTokenProvider(config.owner_token_hash),
    ],
)

# Middleware stack — ordem crítica
mcp.add_middleware(ErrorsMiddleware())
mcp.add_middleware(TracingMiddleware())
mcp.add_middleware(LoggingMiddleware())
mcp.add_middleware(RateLimitMiddleware(config.redis_url, default_rpm=60))

@mcp.tool
@require_scope("reader")
def hello(name: str = "mundo") -> str:
    """Echo tool básica — prova que auth + middleware funcionam."""
    return f"Olá, {name}! (servidor: {config.server_name})"

@mcp.resource("status://health")
@require_scope("reader")
def health_status() -> dict:
    """Status do servidor."""
    return {"status": "ok", "server": config.server_name, "version": "1.0.0"}

if __name__ == "__main__":
    mcp.run(transport="streamable-http", port=config.port)
```

---

## Spec do Generator CLI (`generator/`)

```bash
pnpm create-mcp-server whatsapp \
  --business fic \
  --tools "send_message,list_conversations" \
  --resources "inbox://recent"
```

Resultado: cria `packages/@ecossistema/mcp-servers/whatsapp-mcp/` herdando do template com:
- `server.py` com tools/resources nomeados
- `config.py` com env vars específicas
- `tests/` stub
- Dockerfile e railway.json adaptados
- Entry em `packages/@ecossistema/mcp-servers/registry.yaml`

Implementação em Node.js simples:
```javascript
#!/usr/bin/env node
const { program } = require('commander');
const fs = require('fs-extra');
const path = require('path');

program
  .argument('<name>', 'MCP server name (kebab-case)')
  .option('--business <id>', 'Business id', 'ecosystem')
  .option('--tools <list>', 'Comma-separated tool names', '')
  .option('--resources <list>', 'Comma-separated resource URIs', '')
  .action(async (name, opts) => {
    const target = path.join('packages/@ecossistema/mcp-servers', `${name}-mcp`);
    await fs.copy('packages/@ecossistema/mcp-servers/generator/templates', target);
    await applyReplacements(target, { name, ...opts });
    console.log(`✅ Criado ${target}`);
  });

program.parse();
```

---

## OpenAPI Auto-Gen — exemplo concreto

Em `template/src/template_mcp/openapi_example.py`:

```python
from fastmcp.server.providers.openapi import FastMCPOpenAPI

# Transforma qualquer OpenAPI spec em MCP tools
banco_inter_mcp = FastMCPOpenAPI.from_url(
    spec_url="https://cdpj.partners.bancointer.com.br/oapi/v4/openapi.json",
    name="BancoInter",
    auth_headers={"Authorization": "Bearer {INTER_TOKEN}"},
)
banco_inter_mcp.mount("/inter")  # expõe em /inter/{endpoint}
```

Dá ao ecossistema acesso imediato ao Inter API como MCP tools sem escrever wrapper.

---

## FastMCPProxy — exemplo

```python
from fastmcp.server.proxy import FastMCPProxy

# Wrap MCP server de terceiros (ex: n8n-mcp) com auth + logging nossos
proxied_n8n = FastMCPProxy(
    upstream_url="http://n8n-mcp.internal:3000",
    name="n8n (proxied)",
    add_auth_providers=[SupabaseJWTProvider(...)],
    add_middleware=[LoggingMiddleware(), TracingMiddleware()],
)
proxied_n8n.mount("/n8n")
```

---

## Config (`src/template_mcp/config.py`)

```python
from pydantic import BaseSettings

class Config(BaseSettings):
    server_name: str = "template-mcp"
    port: int = 8080
    supabase_url: str
    supabase_anon_key: str
    owner_token_hash: str  # sha256 do owner token real
    redis_url: str | None = None
    log_level: str = "INFO"
    otel_endpoint: str | None = None

    class Config:
        env_file = ".env"
        env_prefix = "MCP_"
```

---

## Dockerfile Railway

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
COPY src/ ./src/
EXPOSE 8080
CMD ["python", "-m", "template_mcp.server"]
```

## `railway.json`

```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "python -m template_mcp.server",
    "healthcheckPath": "/mcp/status",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

---

## Testes obrigatórios

1. **`test_auth.py`** — JWT válido passa, inválido falha, scopes respeitados
2. **`test_middleware.py`** — ordem correta, erros wrapped, tracing spans criados
3. **`test_server.py`** — `hello()` + `health_status()` funcionam via cliente MCP
4. **`test_generator.py`** — `create-mcp-server test-server` gera árvore correta

---

## Critério de sucesso

- [ ] Template rodando via `python -m template_mcp.server`
- [ ] Cliente MCP conecta, autentica (JWT + owner), chama `hello()` com sucesso
- [ ] Middleware stack logando, tracing em OTel, rate-limit bloqueando excesso
- [ ] `pnpm create-mcp-server demo-mcp --business fic` cria server funcional
- [ ] Deploy manual em Railway funciona (healthcheck verde)
- [ ] README explica: como criar novo server, como adicionar tool, como plugar no Managed Agents
- [ ] PR semântico: `feat(mcp-template): FastMCP scaffold com auth + middleware + generator`

---

## Handoff

Todos os futuros MCP servers herdam deste template:
- `supabase-mcp` (Fase 1)
- `whatsapp-mcp` (via Evolution API, Fase 1)
- `credential-mcp` (wrap SC-29 Modo B, Fase 1)
- `memory-mcp` (wrap `@ecossistema/memory`, Fase 1)
- MCPs per-negócio (fic-mcp, klesis-mcp, etc)

---

**Boa sessão. Este template economiza semanas de boilerplate nas próximas fases.**
