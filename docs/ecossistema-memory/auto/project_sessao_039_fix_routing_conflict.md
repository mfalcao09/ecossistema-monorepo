---
name: Sessão 039 — fix conflito de rotas [id] vs [sessaoId] (causa raiz REAL dos 504)
description: Causa raiz definitiva dos 504 persistentes na Tela 2 — conflito de segmentos dinâmicos [id] vs [sessaoId] no mesmo nível do App Router causava Unhandled Rejection em 100% das invocações
type: project
---

**Sessão 039 (09/04/2026 — commit 935935d, deploy dpl_A7aWqPrS5UiiHCg3SSPNPJ65pwTg READY)**

**Contexto:** Após 8 sessões consecutivas (031→038) tentando fixes de resiliência (paralelização, timeouts, AbortController, split lite/heavy, etc.), a Tela 2 CONTINUAVA travada em "Carregando sessão..." indefinidamente. Deploy da sessão 038 (paralelização total) ficou READY mas não resolveu.

**Diagnóstico definitivo:**
- Busca por `[sessoes-route]` nos Vercel runtime logs = **ZERO resultados**
- A serverless function **NUNCA executou nosso código** — crashava antes
- Edge-middleware logava `status=200` normalmente (encaminhava o request ok)
- Logs mostravam "Unhandled Rejection: Error:..." em TODAS as invocações
- Causa: Next.js App Router **proíbe** segmentos dinâmicos com nomes diferentes no mesmo nível de diretório

**Causa raiz:**
```
/api/extracao/sessoes/[id]/           ← route.ts, callback/, descartar/
/api/extracao/sessoes/[sessaoId]/     ← converter/
```
Dois nomes (`[id]` e `[sessaoId]`) para o mesmo slot dinâmico. O build passa silenciosamente, mas em runtime o router do Next.js falha com Unhandled Rejection em 100% dos requests para qualquer rota sob `/api/extracao/sessoes/`.

**Fix aplicado:**
1. Mover `[sessaoId]/converter/route.ts` → `[id]/converter/route.ts`
2. Deletar diretório `[sessaoId]` conflitante
3. A rota converter já extraía sessaoId via regex do URL (não usava params), então zero mudanças de código foram necessárias
4. Limpar console.logs diagnósticos excessivos do commit anterior

**Deploy intermediários nesta sessão:**
- `dpl_9Dsn` (commit 14e6da8) = ERROR: TS error `Property 'message' does not exist on type 'never'`
- `dpl_Ap1S` (commit fa61b02) = READY: fix do TS + logs diagnósticos (revelou que os logs NÃO apareciam → função nunca executava)
- `dpl_A7aW` (commit 935935d) = READY: fix definitivo do conflito de rotas

**Pendência:** Marcelo precisa refazer login (auth expirada) e recarregar Tela 2 para confirmar o fix. Nenhum request atingiu o novo deploy ainda (runtime logs vazios).

**Why:** Sessões 031-038 atacavam SINTOMAS (timeouts, retries, polling) de um problema que NÃO era de performance — era um crash de roteamento que impedia a função de sequer inicializar. Esta é a causa raiz real. Todos os fixes de resiliência anteriores (Realtime, AbortController, split lite/heavy, paralelização) são melhorias válidas mas não podiam resolver o problema fundamental.

**How to apply:** SEMPRE verificar que todos os diretórios dinâmicos no mesmo nível usam o MESMO nome de segmento (ex: todos `[id]`, nunca misturar `[id]` com `[sessaoId]`). O build do Next.js NÃO detecta este conflito — é um bug silencioso que só aparece em runtime. Ao criar subrotas, verificar o nome do segmento pai.
