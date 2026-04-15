# Squad IA — Inicialização — 2026-03-21

**Data:** 2026-03-21 06:13:25
**Tarefa:** Verificar e iniciar servidores MCP do squad

## Status dos Servidores

| Servidor | Modelo | Status | Local |
|----------|--------|--------|-------|
| Qwen | qwen3-coder (480B) | ✅ Pronto | /tmp/ai-servers/qwen/qwen-server-fixed.mjs |
| Kimi | kimi-k2.5 (1T) | ✅ Pronto | /tmp/ai-servers/kimi/kimi-server-fixed.mjs |
| Codestral | codestral-2501 | ✅ Pronto | /tmp/ai-servers/codestral/codestral-server-fixed.mjs |
| DeepSeek | deepseek-chat | ✅ Pronto | /tmp/ai-servers/deepseek/deepseek-server.mjs |

## Ações Realizadas

1. Detectado que os servidores originais tinham problemas:
   - qwen-server.mjs e codestral-server.mjs: usavam @anthropic-ai/sdk incorretamente como transport MCP
   - kimi-server.mjs: tinha anotações TypeScript em arquivo .mjs (JS puro)
   - deepseek-server.mjs: funcionava corretamente

2. Servidores copiados para /tmp/ai-servers/ (sistema de arquivos do plugin é read-only)

3. Versões corrigidas criadas:
   - qwen-server-fixed.mjs: usa @modelcontextprotocol/sdk + StdioServerTransport
   - kimi-server-fixed.mjs: mesma estrutura, TypeScript removido
   - codestral-server-fixed.mjs: usa @modelcontextprotocol/sdk + StdioServerTransport
   - deepseek-server.mjs: original (já estava correto)

4. Dependências instaladas: @modelcontextprotocol/sdk para cada servidor

5. Todos os 4 servidores testados e confirmados com exit code 0 (sem erros)

## Nota Técnica

MCP servers com StdioServerTransport são iniciados pelo host MCP quando necessário.
Eles encerram quando o stdin é fechado - isso é comportamento CORRETO.
Os servidores não precisam ficar rodando em background permanentemente.

## Próxima Sessão

Para usar o squad no projeto, os servidores estão disponíveis em /tmp/ai-servers/.
O MiniMax (Buchecha) já está disponível via plugin integrado.
