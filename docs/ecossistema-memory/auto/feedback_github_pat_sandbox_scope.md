---
name: GitHub PAT cross-sandbox — RESOLVIDO via /mnt/GitHub/.github-token
description: Problema histórico de PAT preso a um sandbox Cowork foi resolvido em 08/04/2026 (v3) movendo o token para o bind mount /mnt/GitHub/ que persiste entre sessões. Esta memória é mantida como histórico para evitar reintroduzir a solução antiga falha.
type: feedback
---

**Status:** ✅ RESOLVIDO em 08/04/2026 (v3). Ver `reference_github_access.md` para o setup canônico atual.

## Histórico do problema (mantido como contexto para evitar regressão)

**Versão antiga (v2, falha):** O PAT era salvo em `/sessions/{SANDBOX_ID}/.github-token`. Esse caminho é **isolado por sandbox** — cada sessão Cowork abre com um sandbox ID diferente (ex: `sleepy-nifty-cerf`, `busy-determined-maxwell`, `zealous-hopeful-volta`) e os arquivos fora de `/mnt/` **NÃO são legíveis de outro sandbox**, mesmo sendo o mesmo usuário dono.

**Sintoma que Marcelo percebia:** "um projeto consegue push autônomo, o outro não". Era aleatório — dependia de qual sessão Cowork tinha configurado o token por último e qual sandbox estava ativo agora.

**Causa raiz:** `credential.helper store --file=/sessions/{ID}/.github-token` só funciona dentro daquele sandbox específico. Novas sessões abriam sem auth e cada tentativa de push/fetch falhava com `fatal: could not read Username for 'https://github.com': No such device or address`.

## Solução v3 (canônica)

**Why:** Marcelo propôs em 08/04/2026 mover o token para `/Users/marcelosilva/Projects/GitHub/.github-token` (que dentro do sandbox é `/sessions/{ID}/mnt/GitHub/.github-token`). Isso funciona porque a pasta `/mnt/GitHub/` é um **bind mount do Mac** — ela existe em TODO sandbox Cowork novo, automaticamente, com todos os arquivos persistidos. O token fica em disco no Mac dele, visível em qualquer sessão futura.

**How to apply:**

1. **Em toda sessão Cowork nova**, Claude deve rodar o bootstrap de auth ANTES de qualquer operação git. Ver `bootstrap_git_auth_novo_sandbox.md` para o checklist exato.
2. **Nunca mais** salvar token em `/sessions/{ID}/.github-token` (caminho fora de `/mnt/`) — não persiste.
3. **Nunca mais** embutir PAT em `.git/config` — inseguro, não escala, foi reprovado em 08/04/2026.
4. Se o bootstrap falhar (arquivo `/mnt/GitHub/.github-token` não existe), pedir PAT novo ao Marcelo e recriar o arquivo no mesmo caminho canônico.
5. Quando o token expirar, basta Marcelo sobrescrever o mesmo arquivo — nenhuma outra config muda.

## Documentação canônica

- `reference_github_access.md` — setup atual v3
- `bootstrap_git_auth_novo_sandbox.md` — checklist de bootstrap cross-sandbox
- `feedback_github_auth_centralizada.md` — regra canônica (nunca classic, nunca embutido)
- `GitHub/GIT-WORKFLOW-AUTONOMO.md §2.5` — runbook completo
