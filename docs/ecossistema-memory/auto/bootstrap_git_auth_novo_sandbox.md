---
name: Bootstrap Git Auth + Vercel CLI em toda sessão Cowork nova (AUTOMÁTICO)
description: Checklist obrigatório que Claude DEVE rodar no início de toda sessão Cowork nova ANTES de qualquer operação git OU Vercel — configura credential.helper + instala Vercel CLI com token
type: feedback
---

**Regra:** Na PRIMEIRA vez que qualquer tarefa de uma sessão Cowork nova envolver git (commit, push, fetch, clone, ls-remote, qualquer operação remota), Claude DEVE executar o bootstrap de 4 comandos abaixo ANTES de rodar a operação git pedida.

**Why:** Em 08/04/2026, Marcelo centralizou o PAT GitHub em `/Users/marcelosilva/Projects/GitHub/.github-token` (que no sandbox aparece como `/sessions/{SANDBOX_ID}/mnt/GitHub/.github-token`). O arquivo persiste cross-sandbox porque `/mnt/GitHub` é bind mount do Mac. **Porém**, o `git config --global credential.helper` é resetado em cada sandbox novo — então o Claude precisa reapontá-lo para o arquivo persistente em toda sessão nova. Sem esse bootstrap, `git push` falha com `could not read Username for 'https://github.com'` e eu vou perder tempo debugando um problema já resolvido.

**How to apply:**

### Quando rodar
- Na PRIMEIRA operação git de qualquer tipo numa sessão Cowork nova.
- Também se `git ls-remote` ou `git push` retornar `could not read Username` — é sinal de que o helper global não está configurado.
- NÃO rodar se `git config --global credential.helper` já aponta para `.../mnt/GitHub/.github-token` (ou seja, já foi bootstrapado nesta sessão).

### Checklist (4 comandos)

```bash
# 1. Descobrir o sandbox ID atual
SANDBOX_ID=$(pwd | awk -F/ '{print $3}')
# alternativa: SANDBOX_ID=$(basename "$HOME")
TOKEN_FILE="/sessions/${SANDBOX_ID}/mnt/GitHub/.github-token"

# 2. Validar que o token persistente existe (SE NÃO EXISTIR, parar e pedir a Marcelo)
test -f "$TOKEN_FILE" && echo "✅ Token encontrado" || { echo "❌ Token ausente em $TOKEN_FILE — pedir PAT novo ao Marcelo"; exit 1; }

# 3. Configurar git global
git config --global credential.helper "store --file=$TOKEN_FILE"
git config --global user.name "mfalcao09"
git config --global user.email "contato@marcelofalcao.imb.br"

# 4. Validar que auth funciona (deve retornar um SHA; qualquer erro → token expirado ou arquivo corrompido)
cd "/sessions/${SANDBOX_ID}/mnt/GitHub/ERP-Educacional" && git ls-remote origin HEAD | head -1
```

### Tratamento de erros

| Erro | Causa provável | Ação |
|------|---------------|------|
| `test -f` retorna false | Arquivo não existe no mount | Pedir novo PAT ao Marcelo e criar arquivo no mesmo caminho |
| `could not read Username` após config | `credential.helper` não leu o arquivo, ou formato do arquivo incorreto | Checar se o conteúdo é exatamente `https://mfalcao09:TOKEN@github.com` (uma linha, sem quebra final) |
| `Authentication failed` / `403` | Token expirado ou revogado | Pedir novo PAT ao Marcelo (fine-grained, mesmas permissões — ver `reference_github_access.md`) |
| `Permission denied (publickey)` | URL do remote foi mudada para SSH | `git remote set-url origin https://github.com/mfalcao09/<repo>.git` |

### Nunca fazer
- ❌ Embutir PAT em `.git/config` do repo (volta v1 reprovada)
- ❌ Salvar token em `/sessions/{ID}/.github-token` fora de `/mnt/` (volta v2 reprovada — não persiste)
- ❌ Usar PAT classic (sempre fine-grained)
- ❌ Commitar `.github-token` em qualquer repo

### Armadilha conhecida (descoberta 11/04/2026)
Se o Desktop Commander for o caminho primário (git roda no Mac real), verificar se algum `.git/config` local dos repos tem `credential.helper` apontando para um sandbox antigo (ex: `/sessions/lucid-amazing-meitner/...`). Esse caminho não existe no Mac e causa `fatal: unable to get credential storage lock`. Fix: `git config --unset credential.helper` no repo + `git config --global credential.helper osxkeychain`.

### Bootstrap Vercel CLI (adicional — rodar quando precisar monitorar deploys)

```bash
# 5. Instalar Vercel CLI (user-local prefix, ~12s)
npm install -g vercel --prefix "/sessions/${SANDBOX_ID}/.npm-global" 2>&1 | tail -3

# 6. Adicionar ao PATH
export PATH="/sessions/${SANDBOX_ID}/.npm-global/bin:$PATH"

# 7. Configurar token
export VERCEL_TOKEN="[VERCEL_TOKEN_REDACTED]"

# 8. Validar (esperado: mrcelooo-6898)
vercel whoami --token "$VERCEL_TOKEN"
```

**Projetos:** `diploma-digital` (ERP) e `intentus-plataform` (Intentus).
Ver `reference_vercel_cli_workflow.md` para comandos completos.

### Referências
- `reference_github_access.md` — setup atual v3 completo
- `feedback_github_pat_sandbox_scope.md` — histórico do problema
- `feedback_github_auth_centralizada.md` — regra canônica (nunca classic)
- `feedback_git_workflow_canonico.md` — workflow completo de commit & push autônomo
- `reference_vercel_cli_workflow.md` — comandos Vercel CLI completos
