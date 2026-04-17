# template-mcp — Scaffold FastMCP v3

Scaffold base para **MCP servers** do Ecossistema. Todo server novo herda esta estrutura, economizando setup de auth, middleware, tracing, Docker e Railway.

> **Não altere este pacote diretamente.** Use `pnpm create-mcp-server <name>` para gerar um novo server. Mudanças no template se propagam aos servers via re-geração ou PR manual.

## Stack

- **FastMCP v3** — framework MCP (Python)
- **Supabase JWT** + **Owner token** — auth dual
- **OpenTelemetry** — tracing (Langfuse endpoint via env)
- **Redis** — rate-limit (fallback in-memory)
- **Railway** — deploy (Dockerfile + railway.json prontos)

## Rodar localmente

```bash
cd packages/@ecossistema/mcp-servers/template
cp .env.example .env            # preencha SUPABASE_URL, OWNER_TOKEN_HASH, etc
pip install -e ".[dev]"
python -m template_mcp.server
```

Server sobe em `http://localhost:8080/mcp` via **Streamable HTTP**.

## Testar

```bash
pytest
```

## Estrutura

```
src/template_mcp/
├── server.py                 # FastMCP app + registro de tools/resources
├── config.py                 # env vars via Pydantic
├── auth/
│   ├── supabase_jwt.py       # AuthProvider Supabase
│   ├── owner_token.py        # AuthProvider owner (bearer)
│   └── scopes.py             # reader | operator | admin + decorator
├── middleware/
│   ├── errors.py             # wrap + log estruturado, não vaza stack
│   ├── tracing.py            # OTel spans por tool call
│   ├── logging.py            # structured JSON logs
│   └── rate_limit.py         # token bucket Redis
├── tools/hello.py            # exemplo de @mcp.tool
└── resources/status.py       # exemplo de @mcp.resource
```

## Middleware order

`errors → tracing → logging → rate_limit → auth → tool handler`

Crítica: `errors` **primeiro** para capturar falhas de qualquer camada abaixo; `tracing` antes de `logging` para ter `trace_id` nos logs; `rate_limit` após `auth` … na verdade **antes** para não custar CPU validando JWT quando o principal já está bloqueado? Spec V9 define: errors > tracing > logging > rate_limit, e **auth é gate do FastMCP**, roda dentro do `on_call_tool` via `AuthProvider`. Não confundir: o `AuthProvider` já validou antes do middleware chain rodar.

## Adicionar tool

```python
from template_mcp.auth.scopes import require_scope

@mcp.tool
@require_scope("operator")
def minha_tool(param: str) -> dict:
    """Docstring vira description no MCP schema."""
    return {"ok": True, "echo": param}
```

## Adicionar resource

```python
@mcp.resource("cfg://{key}")
@require_scope("reader")
def get_cfg(key: str) -> str:
    return settings[key]
```

## OpenAPI auto-gen

Transforma qualquer spec OpenAPI em MCP tools:

```python
from fastmcp.server.providers.openapi import FastMCPOpenAPI

inter = FastMCPOpenAPI.from_url(
    spec_url="https://cdpj.partners.bancointer.com.br/oapi/v4/openapi.json",
    name="BancoInter",
    auth_headers={"Authorization": "Bearer {INTER_TOKEN}"},
)
inter.mount("/inter")
```

## FastMCPProxy

Wrap MCP server de terceiros com auth + middleware nossos:

```python
from fastmcp.server.proxy import FastMCPProxy

proxied = FastMCPProxy(
    upstream_url="http://n8n-mcp.internal:3000",
    name="n8n (proxied)",
    add_auth_providers=[SupabaseJWTProvider(...)],
    add_middleware=[LoggingMiddleware(), TracingMiddleware()],
)
proxied.mount("/n8n")
```

## Deploy Railway

```bash
railway up
# healthcheck: GET /mcp/status
```

Config em `railway.json`. O `Dockerfile` é multi-stage, Python 3.12 slim.

## Env vars

| Var | Obrigatória | Descrição |
|---|---|---|
| `MCP_SERVER_NAME` | opcional | nome exposto em `health_status` |
| `MCP_PORT` | opcional (8080) | porta HTTP |
| `MCP_SUPABASE_URL` | sim | URL do projeto Supabase |
| `MCP_SUPABASE_ANON_KEY` | sim | anon key para verificação JWT |
| `MCP_OWNER_TOKEN_HASH` | sim | SHA-256 hex do owner token |
| `MCP_REDIS_URL` | opcional | se ausente, rate-limit in-memory |
| `MCP_LOG_LEVEL` | opcional (INFO) | DEBUG/INFO/WARN/ERROR |
| `MCP_OTEL_ENDPOINT` | opcional | OTLP collector (Langfuse) |
