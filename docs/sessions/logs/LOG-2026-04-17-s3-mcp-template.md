# LOG-2026-04-17-s3-mcp-template

**Sessão:** S3 — FastMCP Template
**Worktree:** `zealous-mcclintock` (branch `claude/zealous-mcclintock`)
**PR:** [mfalcao09/ecossistema-monorepo#2](https://github.com/mfalcao09/ecossistema-monorepo/pull/2)
**Duração:** ~3h (implementação + validação runtime)
**Status:** ✅ Todos os critérios de sucesso do briefing atingidos

---

## Entregue

**38 arquivos** em `packages/@ecossistema/mcp-servers/`:

- `template/` — scaffold Python 3.12 FastMCP v3.2.4
  - `auth/`: `SupabaseJWTVerifier` + `OwnerTokenVerifier` (TokenVerifier), `scopes.py` com hierarquia reader<operator<admin + `@require_scope`
  - `middleware/`: `Errors` (wrap + correlation_id via structlog contextvars) → `Tracing` (OTel) → `Logging` (JSON) → `RateLimit` (Redis Lua + fallback)
  - `tools/hello.py`, `resources/status.py`
  - `server.py` com `build_server(config)` e `MultiAuth(verifiers=[owner, jwt])`
  - `config.py` Pydantic Settings (`MCP_` prefix)
  - `Dockerfile` multi-stage non-root + `railway.json` (`/mcp` healthcheck)
  - `tests/` — 27 testes (todos verdes)

- `_shared/` — `build_supabase_client`, `audit_log` (fail-safe), `CredentialClient` wrap SC-29 Modo B

- `generator/` — CLI Node (`commander + fs-extra + yaml`) validada E2E: gerou `demo-mcp` limpo sem placeholders

- `registry.yaml` — registro canônico

**Workspace:** `pnpm-workspace.yaml` cobre `packages/@ecossistema/*`. `package.json` raiz ganhou script `create-mcp-server`.

---

## Validação runtime (Python 3.12 + uv + pnpm 10)

| Check | Resultado |
|---|---|
| `pytest` | **27/27** passam (1.2s) |
| `python -m template_mcp.server` | Sobe em :18080, Streamable HTTP `/mcp`, uvicorn verde, graceful shutdown |
| `pnpm create-mcp-server demo` | Gera server limpo, renomeia `template_mcp`→`demo_mcp`, registra em `registry.yaml` |
| `railway.json` | JSON válido (deploy manual pendente de `railway link` do Marcelo) |

---

## Drift API encontrado (corrigido no commit `60833a5`)

O briefing S3 foi escrito com base em docs antigas do FastMCP. API real do v3.2.4 diverge em 5 pontos:

| Briefing (pré-v3) | FastMCP v3.2.4 real |
|---|---|
| `FastMCP(auth_providers=[...])` | `FastMCP(auth=<AuthProvider>)` + `MultiAuth(verifiers=[...])` |
| `AuthProvider.authenticate(request)` | `TokenVerifier.verify_token(token) -> AccessToken \| None` |
| `mcp.add_middleware(x)` | `FastMCP(middleware=[...])` no constructor |
| `ToolError(code=..., data=...)` | `ToolError(message)` — Exception simples |
| `transport="streamable-http"` | `transport="http"` |

**Contexto do principal dentro de middleware:** usar `get_access_token()` de `fastmcp.server.dependencies`. `MiddlewareContext` é frozen dataclass — mutação via `.copy()` ou via `structlog.contextvars`.

**Tool name:** `context.message.name` (a `message` é o `CallToolRequestParams`).

---

## Commits

- `c835695` — feat(mcp-template): scaffold inicial (1850 linhas, 40 arquivos)
- `60833a5` — fix(mcp-template): alinhar com API real FastMCP v3.2.4 (217 linhas líquidas)

---

## Bugs tangenciais caçados pela validação

1. **Dep fantasma `kleurs: 0.0.0`** no generator/package.json — 404 npm. Removida.
2. **`railway.json healthcheckPath`** era `/mcp/status` (path que não existe) — ajustado para `/mcp` (raiz do Streamable HTTP, retorna 307 que Railway aceita).
3. Pytest usava `AuthContext` com shape assumido; `AuthContext` real é `@dataclass(token, component)` — testes reescritos para usar `AccessToken` diretamente.

---

## Handoff

Destrava imediatamente:
- **S10** orchestrator (pode importar verifiers + middleware prontos)
- **S16** piloto CFO FIC
- **Fase 1**: `supabase-mcp`, `whatsapp-mcp`, `credential-mcp`, `memory-mcp`, `audit-mcp`, per-negócio — basta `pnpm create-mcp-server <name>`

---

## Pendências assumidas (fora do escopo S3)

- Deploy real Railway (exige `railway login` + `railway link` na CLI do Marcelo)
- Langfuse endpoint concreto para OTel tracing (S9)
- Credentials proxy ao vivo (depende de S08 Edge Functions)
- MCP server wiring com Anthropic Managed Agents (Fase 1)

---

## Padrão aprendido (importante para próximas sessões FastMCP)

**Antes de implementar contra briefing escrito pré-v3:** inspecionar o pacote instalado:

```python
import inspect
from fastmcp import FastMCP
from fastmcp.server.auth import AuthProvider, TokenVerifier, MultiAuth
print(inspect.signature(FastMCP.__init__))
print([m for m in dir(TokenVerifier) if not m.startswith('_')])
```

Isso economizou 6 testes quebrados no segundo round de S3; vai economizar mais nas próximas.
