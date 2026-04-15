---
name: Definition of Done = deploy Vercel READY
description: Commit + push NÃO é "tarefa concluída". Só está encerrado quando o deploy Vercel retornar `READY`. Se der `ERROR`, a IA autonomamente lê build logs, corrige, commita e pusha de novo — até `READY` ou stop condition.
type: feedback
---

# Definition of Done = deploy Vercel `READY`

**A regra:** em projetos que fazem deploy Vercel (ERP-Educacional, Intentus), `git commit` + `git push` **não** fecha a tarefa. O ciclo só termina quando o `get_deployment` retornar `READY` e a validação pós-verde (Sentry / advisors / runtime logs) passar.

**Why:** push pode quebrar build no Vercel mesmo depois de passar `tsc --noEmit` e `next build` locais — dependências faltantes, env vars divergentes, edge function config, etc. Declarar "pronto" sem monitorar o deploy esconde regressões que só aparecem quando Marcelo abre o app minutos depois. Diretriz ditada por Marcelo em 08/04/2026 logo após confirmarmos que Desktop Commander + Keychain destravam o ciclo 100% autônomo.

**How to apply (o ciclo completo):**
1. Desktop Commander → `git commit` + `git push`
2. **Vercel CLI** → `vercel list <project> --token "$VERCEL_TOKEN"` → pegar URL do deploy mais recente (topo da lista)
3. **Vercel CLI** → `vercel inspect <url> --wait --token "$VERCEL_TOKEN"` (bloqueia até finalizar). Ou polling manual com `vercel inspect <url>`:
   - `● Building` → aguardar e repetir
   - `● Ready` → ✅ seguir para validação pós-verde
   - `● Error` / `● Canceled` → ❌ entrar no ciclo corretivo
4. **Ciclo corretivo (se Error):**
   - `vercel inspect <url>` + `vercel logs <url> --token "$VERCEL_TOKEN"` → ler output completo
   - Diagnosticar causa (TS error / missing dep / env var / etc.)
   - `Edit` no arquivo ofensor
   - Re-rodar `tsc` + `build` local (OBRIGATÓRIO antes de pushar de novo)
   - Code review com Buchecha se correção não for trivial
   - `git add` + `commit` + `push` → voltar ao passo 2
5. **Validação pós-verde (só após Ready):**
   - Sentry `search_issues` últimos 15min → zero regressões
   - Supabase `get_advisors` se houve migration
   - **Vercel CLI** `vercel logs <url>` se tocou API/edge function → zero 5xx
6. **Só então** comunicar entrega final a Marcelo.

**Nota (11/04/2026):** MCP Vercel perdeu conexão. Vercel CLI com `$VERCEL_TOKEN` env var substitui todas as operações de monitoramento. CLI precisa ser reinstalado a cada sessão Cowork nova (ver `bootstrap_git_auth_novo_sandbox.md`).

**Stop conditions — escalar para Marcelo:**
- 3× mesmo erro no mesmo arquivo (loop detectado)
- Causa fora do alcance: secret rotacionado, env var faltando, problema de infra
- Marcelo interromper explicitamente

**Comunicação durante o loop:** status intermediário é permitido ("push feito, deploy BUILDING, monitorando") — mas **nunca** declarar a tarefa concluída antes do `READY` + validação pós-verde.

**Timeout do loop:** 10 minutos por iteração. Se estourar sem mudança de estado, logar e alertar (provavelmente anomalia no Vercel, não no código).

Ver `GIT-WORKFLOW-AUTONOMO.md` §3 fase G (G.1-G.4), §7 (checklist), regras 17-18.
