---
name: Sessão 036 — AbortController 12s mata fetch pendente infinito
description: Após lite/heavy ainda restava bug de fetch pendente no cold start — sem AbortController o browser nunca sabia que edge abortou, .then() inicial nunca disparava, polling nunca começava
type: project
---

**Sessão 036 (09/04/2026, commit `6ed2db6`, deploy `dpl_e7CYkxFfUEdj9W3BvYSk9ApgtUwe` READY 77s):** fix residual pós-sessão 035. Mesmo com o split lite/heavy deployed, Marcelo retestou e continuou vendo "Carregando sessão..." por 9 minutos na sessão `cc969b35-af66-4c73-9ef3-a8c3188ff1d1`.

**Smoking gun (Vercel runtime logs via MCP):**
- 21:47:13 GET `/diploma/processos/novo/revisao/cc969b35...` → **200** (page load ok)
- 21:47:14 GET `/api/extracao/sessoes/cc969b35...` → **504** (primeiro poll, cold start)
- 21:58:09 GET `/api/extracao/sessoes/cc969b35...` → **200** (11 min depois, via visibilitychange quando Marcelo voltou à aba)
- **NENHUM poll entre 21:47:14 e 21:58:09** — prova incontestável que `tick()` nunca foi agendado

**Causa raiz técnica:** `fetchSessao` em `src/app/(erp)/diploma/processos/novo/revisao/[sessaoId]/page.tsx` não tinha `AbortController`. O cold start do serverless Vercel (Node 9 runtime + Supabase client init + `verificarAuth`) na primeira requisição após deploy demorou o suficiente para a edge network retornar 504 server-side. Mas **o browser nunca soube** — o `fetch()` ficou em estado pending infinito porque o TCP não fechou limpamente. Consequência em cadeia:
1. `await fetch(...)` do try nunca resolveu
2. `.then()` do dispatch inicial nunca disparou
3. `timeoutId = setTimeout(tick, POLL_INTERVAL_MS)` nunca agendou
4. `tempoDecorrido` ficou em 0, `timeoutEstourado` nunca foi `true`
5. `erroFetch` ficou null (nenhum catch rodou)
6. `falhasConsecutivas` ficou 0 (não acionou painel de erro)
7. Render guard `if (!sessao) return <Loader...>` permaneceu ativo indefinidamente

O DB confirmou que a sessão era trivialmente pequena: `arquivos_size=819B`, `dados_size=1612B`, `confirmados/faltando/confianca = 5B cada`, `n_arquivos=16`. Total <2.5KB. EXPLAIN ANALYZE: 0.7ms execução, 29ms planning. Nada no banco ou no handler justificava demora — era cold start puro + falta de defense-in-depth client-side.

**Fix aplicado em page.tsx:**
```ts
const FETCH_TIMEOUT_MS = 12_000
const fetchSessao = useCallback(async () => {
  // ...
  for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
    const controller = new AbortController()
    const timeoutRef = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(`/api/extracao/sessoes/${sessaoId}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      // ...
    } catch (err) {
      const ehAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        /abort/i.test(msg)
      const ehRede = err instanceof TypeError || ehAbort || /Failed to fetch|HTTP 5\d\d/.test(msg)
      // ...
    } finally {
      clearTimeout(timeoutRef)
    }
  }
})
```

Timeout duro de 12s por tentativa. Se o handler não responder, `controller.abort()` dispara client-side, `await fetch` rejeita com `DOMException name="AbortError"`, catch executa, `ehAbort=true`, `ehRede=true`, backoff 500ms, próxima tentativa. Após 3 tentativas (~40s worst case), `falhasConsecutivas++`. Três ciclos depois → painel de erro visível.

**How to apply:**
- **Toda chamada `fetch()` em polling client-side deve ter AbortController**. Sem ele, fetches pendentes travam a React state machine silenciosamente — é pior que erro, porque o usuário não vê nem painel de erro, só loader eterno.
- Padrão canônico: `const controller = new AbortController(); setTimeout(() => controller.abort(), TIMEOUT); fetch(url, { signal: controller.signal })` dentro de try/finally com clearTimeout.
- Incluir `DOMException name="AbortError"` no predicate de retry, senão o abort é tratado como erro fatal e nunca faz retry.
- Defense-in-depth stack atual da Tela 2: AbortController 12s (036) → Realtime Supabase (034) → visibilitychange (034) → setTimeout encadeado (034) → retry 3x com backoff (034) → grace period 9 falhas antes de error panel (034) → split lite/heavy no handler (035). Cada camada cobre um modo de falha diferente.

**Validação:** type-check limpo, commit `6ed2db6` push via PAT fine-grained, deploy `dpl_e7CYkxFfUEdj9W3BvYSk9ApgtUwe` READY em 77s, aliased em `gestao.ficcassilandia.com.br` + `diploma.ficcassilandia.com.br`.

**Pendente:** retest do Marcelo em UI com hard reload (Cmd+Shift+R) pra garantir bundle novo. Se persistir, próximo passo é edge runtime na rota GET para eliminar cold start, ou cachear `createClient()` como singleton module-level.
