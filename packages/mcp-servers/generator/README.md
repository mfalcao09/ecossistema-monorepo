# @ecossistema/create-mcp-server

CLI Node para gerar novos MCP servers a partir do `template/`.

## Uso

Do root do monorepo:

```bash
pnpm create-mcp-server whatsapp \
  --business fic \
  --tools "send_message,list_conversations" \
  --resources "inbox://recent"
```

Resultado:

- Copia `packages/mcp-servers/template/` para `packages/mcp-servers/whatsapp-mcp/`
- Substitui `template-mcp` → `whatsapp-mcp`, `template_mcp` → `whatsapp_mcp` em todos os arquivos
- Cria stubs `tools/send_message.py` e `tools/list_conversations.py`
- Cria `resources/inbox_recent.py` stub
- Adiciona entrada em `registry.yaml`
- Atualiza `Dockerfile` e `railway.json`

## Flags

| Flag | Default | Descrição |
|---|---|---|
| `--business <id>` | `ecosystem` | business_id do registry |
| `--tools <list>` | `""` | tools separadas por vírgula (kebab-case ou snake_case) |
| `--resources <list>` | `""` | URIs MCP separadas por vírgula |
| `--dry-run` | `false` | só imprime o que faria |

## Desenvolvimento

```bash
cd packages/mcp-servers/generator
pnpm install
node bin/create-mcp-server.js test-server --dry-run
```
