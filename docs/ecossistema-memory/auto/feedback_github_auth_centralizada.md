---
name: GitHub Auth Centralizada — fine-grained PAT, nunca classic, nunca embutido
description: Regra cross-project para autenticação GitHub no Cowork sandbox — usar credential.helper global, jamais embutir token em .git/config
type: feedback
---

Para todos os projetos `mfalcao09/*`, autenticação GitHub é centralizada via fine-grained PAT único + `credential.helper store` global do git, lendo de `/sessions/sleepy-nifty-cerf/.github-token`.

**Why:** Em 08/04/2026, durante consolidação do `GIT-WORKFLOW-AUTONOMO.md`, descobrimos que o ERP-Educacional tinha um PAT classic embutido em texto puro dentro de `.git/config` (`https://mfalcao09:TOKEN@github.com/...`). Isso era inseguro (escopo total, sem expiração, vazaria se alguém copiasse o config) e não escalava (Intentus não tinha token configurado, então push autônomo de lá falharia). Marcelo escolheu o caminho "fine-grained PAT único + credential.helper global" para ter segurança E praticidade. Setup validado em ERP e Intentus, PAT classic antigo foi revogado.

**How to apply:**

1. Antes de qualquer `git push` em projeto novo, verificar que o remote NÃO tem token embutido: `git remote -v` deve mostrar `https://github.com/mfalcao09/<repo>.git` puro. Se tiver `https://user:token@...`, limpar com `git remote set-url origin https://github.com/mfalcao09/<repo>.git`.
2. Nunca sugerir nem aceitar pedido para embutir PAT na URL do remote — sempre redirecionar para o `credential.helper` global.
3. Nunca sugerir nem aceitar criação de PAT classic — sempre fine-grained com permissões mínimas: `Contents:RW + Metadata:R + PullRequests:RW` (adicionar `Workflows:RW` apenas se o projeto tiver GitHub Actions, e remover depois).
4. Se `git push` pedir senha em qualquer projeto, NÃO colar token nem sugerir embuti-lo — primeiro diagnosticar:
   - `cat /sessions/sleepy-nifty-cerf/.github-token` (existe?)
   - `git config --global credential.helper` (aponta pro arquivo certo?)
   - Se ambos OK e ainda pede senha → token expirou ou foi revogado → pedir novo ao Marcelo.
5. Procedimento de rotação e setup inicial em sandbox nova: ver `GitHub/GIT-WORKFLOW-AUTONOMO.md §2.5`.
6. Pointer detalhado: `reference_github_access.md` (no auto-memory).
