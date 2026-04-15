---
name: Sessão 037b — fix timeout Tela 2 (AbortController 12→35s)
description: Bug segunda camada pós sessão 036 — AbortController 12s abortava fetch do GET heavy antes do server responder, mostrando "signal is aborted without reason" cru ao usuário
type: project
---

**Sessão 037b (09/04/2026 — commit 13fb0ea)**

Bug: Marcelo retestou com Kauana 16 docs após fix sessão 037a (callback_url no Railway), e a Tela 2 mostrou "Não foi possível carregar a sessão — signal is aborted without reason".

**Diagnóstico definitivo via DB:**
```sql
SELECT * FROM extracao_sessoes WHERE id='9119fce3-90b3-4edb-bd2e-5ea8ff80c8e6'
→ status=rascunho, version=2, processing_ms=112728, qtd_arquivos=16,
  dados_extraidos populado, erro_mensagem=NULL
```
Backend 100% ok. Bug era puramente client-side.

**Causa raiz:**
Sessão 036 introduziu AbortController com `FETCH_TIMEOUT_MS = 12_000`. Quando sessão entra em `rascunho` (status final), o GET `/api/extracao/sessoes/[id]` segue o caminho HEAVY e serializa `dados_extraidos` + `arquivos` JSONB — para 16 docs é payload de vários MB. Cold start + serialização pesada leva 15-25s facilmente. `maxDuration` do route é 30s, mas cliente abortava em 12s. Todas as 9 tentativas (3 retries × 3 grace period) abortavam cedo demais.

**Fix (src/app/(erp)/diploma/processos/novo/revisao/[sessaoId]/page.tsx):**
1. `FETCH_TIMEOUT_MS: 12_000 → 35_000` (maxDuration + 5s margem)
2. Backoff 500ms → 500ms/1.5s/3s (dá tempo pro cold start esquentar)
3. Catch final: AbortError vira mensagem PT "Tempo limite ao carregar a sessão. Os dados podem já estar prontos — clique em Tentar novamente." em vez do DOMException raw

**Meta-lição:**
AbortController é pra matar pending infinito (conexão morta), NÃO pra timeout agressivo de perf. Calibrar sempre `FETCH_TIMEOUT_MS > route.maxDuration`. Errar pro outro lado causa bug fantasma: servidor responde com sucesso, cliente já desistiu, usuário vê erro cru de DOMException.

**Why:** 4 sessões consecutivas (034→035→036→037) tentando fazer a Tela 2 aguentar Kauana 16 docs. Cada fix revelou a próxima camada. Esta provavelmente é a última — dados já estão gravados, timeout calibrado pro server, mensagem amigável.

**How to apply:** Em qualquer hook de polling com payload grande, verificar que timeout client > maxDuration server. Quando abortar, nunca mostrar DOMException cru.
