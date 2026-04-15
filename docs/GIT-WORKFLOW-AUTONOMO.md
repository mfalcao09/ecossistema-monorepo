# GIT-WORKFLOW-AUTONOMO.md — Padrão Cross-Project de Commit & Push

> **Propósito:** Padrão único de commit e push autônomo para TODOS os projetos do Marcelo (Intentus, ERP-Educacional, Ecossistema, Splendori, Nexvy, Klésis).
> Marcelo NÃO executa comandos de git manualmente. Claude executa ponta a ponta.
> **Localização permanente:** `/Users/marcelosilva/Projects/GitHub/GIT-WORKFLOW-AUTONOMO.md`
> **Versões específicas por projeto:** cada projeto pode ter um `memory/workflows/commit-push-autonomo.md` com adaptações (ex: ERP tem sessões paralelas, Intentus não).
> **Arquivos companheiros (mesma pasta):**
> - `CENTRAL-MEMORY.md` — memória master cross-project
> - `ONBOARDING-KIT.md` — template para novos projetos
> - `PROTOCOLO-MEMORIA.md` — como atualizar memória
> **Última atualização:** 11/04/2026 (v4.3 — Vercel CLI substitui MCP Vercel; Desktop Commander continua caminho primário para git)

---

## 0. 🔄 MUDANÇA DE PARADIGMA NA v4 — LER PRIMEIRO

A partir de **08/04/2026**, Claude tem **dois caminhos possíveis** para executar git:

| Caminho | Onde roda | Quando usar |
|---------|-----------|-------------|
| **🟢 PRIMÁRIO — Desktop Commander MCP** | Direto no macOS do Marcelo (processo `npx @wonderwhy-er/desktop-commander`) | **Sempre que disponível.** Bypassa FUSE/bindfs, usa credenciais nativas do git do Mac (Keychain), elimina workaround `/tmp`. |
| **🟡 FALLBACK — Sandbox Bash + bindfs `/mnt/GitHub`** | Dentro do sandbox Cowork, sobre bindfs | **Só se Desktop Commander não estiver instalado/disponível.** Mantém o setup v3 (PAT + credential.helper global). |

**Consequência prática:** a maior parte desta especificação (§2.5 auth PAT, §5 sessões paralelas, §6 troubleshooting FUSE/bindfs, §6.4 clone em `/tmp`) **continua válida como fallback**, mas **não é mais o caminho padrão**. Quando Desktop Commander está no ar, o Claude executa git no filesystem real do Mac — sem FUSE, sem bindfs, sem workaround.

Como saber em qual caminho estou? **Regra simples:** se o Claude conseguir listar os tools `mcp__desktop-commander__*` (via ToolSearch), caminho primário. Se não conseguir, fallback.

---

## 1. Princípio fundamental

**Autonomia total com verificação pós-deploy.** Claude edita, valida, commita, pusha, acompanha o deploy (Vercel) e confere erros (Sentry) — tudo sem intervenção do Marcelo.

Marcelo só é chamado para:
- Aprovar decisões de arquitetura que fogem do CLAUDE.md do projeto
- Confirmar operações destrutivas (`git reset --hard`, `git push --force`)
- Responder quando há ambiguidade real de requisito
- **Aceitar popups de permissão do macOS** na primeira execução de cada app via Apple MCP / Desktop Commander (acontece uma única vez por app por sessão do sistema)

---

## 2. Ferramentas do Cowork usadas

### 2.1 — Stack completa (v4)

| Fase | Caminho Primário (Desktop Commander) | Caminho Fallback (Sandbox) | Função |
|------|--------------------------------------|---------------------------|--------|
| Edição | `Read`, `Edit`, `Write` (via `/mnt/GitHub/`) ou `mcp__desktop-commander__{read_file,write_file,edit_block}` | `Read`, `Edit`, `Write` | Modificar arquivos-fonte |
| Busca | `Glob`, `Grep` ou `mcp__desktop-commander__start_search` | `Glob`, `Grep` | Localizar símbolos |
| Validação | `mcp__desktop-commander__start_process` → `npx tsc --noEmit`, `npx next build` (roda no Mac, sem overhead) | `Bash` → `tsc --noEmit`, `next build` | Type-check + build |
| Code review | Skills do Squad (`minimax-ai-assistant:review-minimax` obrigatório) | idem | Revisão antes do commit |
| **Git** | **`mcp__desktop-commander__start_process` → `git ...` direto no Mac (usa Keychain nativo)** | `Bash` → `git ...` via bindfs + PAT credential.helper (§2.5) | Operações git |
| Deploy check | **Vercel CLI** → `vercel list`, `vercel inspect --wait`, `vercel logs` (token via `$VERCEL_TOKEN`) | idem | Monitorar deploy |
| Banco (se migration) | MCP Supabase → `apply_migration`, `execute_sql`, `get_advisors`, `get_logs` | idem | Aplicar/validar schema |
| Erros pós-deploy | MCP Sentry → `search_issues`, `analyze_issue_with_seer` | idem | Detectar regressões |
| Orquestração | `TodoWrite` | idem | Tracking visível para Marcelo |

### 2.2 — Outros MCPs relacionados (desde 08/04/2026)

Além do Desktop Commander, Marcelo também instalou o **Apple MCP** (`@dhravya/apple-mcp` via `bunx`), que dá acesso a apps nativos do macOS (Notas, Calendário, Mail, Mensagens, Lembretes, Contatos, Maps, WebSearch). **O Apple MCP NÃO executa comandos de shell** — ele não serve para git. Para git e qualquer coisa que envolva terminal/shell, é sempre Desktop Commander.

| MCP | Para que serve | Não serve para |
|-----|---------------|----------------|
| **Desktop Commander** | Shell no Mac, git, file ops, start/interact com processos, REPL Python/Node | Apps nativos do macOS (Notas, Calendário etc.) |
| **Apple MCP** | Apps nativos do macOS (Notas, Calendário, Mail, Mensagens, Contatos, Lembretes, Maps, WebSearch) | Shell, git, comandos de terminal |

---

## 2.5. Autenticação GitHub

### 2.5.1 — Caminho Primário (v4, Desktop Commander + Keychain nativo)

Quando rodamos git via Desktop Commander (`mcp__desktop-commander__start_process` → `git push`), o comando é executado **diretamente na sessão zsh do Marcelo no Mac**. Isso significa que ele herda a configuração nativa do git do macOS.

**Configuração confirmada (08/04/2026):**

| Item | Valor verificado |
|---|---|
| `credential.helper` | `osxkeychain` (system-level, vem do Xcode CLT em `/Library/Developer/CommandLineTools/usr/share/git-core/gitconfig`) |
| Binário do helper | `/Library/Developer/CommandLineTools/usr/libexec/git-core/git-credential-osxkeychain` (123KB, instalado) |
| Credencial github.com no Keychain | ✅ **Gravada** (`username=mfalcao09`, PAT fine-grained de 93 chars) |
| Teste de autenticação | ✅ `git ls-remote origin main` retornou `b0a38d78...` sem prompt |

**Como foi resolvido:** o arquivo `/Users/marcelosilva/Projects/GitHub/.github-token` contém URL no formato `https://mfalcao09:github_pat_...@github.com` (não o token puro). Extraímos o PAT com `sed -E 's|https://[^:]+:([^@]+)@.*|\1|'` e gravamos no Keychain via `git-credential-osxkeychain store` (veja protocolo de regravação no §2.5.1.1).

**Implicação:** Desktop Commander agora faz `git push/pull/fetch/clone` 100% autônomo, sem prompt, sem workaround.

#### 2.5.1.1 — Protocolo de regravação do Keychain (se PAT rotacionar)

Quando o fine-grained PAT expirar ou for rotacionado, rodar via Desktop Commander:

```bash
HELPER=/Library/Developer/CommandLineTools/usr/libexec/git-core/git-credential-osxkeychain
# 1. Apagar entrada antiga
printf "protocol=https\nhost=github.com\n\n" | "$HELPER" erase
# 2. Extrair PAT puro do .github-token (formato URL)
TOKEN=$(sed -E 's|https://[^:]+:([^@]+)@.*|\1|' /Users/marcelosilva/Projects/GitHub/.github-token | tr -d '\n\r ')
# 3. Gravar no formato correto
printf "protocol=https\nhost=github.com\nusername=mfalcao09\npassword=%s\n\n" "$TOKEN" | "$HELPER" store
# 4. Validar
cd /Users/marcelosilva/Projects/GitHub/ERP-Educacional && git ls-remote --heads origin main
```

**⚠️ Armadilha conhecida:** não usar `cat .github-token` direto como password — o arquivo tem formato URL, não PAT puro. A regex do passo 2 é obrigatória.

### 2.5.2 — Caminho Fallback (v3, Sandbox + bindfs + PAT)

**Estratégia (mantida para quando Desktop Commander não está disponível):** Fine-grained Personal Access Token único, salvo no bind mount `/mnt/GitHub/` (persistente entre sessões Cowork), compartilhado entre TODOS os projetos via `credential.helper` global do git dentro do sandbox.

#### Setup (idem v3)

| Item | Valor |
|------|-------|
| Tipo de token | Fine-grained PAT (não classic) |
| Nome no GitHub | `cowork-claude-automation` |
| Repository access | `mfalcao09/diploma-digital` + `mfalcao09/intentus-plataform` (+ outros `mfalcao09/*` futuros) |
| Permissões | `Contents: RW`, `Metadata: R`, `Pull requests: RW`, `Workflows: RW` (último só se repo tem GH Actions) |
| **Arquivo persistente** | `/Users/marcelosilva/Projects/GitHub/.github-token` (no Mac) = `/sessions/{SANDBOX_ID}/mnt/GitHub/.github-token` (dentro do sandbox) |
| Por que persiste cross-sandbox | `/mnt/GitHub/` é bind mount do Mac → aparece automaticamente em TODO sandbox Cowork novo |
| Helper git global | `store --file=/sessions/{SANDBOX_ID}/mnt/GitHub/.github-token` (precisa ser reapontado em cada sessão nova) |
| Author git global | `mfalcao09 / contato@marcelofalcao.imb.br` |
| Data de configuração v3 | 08/04/2026 |
| Expiração | 90 dias (sobrescrever mesmo arquivo quando vencer) |

#### Como funciona na prática (fallback)

1. O token fica salvo **no disco do Mac** de Marcelo, fora de qualquer repositório git (pasta-pai `/Projects/GitHub/` é só um container).
2. Em toda sessão Cowork nova, a pasta `/mnt/GitHub/` já aparece populada com o arquivo `.github-token`.
3. Claude roda o bootstrap de 4 comandos no início da sessão (ver 2.5.3) para reapontar `credential.helper` global.
4. A partir desse momento, `git push`/`fetch`/`clone`/`ls-remote` em qualquer repo `mfalcao09/*` autenticam sozinhos — mas **só via sandbox Bash**, não é pra Desktop Commander (que usa o git do Mac).
5. Não há token embutido em `.git/config` de nenhum projeto — configs ficam limpos.

### 2.5.3 — Regras inegociáveis de auth (valem em ambos os caminhos)

- **NUNCA** embutir PAT na URL do remote (`https://user:TOKEN@github.com/...`). Sempre usar URL limpa.
- **NUNCA** commitar `.github-token`, `.git-credentials`, ou qualquer arquivo com token.
- **NUNCA** usar PAT classic — sempre fine-grained.
- **NUNCA** dar mais permissões que `Contents:RW + Metadata:R + PullRequests:RW`.
- Se precisar editar GitHub Actions, adicionar `Workflows:RW` temporariamente e remover depois.

### 2.5.4 — Rotação do token (fallback)

1. Quando o token estiver perto de vencer (ou for comprometido):
2. Marcelo gera novo fine-grained PAT em https://github.com/settings/tokens?type=beta com as mesmas permissões.
3. Sobrescrever **o mesmo arquivo** no Mac: `echo 'https://mfalcao09:<NOVO_TOKEN>@github.com' > /Users/marcelosilva/Projects/GitHub/.github-token && chmod 600 /Users/marcelosilva/Projects/GitHub/.github-token`
4. Revogar o token antigo no GitHub.
5. Testar com `git fetch origin` em qualquer projeto — nenhuma outra config precisa mudar.

### 2.5.5 — Bootstrap de sessão Cowork (fallback, só se Desktop Commander não disponível)

```bash
# 1. Descobrir sandbox ID atual
SANDBOX_ID=$(pwd | awk -F/ '{print $3}')
TOKEN_FILE="/sessions/${SANDBOX_ID}/mnt/GitHub/.github-token"

# 2. Validar que o token persistente existe
test -f "$TOKEN_FILE" || { echo "❌ Pedir PAT novo a Marcelo"; exit 1; }

# 3. Apontar git global para ele (dentro do sandbox)
git config --global credential.helper "store --file=$TOKEN_FILE"
git config --global user.name "mfalcao09"
git config --global user.email "contato@marcelofalcao.imb.br"

# 4. Validar auth (deve retornar SHA)
cd "/sessions/${SANDBOX_ID}/mnt/GitHub/ERP-Educacional" && git ls-remote origin HEAD
```

Esse bootstrap está documentado também em `.auto-memory/bootstrap_git_auth_novo_sandbox.md`.

**Observação v4:** com Desktop Commander no ar, esse bootstrap **não é mais a primeira coisa a rodar**. A primeira coisa a rodar agora é verificar se os tools `mcp__desktop-commander__*` estão disponíveis via ToolSearch. Se sim → caminho primário, pular bootstrap. Se não → rodar bootstrap.

---

## 3. Fluxo padrão (8 fases)

> **Nota v4:** os comandos shell abaixo são os mesmos em ambos os caminhos. A diferença é **onde** eles rodam: primário = `mcp__desktop-commander__start_process` no Mac real; fallback = `Bash` no sandbox sobre bindfs.

### A — Pré-edição
1. `Read` nos arquivos-alvo.
2. `Grep` para verificar dependências (quem consome o símbolo a mudar).
3. Confirmar CLAUDE.md do projeto para regras específicas.

### B — Edição
4. `Edit` cirúrgico (ou `Write` para arquivos novos).
5. Releitura pós-edição para confirmar estado.

### C — Validação local
6. Type-check: `npx tsc --noEmit` (primário: via Desktop Commander; fallback: via sandbox Bash)
7. Build completo: `npx next build` (Next.js) ou `npm run build` (Vite).
8. Code review com **Buchecha** (`minimax-ai-assistant:review-minimax`) — obrigatório.

> 💡 **Vantagem do caminho primário:** `next build` rodando no Mac real usa o Node/npm/cache nativo e **não depende do sandbox Cowork ter Node instalado**. Mais rápido e menos frágil.

### D — Diagnóstico git (em paralelo, 3 comandos na mesma mensagem)
9. `git status` + `git diff` + `git log --oneline -10`
10. Confirmar `git config user.email` = `contato@marcelofalcao.imb.br` e `user.name` = `mfalcao09`.

### E — Commit
11. `git add <arquivo>` — nunca `git add -A` / `git add .`
12. `git commit` com HEREDOC + Conventional Commits + Co-Authored-By:
    ```bash
    git commit -m "$(cat <<'EOF'
    feat: descrição concisa do "porquê"

    Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
    EOF
    )"
    ```
13. Se pre-commit hook falhar → corrigir → **NOVO** commit (nunca `--amend`).

### F — Push
14. `git fetch origin <branch>` antes do push.
15. Se houver divergência → **caminho primário:** rebase direto no Mac (sem FUSE, funciona); **fallback:** clone em `/tmp` (§6.4).
16. `git push origin <branch>`.

### G — Verificação pós-push (autônoma) — **GATE DE "DEFINITION OF DONE"**

> 🚨 **REGRA CENTRAL (v4.2):** commit + push **NÃO** é "pronto". A tarefa só está encerrada quando o deploy Vercel chega em **`READY`**. Até lá, a IA fica no ciclo `corrigir → commit → push → monitorar`, autonomamente, sem pedir para Marcelo intervir.

#### G.1 — Encontrar o deploy novo
17. **Vercel CLI** → `vercel list <project> --token "$VERCEL_TOKEN"` → pegar a URL do deploy mais recente.
18. Confirmar que o deploy corresponde ao commit recém-pushado (o `vercel list` mostra cronologia — o topo é o mais recente).

#### G.2 — Loop de monitoramento até `READY`
19. **Vercel CLI** → `vercel inspect <deployment-url> --wait --token "$VERCEL_TOKEN"` (espera finalizar). Se não quiser bloquear, polling manual com `vercel inspect <url> --token "$VERCEL_TOKEN"`. Estados possíveis:
    - `● Building` → aguardar e repetir (intervalo 15-30s)
    - `● Ready` → ✅ **sair do loop, seguir para G.4**
    - `● Error` / `● Canceled` → ❌ **sair do loop, seguir para G.3**
20. Timeout máximo do loop: **10 minutos**. Se estourar, logar o estado atual e alertar Marcelo (não é falha da IA — é sinal de que algo anormal está acontecendo no Vercel).

#### G.3 — Ciclo de correção automática (só se `Error`)
21. **Vercel CLI** → `vercel inspect <url> --token "$VERCEL_TOKEN"` → ler detalhes do build que falhou. Se precisar de logs completos: `vercel logs <url> --token "$VERCEL_TOKEN"`.
22. Identificar a causa:
    - **TypeScript error** → voltar a **B** (`Edit`) → corrigir o arquivo ofensor
    - **Missing dependency** (`Module not found`) → adicionar ao `package.json` → `npm install`
    - **Env var faltando** → avisar Marcelo (IA não tem permissão pra setar secrets)
    - **Build timeout / OOM** → avisar Marcelo (ajuste de infra)
    - **Hook de Supabase / migration bloqueada** → MCP Supabase → `get_advisors` → corrigir
23. Reexecutar **C** (validação local: `tsc` + `build`) — **OBRIGATÓRIO** antes de pushar de novo (evita queimar outro deploy com o mesmo erro).
24. Code review com Buchecha se a correção for não-trivial.
25. Voltar a **E → F → G.1** (novo commit, novo push, novo loop).
26. **Não existe limite rígido de tentativas** — a IA repete o ciclo até `READY`. Só interrompe se:
    - Detectar que está em loop (mesmo erro, mesma causa, 3× seguidas) → escalar para Marcelo
    - Encontrar causa fora do seu alcance (secrets, infra, permissões) → escalar para Marcelo
    - Marcelo interromper explicitamente

#### G.4 — Validação pós-`READY` (só depois de verde)
27. MCP Sentry → `search_issues` com filtro dos últimos 15min → zero regressões novas.
28. Se houve migration → MCP Supabase → `get_advisors` → zero `ERROR`.
29. Se tocou runtime (API routes / edge functions) → **Vercel CLI** → `vercel logs <url> --token "$VERCEL_TOKEN"` → zero 5xx no smoke window.
30. **Só agora** a tarefa é considerada "done".

### H — Persistência de memória (auto-save)
23. Salvar sessão em `memory/sessions/SESSAO-XXX.md`.
24. Atualizar `memory/MEMORY.md` se houve aprendizado novo.
25. Atualizar `CENTRAL-MEMORY.md` se houve decisão cross-project.

---

## 4. Regras inegociáveis

| # | Regra | Motivo |
|---|-------|--------|
| 1 | `git config user.email` = `contato@marcelofalcao.imb.br` | Vercel deploy falha com outro author |
| 2 | `user.name` = `mfalcao09` | Vercel deploy falha com outro author |
| 3 | Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`) | Padronização e rastreabilidade |
| 4 | `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` no rodapé | Rastreabilidade |
| 5 | HEREDOC para mensagens de commit | Preserva formatação |
| 6 | `git add <arquivo>` por nome, nunca `-A`/`.` | Evita secrets e builds |
| 7 | Rodar `build` completo (não só `tsc`) antes de push | `tsc` não pega dependências faltantes do runtime |
| 8 | **NUNCA** `git push --force` em main/master sem confirmação | Risco de perda irreversível |
| 9 | **NUNCA** `--no-verify` ou `--no-gpg-sign` | Bypass de hook esconde bugs |
| 10 | **NUNCA** `--amend` após hook fail | Amend modifica o commit anterior (que pode já estar em outro push) |
| 11 | **NUNCA** commitar import/call de símbolo que só existe no bindfs local | Quebra produção — sempre validar em clone limpo ou no Mac real (caminho primário já elimina isso) |
| 12 | **NUNCA** skip memory auto-save | Perda de aprendizado entre sessões |
| 13 | **NUNCA** embutir PAT em URL de remote (`https://user:TOKEN@github.com/...`) | Token vaza em `.git/config` — usar credential.helper global (§2.5.2) ou git nativo do Mac (§2.5.1) |
| 14 | **NUNCA** usar PAT classic; sempre fine-grained com permissões mínimas | Classic dá escopo total e não expira por padrão |
| 15 | **NOVA v4** — Preferir Desktop Commander sempre que disponível | Mac nativo = sem FUSE, sem bindfs, sem workaround `/tmp` |
| 16 | **NOVA v4** — Nunca usar Apple MCP para tentar rodar shell/git | Apple MCP só controla apps nativos (Notas, Calendário etc.) — não executa shell |
| 17 | **NOVA v4.2** — **Definition of Done = deploy Vercel `READY`** | Commit e push sem validar o build em produção esconde regressões. A tarefa só está encerrada depois do `get_deployment` retornar `READY`. |
| 18 | **NOVA v4.2** — **Ciclo corretivo autônomo** até `READY` | Se build falhar, a IA lê `get_deployment_build_logs`, diagnostica, corrige, commita e pusha de novo. Sem pedir para Marcelo intervir, exceto se loop detectado (3× mesmo erro) ou causa fora do seu alcance (secrets, infra). |

---

## 5. Sessões paralelas (quando aplicável)

Projetos com **duas sessões Claude rodando em paralelo** (ERP frequentemente; Intentus ocasionalmente) exigem protocolo extra:

1. Antes de qualquer push: `git fetch origin <branch>`
2. `git log HEAD..origin/<branch> --oneline` → se houver commits, a outra sessão avançou
3. **Caminho primário (v4):** rebase direto no Mac (`git pull --rebase origin <branch>`) — funciona porque não tem FUSE no caminho
4. **Fallback:** não rebasear no bindfs → clone em `/tmp` (§6.4)
5. Rebase + `tsc` + `build`
6. Push

---

## 6. Troubleshooting

> **Nota v4:** as seções 6.1–6.4 abaixo descrevem problemas do **fallback** (bindfs/FUSE). O caminho primário (Desktop Commander) elimina a maioria deles. Mantidos para referência e para quando o caminho primário não estiver disponível.

### 6.1 — `.git/index.lock` não removível (bindfs delete-deny)

**Sintoma:** `fatal: Unable to create '.git/index.lock': File exists` e `rm -f` também falha.

**Caminho primário:** rodar `rm -f .git/index.lock` via Desktop Commander — **funciona**, não tem bindfs delete-deny no Mac real.

**Caminho fallback (ordem de tentativa):**
1. Checar processos git ativos: `ps aux | grep -i git | grep -v grep` → matar se travado.
2. Tentar rename: `mv .git/index.lock .git/index.lock.bak && rm .git/index.lock.bak`
3. Clone em `/tmp` (§6.4).
4. Se nada funcionar: **avisar Marcelo**. Nunca `rm -rf .git`.

### 6.2 — FUSE bloqueia merge/rebase

**Sintoma:** `git merge`/`git rebase` falha com `unable to rename`, `permission denied`, ou `file exists`.

**Causa:** FUSE (bindfs) não suporta todas as operações atômicas de rename que o git usa internamente em merge/rebase.

**Caminho primário:** **não acontece** — Desktop Commander roda no Mac real, sem FUSE.

**Caminho fallback:** Workaround canônico em `/tmp` (§6.4).

### 6.3 — Divergência com sessão paralela

**Sintoma:** `git push` rejeitado com `non-fast-forward`.

**Caminho primário:** `git pull --rebase origin <branch>` direto no Mac.

**Caminho fallback:** §6.4.

### 6.4 — WORKAROUND CANÔNICO — clone em /tmp (SÓ FALLBACK)

```bash
# 1. Pegar URL remota
cd /Users/marcelosilva/Projects/GitHub/<PROJETO>
REMOTE=$(git remote get-url origin)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 2. Clonar fora do bindfs
rm -rf /tmp/work-clone
git clone --branch "$BRANCH" "$REMOTE" /tmp/work-clone
cd /tmp/work-clone

# 3. Configurar author correto
git config user.email "contato@marcelofalcao.imb.br"
git config user.name "mfalcao09"

# 4. Copiar os arquivos modificados do bindfs
cp /Users/marcelosilva/Projects/GitHub/<PROJETO>/<arquivo1> <arquivo1>
# ...repetir para cada arquivo. NUNCA copiar node_modules, .next, dist, etc.

# 5. Validar no clone limpo
npx tsc --noEmit
npx next build   # ou npm run build

# 6. Commit + push
git add <arquivos>
git commit -m "$(cat <<'EOF'
feat: descrição

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
git push origin "$BRANCH"

# 7. Voltar ao bindfs e sincronizar
cd /Users/marcelosilva/Projects/GitHub/<PROJETO>
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"   # seguro: estado bom está no remoto

# 8. Limpar
rm -rf /tmp/work-clone
```

### 6.5 — Pre-commit hook fail

**NUNCA** `--amend`, **NUNCA** `--no-verify`. Fazer:
1. Ler mensagem do hook
2. Corrigir (lint / format / type / test)
3. `git add` dos arquivos corrigidos
4. **NOVO** commit (o anterior não aconteceu)

### 6.6 — Desktop Commander não responde / tools não carregam (NOVO v4)

**Sintoma:** ToolSearch não retorna tools `mcp__desktop-commander__*` mesmo após restart do Claude Desktop.

**Diagnóstico:**
1. Validar manualmente no Terminal do Marcelo: `npx -y @wonderwhy-er/desktop-commander@latest` deve iniciar sem erro.
2. Conferir `claude_desktop_config.json` em `/Users/marcelosilva/Library/Application Support/Claude/` — deve ter o bloco `desktop-commander` dentro de `mcpServers`.
3. Cmd+Q + reabrir Claude Desktop.
4. Se continuar falhando → cair para caminho fallback (sandbox bindfs + PAT §2.5.2) e continuar trabalhando.

---

## 7. Checklist pós-push autônomo (gate de Definition of Done)

```
[ ] Vercel CLI: `vercel list <project>` → identificar deploy novo (URL no topo)
[ ] Vercel CLI: `vercel inspect <url> --wait` (ou polling manual) até Ready/Error
[ ] Se Error:
      [ ] `vercel inspect <url>` + `vercel logs <url>` → identificar causa
      [ ] Edit → corrigir arquivo ofensor
      [ ] tsc + build local passam
      [ ] (se não-trivial) review com Buchecha
      [ ] git add + commit + push novo
      [ ] Voltar ao topo deste checklist
      [ ] Stop se: 3× mesmo erro OU causa fora do alcance da IA
[ ] Ready alcançado → prosseguir validação pós-verde:
      [ ] Sentry: search_issues (últimos 15min) → zero regressões novas
      [ ] Supabase (se migration): get_advisors → zero warnings críticos
      [ ] Vercel CLI (se runtime): `vercel logs <url>` → zero 5xx
[ ] Só então: responder a Marcelo com status consolidado + link do deploy
```

> **Regra de comunicação:** enquanto o deploy está em `QUEUED` ou `BUILDING`, a IA **não** declara a tarefa concluída. Pode dar um status intermediário ("push feito, deploy em BUILDING, monitorando"), mas a entrega final só acontece após `READY` + validação pós-verde.

---

## 8. O que NÃO é autônomo

- Rotação de secrets (env vars) em Vercel/Supabase/GitHub
- Aprovar merge de PR com branch protection
- Decisões de arquitetura fora do CLAUDE.md do projeto
- `git push --force` em main/master
- `git reset --hard` quando o estado bom **não** está no remoto
- Instalar MCPs novos no Claude Desktop (Marcelo autoriza e cola comandos)
- Aceitar popups macOS de permissão de Automação na primeira execução

---

## 9. Adaptações por projeto

| Projeto | Build command | Diferenças específicas |
|---------|---------------|------------------------|
| **ERP-Educacional** | `npx next build` | Sessões paralelas frequentes → §5 sempre aplicado |
| **Intentus** | `npm run build` (Vite) | Branch protection em `main`; testar com `playwright` |
| **Ecossistema** | (sem build — só docs) | Pula Fase C; pula verificação Vercel |
| **Splendori** | — | Projeto sem repo git ainda |
| **Nexvy** | — | Projeto sem repo git ainda |

Cada projeto pode ter um `memory/workflows/commit-push-autonomo.md` local com ajustes — este documento é a baseline.

---

## 10. Changelog

| Data | Mudança |
|------|---------|
| 08/04/2026 | Criação inicial — consolidação de 5 feedbacks do auto-memory + incidente ERP Sessão 023 (Bug #F / `.git/index.lock`). Versão ERP em `ERP-Educacional/memory/workflows/commit-push-autonomo.md` criada simultaneamente. |
| 08/04/2026 (v2) | Adicionada §2.5 (Autenticação GitHub centralizada via fine-grained PAT + credential.helper global) e regras 13-14. PAT classic antigo revogado. ERP `.git/config` limpo (sem token embutido). Setup validado em ERP-Educacional + intentus-plataform. |
| 08/04/2026 (v3) | §2.5 atualizada para cross-sandbox: token movido de `/sessions/{ID}/.github-token` (isolado por sandbox) para `/Users/marcelosilva/Projects/GitHub/.github-token` = `/mnt/GitHub/.github-token` (bind mount do Mac). Bootstrap de 4 comandos obrigatório no início de toda sessão. |
| 08/04/2026 (v4) | **MUDANÇA DE PARADIGMA.** Instalado **Desktop Commander MCP** (`@wonderwhy-er/desktop-commander` via `npx` no `claude_desktop_config.json`) como **caminho primário** para git e shell. Rodando direto no Mac do Marcelo → **elimina FUSE/bindfs, elimina workaround `/tmp`, usa credenciais nativas do Mac (Keychain)**. Setup v3 (PAT + credential.helper sandbox) vira **fallback** para quando Desktop Commander não estiver disponível. Também instalado **Apple MCP** (`@dhravya/apple-mcp` via `bunx`) para apps nativos do macOS (Notas, Calendário, Mail, Mensagens, Lembretes, Contatos, Maps, WebSearch) — **não serve para shell/git**, serve para automações fora do terminal. Adicionadas §0 (mudança de paradigma), §2.1 (stack dual), §2.2 (Apple MCP vs Desktop Commander), §2.5.1 (auth primária via Keychain Mac), §6.6 (troubleshooting Desktop Commander), regras 15-16. Validado com `git status` + `git log` reais em ERP-Educacional via Desktop Commander — resposta completa com 16 arquivos modificados + 60+ untracked + divergência 1↔19 commits detectada. |
| 08/04/2026 (v4.2) | **DEFINITION OF DONE = DEPLOY VERCEL `READY`.** Reescrita da fase G do §3 com 4 sub-fases (G.1 encontrar deploy, G.2 loop até `READY`, G.3 ciclo corretivo automático em caso de `ERROR`, G.4 validação pós-verde). Adicionadas regras 17-18 (DoD + ciclo corretivo autônomo sem pedir intervenção humana, exceto se 3× mesmo erro OU causa fora do alcance). Checklist §7 reescrito como fluxograma com gate explícito. Regra de comunicação: push feito + deploy `BUILDING` ≠ tarefa concluída. Diretriz ditada por Marcelo em 08/04/2026 após entender que Desktop Commander + Keychain destravam ciclo 100% autônomo. |
| 11/04/2026 (v4.3) | **VERCEL CLI SUBSTITUI MCP VERCEL.** MCP Vercel perdeu conexão em 11/04/2026. Toda a fase G (G.1-G.4), §7 checklist e §2.1 stack atualizados para usar **Vercel CLI** (`vercel list`, `vercel inspect --wait`, `vercel logs`) com `$VERCEL_TOKEN` env var. CLI instalado por sessão no sandbox; bootstrap atualizado em `.auto-memory/bootstrap_git_auth_novo_sandbox.md`. Capacidades equivalentes: monitoramento, logs, inspect, redeploy, rollback. |
| 08/04/2026 (v4.1) | **TECH-DEBT DO §2.5.1 RESOLVIDA.** Verificado que `credential.helper=osxkeychain` vem do gitconfig do Xcode CLT, binário instalado em `/Library/Developer/CommandLineTools/usr/libexec/git-core/`. Keychain estava vazio pra github.com — gravado PAT fine-grained via `git-credential-osxkeychain store` direto. **Armadilha descoberta:** `.github-token` contém URL `https://mfalcao09:PAT@github.com` (não PAT puro), primeiro `store` gravou URL inteira e falhou. Solução: extrair PAT com regex `sed -E 's\|https://[^:]+:([^@]+)@.*\|\\1\|'`. Protocolo completo de regravação documentado em §2.5.1.1. Validado com `git ls-remote origin main` → retornou SHA `b0a38d78...` sem prompt. **Desktop Commander agora faz git push/pull/fetch/clone 100% autônomo.** |
