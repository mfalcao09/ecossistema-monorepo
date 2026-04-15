---
name: Sessão 031 — fix timeout Tela 2 (paralelização Railway + timeout 7min)
description: Sessão 031 (09/04/2026) resolveu timeout da Tela 2 reproduzido por Kauana com 16 arquivos; commit e0acf69 deploy Vercel READY em ~97s
type: project
---

Sessão 031 — 09/04/2026 — commit `e0acf69b388581c733efcc961f62b3f581a52f1d`, deploy Vercel `dpl_C3SR7NXNFcRhxz2u6b68BZdEg27G` **READY** (buildingAt 1775737032863 → ready 1775737130194, ~97s).

**Bug:** Kauana subiu 16 documentos em `/diploma/processos/novo`, Tela 2 ficou 583s em `processando` sem callback, sessão `5902b355-3093-4b2b-a4da-a0281b9838f3` travada com `dados_extraidos={}`.

**Causa raiz:** `processarExtracao` no Railway `services/document-converter/src/server.js` iterava arquivos em loop sequencial → 16 × ~25s cada = ~400s, ultrapassando o TIMEOUT_MS do polling da Tela 2 (5min = 300s).

**Fix:**
- **Railway:** novo helper `executarComLimite(itens, limite, tarefa)` inline (sem dep nova, CommonJS-compatible). `processarExtracao` agora roda 4 arquivos em paralelo (`EXTRACAO_CONCORRENCIA` env-configurable). Ordem preservada → `agregarDados` inalterado. Ganho esperado: 16 arquivos ~400s → ~100s. Pico memória ~28MB (plano 512MB). Gemini 2.5 Flash aceita 1000+ req/min.
- **Next.js Tela 2:** `TIMEOUT_MS` de 5min → 7min como rede de segurança complementar.

**Por que não `p-limit`:** v5+ é ESM-only, incompatível com `require()` do serviço. Limiter inline resolveu em 30 linhas.

**Why:** Bug bloqueador da secretária testando processos reais; precisava destravar sem reescrever o fluxo.

**How to apply:** Quando a extração Railway ficar lenta novamente, subir `EXTRACAO_CONCORRENCIA` (4 → 6/8) via env Railway. Se memória apertar, baixar. O limiter é genérico e pode ser reusado em outros loops pesados do serviço.

**Pendente verificar:** redeploy automático do Railway (não tenho MCP Railway para confirmar); teste real com Kauana (16 docs); opcional: destravar sessão `5902b355` órfã.
