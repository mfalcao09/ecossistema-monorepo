---
name: Sessão 034 — Tela 2 polling resiliente + Realtime + Gemini retry
description: Fix bug timeout Tela 2 mesmo com sessão rascunho/version=2 gravada em 64s — 4 camadas frontend + retry backoff Gemini
type: project
---

**Sessão 034 (09/04/2026, commit `db9e00d`):** resolveu o bug recorrente da Tela 2 estourar timeout (7min) mesmo quando a extração Railway terminava em 64s e gravava `status='rascunho'`/`version=2` corretamente no banco. Cenário Kauana 16 documentos.

**Why:** Causa raiz suspeita era silent error swallow no fetch da Tela 2 — uma vez que `setSessao` era chamado na primeira carga, qualquer `erroFetch` posterior ficava invisível na UI (porque o render `erroFetch && !sessao` virava false). Adicionalmente, o `setInterval` de polling era frágil a tab throttling em background e a race conditions de unmount. Marcelo confirmou que ficou na aba durante o teste falho — então throttling não era causa principal, mas a arquitetura precisava de defesa em profundidade. Squad approach mandado por Marcelo: "usa todo nosso squad, skills, tudo!!! Quero esse erro superado!"

**How to apply:**
- **Frontend (`src/app/(erp)/diploma/processos/novo/revisao/[sessaoId]/page.tsx`):** substitui setInterval por arquitetura de 4 camadas:
  1. **Supabase Realtime** — subscrição WebSocket em `extracao_sessoes` filter `id=eq.X`. Imune a throttling, dispara em <1s. Usa `createClient()` de `@/lib/supabase/client`. Channel name `extracao_sessao_${sessaoId}`. Cleanup chama `supabase.removeChannel(canal)`. CSP já tinha `wss://*.supabase.co` (verificado em produção).
  2. **setTimeout encadeado** — `tick()` async que se reagenda só após terminar fetch. Variável `cancelado` no closure + `ativo.current` para parada limpa. Não acumula chamadas.
  3. **`visibilitychange` listener** — quando aba volta ao foco, força `fetchSessao()`. Pega casos de throttling residual.
  4. **Erro visível durante processando** — `ProcessandoPainel` recebe nova prop `erroFetch?: string | null` e exibe banner amber "Aviso: ... Estamos tentando novamente automaticamente." Mantém UX confiável.
- **Railway worker (`services/document-converter/src/extractor.js`):** retry com backoff exponencial em códigos transientes (`429/500/502/503/504`). 1 tentativa + 3 retries. Backoff `1s/2s/4s` (cap 8s). AbortError de timeout (60s) também entra no retry. Resolve cenário sessão 033 onde 7/16 arquivos Kauana falharam com "Gemini HTTP 503: high demand".

**Validação:** type-check limpo (só erros pré-existentes vitest não-bloqueantes), commit `db9e00d` push direto via PAT, build Vercel > 165s sem erros, produção respondendo `307`/`401` esperados em `gestao.ficcassilandia.com.br/diploma/processos/novo` e `/api/health` com TTFB 282ms.

**Pendente para próxima sessão:** validação end-to-end do retest Kauana 16 docs com Marcelo na UI real (esperado: extração completa, todos 16 arquivos, sem timeout, transição automática para form pronto via Realtime).

---

**Follow-up (mesma sessão 034, commit `1445461`, deploy dpl_Cj4mW READY 79s):** após o primeiro deploy, Marcelo retestou com sessão `dd970d89-ecc8-4406-94c3-71e05276068c` e bateu em outro sintoma: **"Não foi possível carregar a sessão — Failed to fetch"** no load inicial da Tela 2. DB confirmado como `rascunho`/version=2/`processing_ms=100486`/`erro_parcial=3/16` (Railway side OK, retry Gemini do fix anterior já reduziu de 7/16 → 3/16). Logs Supabase API mostraram apenas o PATCH do Railway, **zero GETs do frontend** → conclusão: `TypeError: Failed to fetch` no network layer, request nem chegava no server.

**Fix assertivo aplicado (sem mais iteração):**
1. `fetchSessao` ganhou loop interno de retry: até 3 tentativas com backoff `500ms/1s` em `TypeError`/`HTTP 5xx`/`NetworkError`. Erros 4xx e outros vão direto pra `setErroFetch` sem retry (não melhoram).
2. Novo estado `falhasConsecutivas` + constante `FALHAS_LIMIAR_ERRO = 3`. Render guard `if (erroFetch && !sessao)` virou `if (erroFetch && !sessao && falhasConsecutivas >= 3)` → só exibe painel de erro após 3 falhas de fetch consecutivas (cada uma já com 3 retries = **até 9 tentativas reais** antes de incomodar o usuário). Absorve flake de rede/deploy transição.
3. Handler `tentarNovamente` + prop opcional `onTentarNovamente` no `ErroPainel` — botão violeta "Tentar novamente" com ícone `RefreshCw`, reseta contador e re-chama `fetchSessao`. Botão "Voltar" segue como fallback.
4. **Realtime agora é import dinâmico** (`import("@/lib/supabase/client").then(...)`) — isola o módulo Supabase do bundle inicial. Se o `createClient()` ou a subscribe falharem por qualquer motivo, cai em `console.warn` e o polling + visibilitychange assumem sozinhos. Nenhum impacto no fetch principal.

**Por que essa combinação funciona:** o bug original era "Failed to fetch" no **primeiro** fetch, antes do `sessao` existir. Antes, isso ia direto pro painel de erro porque `erroFetch && !sessao`. Agora o painel só aparece depois que 9 tentativas reais falharam, e mesmo assim o usuário tem botão pra tentar de novo sem sair da tela. O Realtime dinâmico elimina qualquer cenário em que o módulo `@supabase/ssr` esteja causando erro de bundling/hydration no load inicial.

**Validação:** tsc limpo (só vitest pré-existente), commit `1445461` push direto via `origin/main` (remote correto = `diploma-digital`, não `erp-educacional`), deploy `dpl_Cj4mWsaksSHvByFYGYA6of2cVo8X` **READY em 79s** (`buildingAt=1775767882606` → `ready=1775767961123`), aliased em `gestao.ficcassilandia.com.br` + `diploma.ficcassilandia.com.br`.

**Ainda pendente:** (a) retest Marcelo na UI com hard reload (Cmd+Shift+R) pra garantir bundle novo; (b) questão separada do Gemini 3/16 falhas — retry de 4 tentativas ainda deixa arquivos caindo, pode precisar subir `MAX_TENTATIVAS` ou revisar concorrência Railway × quota Gemini.
