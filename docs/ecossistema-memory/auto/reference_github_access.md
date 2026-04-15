---
name: GitHub Access Centralizado (PAT persistente no mount /mnt/GitHub)
description: Auth GitHub cross-sandbox via fine-grained PAT salvo em /mnt/GitHub/.github-token (persiste entre sessões Cowork) + credential.helper global — cobre TODOS os repos mfalcao09/*
type: reference
---

Desde **08/04/2026 (v3)**, a autenticação GitHub é **persistente entre sessões Cowork** e **compartilhada entre todos os projetos** do Marcelo (`mfalcao09/*`). Resolve definitivamente o gap documentado anteriormente em `feedback_github_pat_sandbox_scope.md`.

## Setup canônico (v3 — persistente cross-sandbox)

- **Tipo de token:** Fine-grained PAT (NÃO classic)
- **Nome no GitHub:** `cowork-claude-automation` (ou equivalente fornecido por Marcelo)
- **Repository access:** `mfalcao09/diploma-digital` + `mfalcao09/intentus-plataform` (e qualquer outro `mfalcao09/*` futuro)
- **Permissões mínimas:** `Contents: RW`, `Metadata: R`, `Pull requests: RW`, `Workflows: RW` (último só se tiver GitHub Actions)
- **Arquivo persistente (NOVO):** `/sessions/{SANDBOX_ID_ATUAL}/mnt/GitHub/.github-token`
  - No Mac do Marcelo corresponde a: `/Users/marcelosilva/Projects/GitHub/.github-token`
  - **Por que funciona cross-sandbox:** a pasta `/mnt/GitHub/` é um bind mount do Mac → existe em TODO sandbox Cowork novo automaticamente, com o arquivo já lá dentro.
  - `chmod 600` (só o dono lê)
  - Fica FORA de qualquer repositório git (a pasta-pai `GitHub/` não é repo), impossível commitar por acidente.
- **Helper git global:** `store --file=/sessions/{SANDBOX_ID_ATUAL}/mnt/GitHub/.github-token`
- **Author git global:** `mfalcao09 / contato@marcelofalcao.imb.br`
- **Data de configuração:** 08/04/2026 (v3)
- **Histórico:**
  - v1 (2026-03-26): PAT classic embutido em `.git/config` — REVOGADO
  - v2 (2026-04-08): Fine-grained PAT em `/sessions/{ID}/.github-token` — funcionava só dentro de 1 sandbox
  - v3 (2026-04-08): Fine-grained PAT em `/mnt/GitHub/.github-token` — **cross-sandbox permanente** ✅

## Como funciona

1. Em qualquer projeto `mfalcao09/*`, `git push`/`fetch`/`clone`/`ls-remote` autenticam SOZINHOS — sem token embutido em `.git/config`.
2. O arquivo `.github-token` persiste no Mac do Marcelo; cada sandbox Cowork novo monta a mesma pasta e já enxerga o token.
3. **A única coisa que reseta entre sandboxes é o `git config --global credential.helper`** — por isso Claude deve rodar o bootstrap descrito em `bootstrap_git_auth_novo_sandbox.md` logo no início de toda sessão nova.

## Bootstrap (rodar no início de TODA sessão Cowork nova)

```bash
# Descobrir sandbox atual (substitui a parte variável do caminho)
SANDBOX_ID=$(pwd | cut -d/ -f3)  # ou: basename do $HOME
TOKEN_FILE="/sessions/${SANDBOX_ID}/mnt/GitHub/.github-token"

# Verificar que o token persistente existe
test -f "$TOKEN_FILE" && echo "OK" || echo "ERRO: pedir PAT novo ao Marcelo"

# Configurar git global para apontar para ele
git config --global credential.helper "store --file=$TOKEN_FILE"
git config --global user.name "mfalcao09"
git config --global user.email "contato@marcelofalcao.imb.br"

# Validar (retorna SHA = OK; 'fatal: could not read Username' = token expirado/inválido)
cd /sessions/${SANDBOX_ID}/mnt/ERP-Educacional && git ls-remote origin HEAD
```

## How to apply

- **NUNCA** embutir PAT na URL do remote (`https://user:TOKEN@github.com/...`). Sempre URL limpa.
- **NUNCA** usar PAT classic — sempre fine-grained com permissões mínimas.
- **NUNCA** commitar `.github-token` — ele vive em `/mnt/GitHub/` que não é repo git, mas se alguém criar um repo lá, adicionar ao `.gitignore` imediatamente.
- Se `git ls-remote` falhar com `could not read Username`:
  1. Verificar que `/sessions/{ID}/mnt/GitHub/.github-token` existe
  2. Verificar que `git config --global credential.helper` aponta para o caminho certo
  3. Se ambos OK e ainda falha → token expirou → pedir PAT novo ao Marcelo
- Quando o token vencer, Marcelo gera novo no GitHub, sobrescreve o mesmo arquivo, e tudo continua funcionando sem mudar config.

## Documentação canônica

- `GitHub/GIT-WORKFLOW-AUTONOMO.md §2.5` — runbook completo (atualizado v3 em 08/04/2026)
- `GitHub/CENTRAL-MEMORY.md` — entrada na tabela de decisões
- `bootstrap_git_auth_novo_sandbox.md` (auto-memory) — checklist de bootstrap cross-sandbox
- `feedback_github_pat_sandbox_scope.md` — histórico do problema que esta solução resolve
