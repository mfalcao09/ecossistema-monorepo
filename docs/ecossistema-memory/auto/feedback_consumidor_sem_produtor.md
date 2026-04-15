---
name: Não commitar consumidor sem produtor
description: Antes de commitar, sempre verificar que TODOS os símbolos importados/chamados existem no main remoto, especialmente em sessões paralelas
type: feedback
---

Nunca commitar código que importa/chama símbolos (módulos, tipos, assinaturas de função, campos) que existem só localmente no bindfs e ainda não foram pushed.

**Why:** Sessão 2026-04-07 — commit `fccbbf2` quebrou o deploy em produção porque importava `@/lib/pdfa/converter-service`, `DocumentosComprobatoriosNonEmpty` e chamava `gerarXMLs(dados, comprobatorios)` (2 args), mas todos esses produtores viviam só no bindfs local — main remoto estava 7 commits à frente do meu local e não tinha nenhuma dessas peças. Plus `exemplo-uso.ts` ainda referenciava `data_expedicao` que o Bug #E (`24755f2`) tinha removido. Resultado: 8 erros TS no build da Vercel, deploy ERROR, tive que reverter (`643f186`).

**How to apply:**
1. SEMPRE rodar `git fetch origin && git log HEAD..origin/main --oneline` ANTES de commitar quando há sessões paralelas
2. Se local está atrás, fazer `git pull --rebase` ANTES de qualquer commit
3. Rodar `npx tsc --noEmit` num clone limpo do origin/main com os arquivos modificados aplicados — NÃO confiar só no type-check do bindfs (que tem produtores que o origin não tem)
4. Para Bug #F (motor XML novo): bundle precisa ser ATÔMICO — converter-service + tipo NonEmpty + nova assinatura gerarXMLs + tela + route + migração — tudo num único commit/PR, senão deploy quebra
