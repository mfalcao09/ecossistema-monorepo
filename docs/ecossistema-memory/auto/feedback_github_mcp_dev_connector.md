---
name: GitHub MCP no Cowork é conector [Dev] sem acesso a repos privados
description: O "GITHUB MCP" no registry do Cowork (UUID e4b18350-ee55-4f2a-befc-de3bda422349) é o "[Dev] Anthropic Github MCP Connector" por Tobin South — só pede 3 permissões mínimas (verify identity, know resources, act on behalf) e NÃO acessa conteúdo de repos privados, retornando 404. NÃO recomendar este conector. NÃO recomendar upgrade de Copilot pra resolver — o problema é o escopo OAuth do app, não o plano do Copilot.
type: feedback
---

O conector "GITHUB MCP" que aparece no registry do Cowork (search_mcp_registry) com UUID `e4b18350-ee55-4f2a-befc-de3bda422349` e URL `https://api.githubcopilot.com/mcp` é, na verdade, o **`[Dev] Anthropic Github MCP Connector`** mantido por Tobin South (engenheiro da Anthropic). É um app de desenvolvimento/protótipo com permissões intencionalmente mínimas:
1. Verify your GitHub identity
2. Know which resources you can access
3. Act on your behalf

Ele NÃO pede permissões de conteúdo de repositório (`repo`, `Contents`, etc). Resultado: qualquer chamada a `list_commits`, `get_file_contents`, `search_repositories` em **repos privados** retorna **404 Not Found** — não importa se o usuário tem Copilot Free, Pro, Business ou Enterprise.

**Why:** Em 06/04/2026, recomendei ao Marcelo fazer upgrade pro Copilot Pro (US$10/mês) achando que resolveria o 404 nos repos privados. Não resolveu. O problema é o escopo OAuth do app `[Dev]`, não o plano do Copilot. Marcelo gastou dinheiro à toa porque eu esqueci do diagnóstico anterior que dizia exatamente isso.

**How to apply:**
- Quando um usuário pedir GitHub MCP no Cowork e o registry retornar essa entrada (`GITHUB MCP` com UUID `e4b18350-...`), AVISAR explicitamente que ela só funciona para dados públicos do perfil + repos públicos
- NÃO sugerir upgrade do Copilot como solução
- Para repos privados, sugerir caminhos alternativos: (a) custom connector via UI do Cowork apontando para o GitHub MCP oficial com PAT, (b) Plan B com workflow manual via bash/git, (c) esperar Anthropic shipear conector de produção
- Verificar antes de propor qualquer solução paga: olhar a tela de OAuth e checar se as permissões pedidas incluem acesso a conteúdo de repositório
