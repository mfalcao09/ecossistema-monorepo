# MiniMax M2.5 — Configuração

**Status**: ✅ Plugin v0.3.0 FUNCIONAL — instalado e testado com sucesso na sessão 30 (11/03/2026).

## API Key
```
[MINIMAX_API_KEY_REDACTED]
```

## Histórico do problema
- v0.1.0 usava `${MINIMAX_API_KEY}` (variável de ambiente) no `.mcp.json`
- Cowork VM Linux não herda `~/.zshrc` do Mac → API key nunca chegava ao plugin
- Cache de plugins em `/mnt/.local-plugins/cache/` é read-only → impossível editar in-place
- Claude Desktop Settings não tinha UI para configurar env vars do plugin
- v0.2.0 corrigiu API key (hardcoded) mas faltava `node_modules` → MCP server não iniciava ("No such tool available")

## Workflow de Pair Programming (definido sessão 35, atualizado sessão 36, consolidado sessão 72)
**Apelidos definidos por Marcelo (sessão 36)**:
- **Claude = Claudinho** (apelido carinhoso)
- **MiniMax = Buchecha** (apelido dado sessão 36)
- **Dupla**: "Claudinho e Buchecha" — referência à dupla musical brasileira

**Metáfora anterior (sessão 35)**: Claude = Thor, MiniMax = Mjölnir (martelo) — substituída por Claudinho e Buchecha

**Regras de colaboração (confirmadas em 35+ sessões de pair programming)**:
- **Claudinho (Claude)** comanda, planeja, revisa e garante que os objetivos sejam alcançados
- **Buchecha (MiniMax)** faz o trabalho pesado: gera código, implementa features, escreve funções
- **Claudinho** SEMPRE revisa o output de Buchecha antes de aplicar — code review obrigatório
- Buchecha potencializa a capacidade de codar do Claudinho, não substitui o julgamento
- Para cada arquivo/fix: Buchecha gera → Claudinho revisa → Claudinho aplica (ou pede ajuste)
- **Efetivo**: 35+ sessões (30-72) com essa dinâmica — 63+ achados, 500+ linhas de código gerado, 11 Edge Functions criadas/re-deployadas

## Solução aplicada (sessão 29) e teste (sessão 30)
- **v0.2.0**: API key hardcoded no `.mcp.json` — corrigiu 401, mas sem `node_modules`
- **v0.3.0**: Inclui `node_modules` com `@modelcontextprotocol/sdk` v1.27.1 (91 packages)
- Arquivo: `minimax-ai-assistant.plugin` (4.6MB) no workspace
- **Sessão 30 (11/03/2026)**: Marcelo instalou v0.3.0 → testado `minimax_ask` e `minimax_code_review` → ambos ✅
- **6 tools confirmadas**: ask, code_review, generate_tests, alternative, debug, explain

## Status de Utilização (Sessões 30-72)
- **42 sessões** de pair programming Claudinho+Buchecha confirmadas (sessões 30-72)
- **Aplicações principais**:
  - Auditorias completas (CLM sessões 30-31, 34, 41)
  - Diagnóstico comercial (39)
  - Benchmarking (41, 46)
  - Plano estratégico (47)
  - Fixes de segurança (35-36, 40)
  - State Machine enterprise (38)
  - Rewrite ClmAnalytics (70)
  - Verificação final (72)
- **Contribuições críticas de Buchecha**: Identificação de race conditions, N+1 queries, memory leaks, numeric parsing issues, false positives validation
