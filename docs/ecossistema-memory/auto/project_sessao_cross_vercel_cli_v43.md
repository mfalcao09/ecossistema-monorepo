---
name: Sessão cross-project 11/04/2026 — Vercel CLI v4.3
description: Verificação completa git workflow autônomo + migração MCP Vercel → Vercel CLI. GIT-WORKFLOW-AUTONOMO.md atualizado para v4.3. Deploy monitoring agora via CLI.
type: project
---

# Sessão Cross-Project — 11/04/2026

## Contexto
Marcelo pediu verificação da diretriz de git autônomo após perda de conexão com MCP Vercel. Solicitou confirmação de que deploy monitoring continua obrigatório via Vercel CLI.

## O que foi feito

### 1. Git Auth — Desktop Commander (caminho primário)
- **Problema encontrado:** `.git/config` local do ERP tinha `credential.helper` apontando para sandbox antigo (`/sessions/lucid-amazing-meitner/...`), causando `fatal: unable to get credential storage lock`
- **Fix:** `git config --unset credential.helper` + `git config --global credential.helper osxkeychain`
- **Resultado:** ambos os repos (ERP + Intentus) autenticando via Keychain nativo sem prompt
- **Validação:** `git ls-remote origin HEAD` retornou SHA em ambos

### 2. Vercel CLI — Substituto do MCP
- Instalado no sandbox com `npm install -g vercel --prefix`
- Token `$VERCEL_TOKEN` validado como `mrcelooo-6898`
- `vercel list diploma-digital` e `vercel list intentus-plataform` funcionando
- Último deploy ERP: `● Ready`

### 3. Documentação Atualizada
- **GIT-WORKFLOW-AUTONOMO.md → v4.3:** Fase G (G.1-G.4), checklist §7, stack §2.1 reescritos para Vercel CLI
- **feedback_definition_of_done_vercel_ready.md:** ciclo completo reescrito com comandos CLI
- **bootstrap_git_auth_novo_sandbox.md:** armadilha `.git/config` local documentada
- **CENTRAL-MEMORY.md:** header, padrões cross-project e log de decisões atualizados

### 4. Armadilha Descoberta
Quando Desktop Commander é o caminho primário e o git roda no Mac real, qualquer `.git/config` local que aponte para caminhos de sandbox antigos (`/sessions/xxx/...`) causa falha silenciosa de credencial. Fix: limpar com `git config --unset credential.helper` e usar `osxkeychain` global.

## Regra reafirmada
**Definition of Done = deploy Vercel `● Ready`**. Commit + push NÃO é "pronto". Loop autônomo: push → `vercel list` → `vercel inspect --wait` → se Error, corrigir → push → repetir até Ready.
