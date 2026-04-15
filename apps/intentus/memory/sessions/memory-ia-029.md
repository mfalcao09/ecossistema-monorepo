# Sessão 29 — Plugin MiniMax M2.5 v0.1.0→v0.3.0 (3 iterações)

- **Problema v0.1.0**: Variável de ambiente `MINIMAX_API_KEY` no `.mcp.json` — VM Linux do Cowork não herda `~/.zshrc` do Mac → erro 401
- **Fix v0.2.0**: API key hardcoded no `.mcp.json` → corrigiu 401, mas `node_modules` faltando → MCP server não iniciava
- **Fix v0.3.0**: API key hardcoded + `node_modules` bundled (4.6MB, inclui `@modelcontextprotocol/sdk` v1.27.1, 91 packages)
- **Entregue**: `minimax-ai-assistant.plugin` (4.6MB) no workspace
- **Lição aprendida**: Plugins Cowork rodam em VM Linux isolada — env vars do host não propagam, e `node_modules` precisa ser incluído no bundle
