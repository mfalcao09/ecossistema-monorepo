---
name: Sprint 2 Etapa 1.2 — rotas Next.js do callback Railway entregue
description: Etapa 1.2 Sprint 2 entregue (commit f9739e46, deploy READY 08/04): POST /api/extracao/iniciar + PUT /callback com nonce 1-uso e lock por processo_id
type: project
---

Entrega da Etapa 1.2 do Sprint 2 (fechamento do loop com o document-converter Railway da Etapa 1.1).

**Commit:** `f9739e46c66be00d7bf8bd0ec96791d5688dffe6`
**Deploy:** `dpl_BgywoY7RtUZFjSbM7tsxCyEy6cqW` READY em ~71s (build 08/04/2026)
**Arquivos:** 4 novos, 786 linhas
- `src/app/api/extracao/iniciar/route.ts` — POST autenticado, cria sessão, gera signed URLs (TTL 600s), dispara Railway com await+AbortSignal(15s)
- `src/app/api/extracao/sessoes/[id]/callback/route.ts` — PUT público (sem protegerRota), autentica via shared secret + nonce 1-uso, UPDATE atômico
- `src/lib/extracao/callback-auth.ts` — helpers de nonce, constant-time compare, URL builder
- `supabase/migrations/20260408_sprint2_extracao_callback_nonce.sql` — mirror da migration já aplicada via Supabase MCP (6 colunas, 3 unique partial indexes, 1 CHECK)

**Decisões arquiteturais ratificadas na sessão:**
- **1C**: nonce 1-uso (256 bits hex) embedado na query string do callback_url — Railway trata URL como opaque, zero mudança do lado Railway
- **2B**: signed URL TTL 600s (10 min) — suficiente pro Gemini baixar tudo antes de expirar, curto pra minimizar exposição
- **3B**: lock lógico via UNIQUE INDEX parcial — um por `processo_id IS NOT NULL`, outro por `usuario_id` quando `processo_id IS NULL` (drag-and-drop pré-criação). Colisão → 23505 → 409 na rota.

**Code review Buchecha (MiniMax M2.7) — validações:**
- **Ponto 4 (fire-and-forget Vercel) ✅ VÁLIDO**: `maxDuration` estende CPU time mas NÃO salva `fetch()` sem `await` em serverless. Node.js encerra conexões HTTP ativas quando o handler retorna. **Fix aplicado:** trocar por `await fetch()` + `AbortSignal.timeout(15_000)`. Railway já responde 202 em 100-500ms, então o await é rápido. Helper `marcarSessaoComoErro` criado pra evitar duplicação entre catch e !res.ok.
- **Ponto 1 (race benigna marcar-erro-pós-Railway) ✅ ENDEREÇADO**: adicionado filtro `.eq('status', 'processando')` + warning log quando 0 rows afetadas. Callback é fonte da verdade, race vencida pelo callback é comportamento desejado.
- **Ponto 3 (nonce READ COMMITTED) ❌ FALSO POSITIVO**: Buchecha descreveu um SELECT+UPDATE, mas o código usa UPDATE único. PostgREST/Postgres re-avalia a WHERE contra a row version atualizada após o primeiro updater commitar — o segundo UPDATE vê `callback_nonce_used_at IS NOT NULL` e retorna 0 rows. Belt-and-suspenders via UNIQUE INDEX em `callback_nonce`.

**DeepSeek MCP offline** nesta sessão — review feita apenas com Buchecha.

**Why:** Era o último gap pra ter o pipeline de extração funcional end-to-end. Com isso, o fluxo Sprint 2 fica: front faz upload → POST /iniciar cria sessão + dispara Railway → Railway extrai com Gemini → PUT /callback grava resultado → front faz polling/re-fetch pela `version`.

**How to apply:** Quando forem implementadas as próximas etapas do Sprint 2 (UI de drag-and-drop, polling, gate de criação de processo), o contrato é: sempre chamar POST /iniciar da UI autenticada, NUNCA dar ao front acesso ao callback (é interno Railway↔Next), e usar o campo `version` retornado como race guard em qualquer edição pós-extração.
