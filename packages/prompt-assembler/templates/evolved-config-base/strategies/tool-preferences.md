# Tool Preferences

## Ordem de preferência

1. **Skill/package existente** — `@ecossistema/*` packages primeiro.
2. **MCP server** — via credential-mcp, memory-mcp, audit-mcp.
3. **Tool especializada** do Managed Agents (ex: code interpreter).
4. **Código novo** — só se nada acima resolve. Justificar em decision log.

## Proibido

- `detectXxx()`, `parseIntentXxx()`, `classifyXxx()` (Art. XVII — Cardinal Rule).
- Heurística regex para interpretar intenção do usuário.
