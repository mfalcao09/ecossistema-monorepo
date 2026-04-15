# Sessão 91 — Upgrade Plugin MiniMax M2.5 → M2.7 (19/03/2026)

- **Objetivo**: Atualizar o plugin MiniMax de M2.5 para M2.7 (lançado 18/03/2026). Marcelo atualizou a configuração da API para chamar a nova versão
- **Pesquisa**: Web search confirmou que M2.7 é "self-evolving" com melhorias em coding e agentic workflows. Endpoint API permanece o mesmo (`https://api.minimax.io/anthropic/v1/messages`), só muda o model name de `MiniMax-M2.5` para `MiniMax-M2.7`
- **Alterações no plugin v0.4.0**:
  - `servers/minimax-server.mjs`: MODEL `"MiniMax-M2.5"` → `"MiniMax-M2.7"`, server version `"0.1.0"` → `"0.4.0"`, todas as 20+ referências textuais "M2.5" → "M2.7" (descriptions, system prompts, response headers)
  - `.claude-plugin/plugin.json`: version `"0.3.0"` → `"0.4.0"`, description atualizada
  - `skills/minimax-pair-programming/SKILL.md`: Todas referências M2.5 → M2.7, version `0.1.0` → `0.2.0`
  - `commands/*.md` (4 arquivos): Todas referências M2.5 → M2.7
  - `README.md`: M2.5 → M2.7, changelog v0.4.0 adicionado
  - `.mcp.json`: Sem alteração (API key e endpoint iguais)
- **Plugin empacotado**: `minimax-ai-assistant.plugin` v0.4.0 (4.6MB) com node_modules bundled
- **Entregável**: Plugin .plugin atualizado no workspace folder
- **Nota**: Para instalar, Marcelo deve ir em Cowork → Plugins → reinstalar o `.plugin` (substituir v0.3.0)
- **CLAUDE.md**: Atualizado (regra sessão 2, Memory Quick Reference, tabela plugins, pendências)
