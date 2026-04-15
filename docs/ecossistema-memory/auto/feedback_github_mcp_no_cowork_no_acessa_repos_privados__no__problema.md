---
name: GitHub MCP no Cowork não acessa repos privados — não é problema do Copilot
description: GitHub MCP no Cowork não acessa repos privados — não é problema do Copilot
type: feedback
project: erp
tags: ["github", "mcp", "cowork", "privado"]
success_score: 0.9
supabase_id: 17bee04a-5538-4ace-b0b0-7ec86ad5a2f7
created_at: 2026-04-13 09:15:25.002792+00
updated_at: 2026-04-13 12:05:11.537529+00
---

O conector "GITHUB MCP" no Cowork (UUID e4b18350-ee55-4f2a-befc-de3bda422349) é o [Dev] Anthropic Github MCP Connector — permissões mínimas, NÃO acessa conteúdo de repos privados (retorna 404). NÃO recomendar upgrade de Copilot como solução — o problema é o escopo OAuth do app, não o plano. Para repos privados: (a) custom connector via UI do Cowork com PAT, (b) workflow manual via bash/git, (c) aguardar conector de produção da Anthropic. Em 06/04/2026, recomendei upgrade Pro (US$10/mês) sem resolver o problema.
