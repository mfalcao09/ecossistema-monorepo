---
name: Sessão 027 — Push sessão 026 destravado
description: Push pendente da sessão 026 (commit 6278116) destravado via workaround /tmp clone + GIT-WORKFLOW v3; deploy Vercel READY
type: project
---

**Data:** 08/04/2026 (sandbox `wonderful-gracious-mayer`)

**Ação:** Destravar o push pendente da sessão 026 que estava bloqueado pelo gap de PAT cross-sandbox.

**Sequência executada (GIT-WORKFLOW-AUTONOMO.md v3 §6.4):**

1. Bootstrap git auth v3 (4 comandos) com `credential.helper` apontando para `/mnt/GitHub/.github-token` (bind mount cross-sandbox) — ls-remote OK na primeira tentativa.
2. Fetch origin → divergência real era 1↑/18↓ (não 1↑/9↓ do estado estale).
3. Diagnóstico: commit local `6278116` (fix diplomados + tsconfig vitest exclude) zero overlap com os 18 commits remotos → cherry-pick limpo.
4. Clone fresh em `/tmp/work-clone` (workaround §6.4 para FUSE/bindfs).
5. `git format-patch 6278116 -1` no bindfs + `git am` no clone /tmp → novo SHA `fb8d07c`.
6. `npm install` (527 pacotes, 30s) + `npx next build` completo no clone — build limpo, 3 arquivos `11+/13-`.
7. `git push origin main` → `adde8d4..fb8d07c` OK.
8. Vercel `dpl_7fnVdjtAEg8Dt472p2dc7j1UQc4q` BUILDING → READY em 80s. Aliases `gestao.ficcassilandia.com.br` e `diploma.ficcassilandia.com.br` apontando para `fb8d07c`.

**Conteúdo do commit `fb8d07c` (antes `6278116`):**
- `/api/diplomados` GET filtra com `diplomas!inner` por status (`registrado`, `gerando_rvdd`, `rvdd_gerado`, `publicado`) — diplomado = pessoa com ≥1 diploma registrado pela UFMS.
- Página `/diploma/diplomados`: remove botão "Novo Diplomado" + texto atualizado.
- `tsconfig.json`: exclui `vitest.config.ts` do type-check do `next build` (corrige deploy ERROR `dpl_36uh3fNyW`).

**Estado do bindfs pós-push:**
- HEAD local ainda em `6278116` (commit obsoleto) + 19 behind.
- `git reset --hard origin/main` bloqueado por locks FUSE (`.git/index.lock`, `.git/HEAD.lock`) — comportamento esperado, documentado em `feedback_git_fuse_workaround.md`.
- Próxima sessão que precisar mexer no código deve usar workaround `/tmp clone` ou trabalhar direto no sandbox com estado limpo (não afeta produção).

**Why:** Fechar o ciclo da sessão 026 antes de começar o plano técnico do fluxo de criação do processo + expedição histórico-PDF (sessão seguinte). Marcelo já aprovou as respostas Q1-Q5 e aguarda o plano técnico completo ANTES de qualquer código.

**How to apply:** Na próxima sessão, começar pelo plano técnico completo (schema BD 3 destinos, React tela revisão pós-extração, gate FIC 4 comprobatórios, template histórico-PDF, botão Gerar PDF sob demanda, stubs módulo Expedição) — sem tocar em código até OK explícito. Bindfs provavelmente vai precisar ser descartado/recriado antes de trabalhar em código nele.

**Commits em produção:** `fb8d07c` (HEAD origin/main) — motor XML 12/12 + fix diplomados + build Vercel corrigido.
