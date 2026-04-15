---
name: Sessão 035 — Split lite/heavy no GET extração (mata 504)
description: Causa raiz do "Failed to fetch" na Tela 2 era 504 no handler GET devolvendo JSONB pesado a cada poll — split lite (sempre) vs heavy (só rascunho/concluído)
type: project
---

**Sessão 035 (09/04/2026, commit `1869807`, deploy `dpl_E8yRZxBjeXFqGfjJqHS4Mx9gVFq4` READY 78s):** fecha o bug recorrente da Tela 2 da Kauana 16 docs atacando a **causa raiz server-side**, não mais o sintoma client-side.

**Why:** toda a sessão 034 (commits `db9e00d` e `1445461`) tratava o "Failed to fetch" como flake de rede e adicionou camadas de resiliência no frontend (Realtime, visibilitychange, retry 3x, grace period 9 tentativas, Realtime dinâmico). Marcelo retestou **duas vezes** e continuou quebrando — a segunda vez como **loader infinito** ("travou") em vez de painel de erro. Pulei do frontend pro Vercel runtime logs via MCP e achei a smoking gun: **21:18:36 GET `/api/extracao/sessoes/c9758484-2793-417f-a7e4-ead25fa96f67` → 504**, 1 segundo depois do page load. Ou seja, o primeiro poll batia no handler e a função serverless estourava o timeout antes de serializar o payload. Frontend NÃO tinha erro de rede — o servidor é que estava travando. 9 retries × 30s maxDuration nunca resolveria.

**Causa raiz técnica:** `src/app/api/extracao/sessoes/[id]/route.ts` tinha um `SELECT_PUBLICO` único que incluía 5 colunas JSONB pesadas (`arquivos`, `dados_extraidos`, `dados_confirmados`, `campos_faltando`, `confianca_campos`) + segunda query em `processo_arquivos` por `sessao_id`. Em sessão 16 docs da Kauana, `dados_extraidos` tinha vários MB de output Gemini. A cada poll de 3s o handler:
1. lia ~vários MB de JSONB de um registro único (Postgres OK, rede Supabase→Vercel lenta)
2. serializava via `NextResponse.json` (CPU)
3. fazia segunda query Supabase
4. streama o payload pro cliente
Total > 10s, Vercel edge devolvia 504 silencioso ao browser. TypeError "Failed to fetch" não era rede caída, era o edge encerrando a conexão.

**Fix aplicado:**
```ts
// SELECT_LITE — sempre. 12 colunas leves, <500 bytes
const SELECT_LITE = 'id, processo_id, status, confianca_geral, erro_mensagem, erro_parcial, iniciado_em, finalizado_em, processing_ms, version, created_at, updated_at'

// SELECT_HEAVY — só quando status final. 5 colunas JSONB pesadas
const SELECT_HEAVY = 'arquivos, dados_extraidos, dados_confirmados, campos_faltando, confianca_campos'
```

Lógica do handler GET:
1. Fetch LITE (sempre) — `.eq('id', x).eq('usuario_id', userId).maybeSingle()`
2. Se `status === 'processando'` ou `'pendente'`: devolve `{ ...lite, arquivos: [], dados_extraidos: null, dados_confirmados: null, campos_faltando: [], confianca_campos: null, processo_arquivos: [], _lite: true }` — payload <1KB, serialização instantânea, zero 504. Compat preservada porque front espera essas chaves mesmo vazias.
3. Se status ≠ processando/pendente: segundo fetch HEAVY + query `processo_arquivos` → hidratação completa para o formulário. Só roda **uma vez**, quando Realtime/polling detecta `status === 'rascunho'`.

**How to apply:**
- Polling durante loading agora custa ~500 bytes vs ~vários MB — elimina bandwidth bottleneck do edge
- Heavy fetch + processo_arquivos só roda **uma** vez, após extração terminar
- Commit 1445461 (retry + grace period + Realtime dinâmico) continua no código como defesa em profundidade — útil pro cenário de flake real de rede
- Padrão generalizável: **toda rota de polling que devolve JSONB deve separar metadata (lite) vs payload (heavy)**. Aplicar em futuras rotas `/api/*/status` no ERP.
- `_lite: true` no response marca explicitamente que é versão reduzida, caso no futuro algum consumidor queira diferenciar

**Validação:** type-check limpo (só 2 erros pré-existentes `Cannot find module 'vitest'` não-bloqueantes), commit `1869807` push direto via PAT fine-grained em `/mnt/GitHub/.github-token`, deploy Vercel READY em **78s** (`buildingAt=1775770962390` → `ready=1775771040912`), aliased em `gestao.ficcassilandia.com.br` + `diploma.ficcassilandia.com.br`.

**Smoking gun do diagnóstico:** Vercel runtime logs via MCP `get_runtime_logs` mostraram:
- 21:18:35 GET `/diploma/processos/novo/revisao/c9758484...` → **200** (page load ok)
- 21:18:36 GET `/api/extracao/sessoes/c9758484...` → **504** (1s depois, primeiro poll)
- 21:27:43 GET → 200 (9 min depois, via visibilitychange quando Marcelo voltou à aba)

**Pendente:** (a) retest Marcelo em UI com hard reload para bundle novo; (b) Gemini 2/16 falhas na Kauana ainda — progresso de 7→3→2, pode precisar aumentar `MAX_TENTATIVAS` ou reduzir `EXTRACAO_CONCORRENCIA` vs quota; (c) tech-debt: aplicar padrão lite/heavy nas outras rotas de polling do ERP se existirem.
