# @ecossistema/mcp-servers

Coleção canônica de **MCP servers** (Model Context Protocol) do Ecossistema. Todos herdam do mesmo scaffold FastMCP com **auth Supabase JWT + owner token**, **middleware stack** (errors → tracing → logging → rate-limit) e **OpenAPI auto-gen**.

## Estrutura

```
packages/@ecossistema/mcp-servers/
├── template/          # scaffold base Python (FastMCP v3)
├── _shared/           # utilitários comuns (Supabase client, audit, credentials)
├── generator/         # CLI Node: `pnpm create-mcp-server <name>`
└── registry.yaml      # registro central de todos os MCP servers
```

## Criar um MCP server novo

```bash
pnpm create-mcp-server whatsapp \
  --business fic \
  --tools "send_message,list_conversations" \
  --resources "inbox://recent"
```

Isso copia o `template/` para `packages/@ecossistema/mcp-servers/whatsapp-mcp/`, substitui placeholders e registra em `registry.yaml`.

## Adicionar tool a um server existente

```python
from .auth.scopes import require_scope

@mcp.tool
@require_scope("operator")
def send_message(phone: str, body: str) -> dict:
    """Envia mensagem via Evolution API."""
    ...
```

## Plugar no Managed Agents

1. Deploy do MCP server no Railway (Dockerfile + railway.json já prontos).
2. No agente Anthropic Managed Agent, adicione o URL do MCP server às `mcp_servers` config.
3. Injete `Authorization: Bearer <supabase_jwt>` ou `<owner_token>`.

## Decisões canônicas (V9 § 30)

- **Python-first** — FastMCP v3 é canônico
- **Streamable HTTP** — transport default (SSE + session resume)
- **Scopes padronizados** — `reader`, `operator`, `admin`
- **Middleware order** — errors → tracing → logging → rate_limit → auth → tool
- **Auth dual** — Supabase JWT (usuários) + owner token (admin)

## Servers planejados (Fase 1)

- `supabase-mcp` — CRUD projetos Supabase
- `github-mcp` — ops no monorepo
- `whatsapp-mcp` — via Evolution API
- `credential-mcp` — wrap SC-29 Modo B
- `memory-mcp` — wrap `@ecossistema/memory`
- `audit-mcp` — query audit_log
- `fic-mcp`, `klesis-mcp`, `intentus-mcp`, `splendori-mcp`, `nexvy-mcp` — tools per-negócio
