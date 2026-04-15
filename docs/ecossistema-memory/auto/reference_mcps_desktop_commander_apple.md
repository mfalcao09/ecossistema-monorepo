---
name: MCPs instalados — Desktop Commander + Apple MCP
description: Dois MCPs locais configurados no Claude Desktop do Marcelo. Desktop Commander executa shell/git no Mac real (elimina limitações FUSE do sandbox). Apple MCP controla apps nativos (Notes, Calendar, Mail, Contacts, Messages, Reminders, Maps, WebSearch) — NÃO executa terminal.
type: reference
---

# MCPs locais instalados (08/04/2026)

Config file: `/Users/marcelosilva/Library/Application Support/Claude/claude_desktop_config.json`

## 1. Desktop Commander (`@wonderwhy-er/desktop-commander`)
- **O que faz:** executa shell commands, git, lê/escreve arquivos, lista diretórios — **no Mac real do Marcelo**, não no sandbox.
- **Tools principais:** `start_process`, `read_process_output`, `interact_with_process`, `read_file`, `write_file`, `edit_block`, `list_directory`, `list_processes`, `kill_process` (26 no total).
- **Por que importa:** elimina todas as limitações do sandbox (FUSE, bindfs, `.git/index.lock` delete-deny, merge/rebase quebrados). Git push autônomo direto do Mac, sem workaround /tmp clone.
- **Auth git:** ✅ **100% autônoma via Keychain nativo macOS** (validada 08/04/2026). `credential.helper=osxkeychain` vem do Xcode CLT (system-level), PAT fine-grained gravado no Keychain via `git-credential-osxkeychain store`. Push/pull/fetch/clone funcionam sem prompt. **Não precisa do PAT v3 do sandbox.**
- **Command no config:** `npx -y @wonderwhy-er/desktop-commander@latest`
- **Validado:** `git status` real no ERP-Educacional executou OK (branch main, 16 modificados, 60+ untracked).

## 2. Apple MCP (`@dhravya/apple-mcp`)
- **O que faz:** controla apps nativos do macOS via AppleScript.
- **8 módulos:** Contacts, Notes, Messages, Mail, Reminders, WebSearch, Calendar, Maps.
- **O que NÃO faz:** ❌ NÃO executa comandos no Terminal, ❌ NÃO roda git, ❌ NÃO acessa shell. Isso é responsabilidade do Desktop Commander.
- **Command no config:** `/Users/marcelosilva/.bun/bin/bunx @dhravya/apple-mcp@latest` (path absoluto obrigatório — `bunx` simples não funciona)

## Hierarquia de escolha (para mim, Claude)
1. **Operações git / shell / filesystem no Mac real** → **Desktop Commander** (primário)
2. **Criar lembrete, evento, nota, email, iMessage** → **Apple MCP**
3. **Sandbox (rápido, não persiste no Mac)** → ferramentas do ambiente Cowork (Bash, Read, Write)
4. **Fallback git quando Desktop Commander indisponível** → PAT v3 via bind mount `/mnt/GitHub/.github-token` (ver `bootstrap_git_auth_novo_sandbox.md`)

## Workflow autônomo canônico
Documento vivo em `/sessions/sharp-friendly-maxwell/mnt/GitHub/GIT-WORKFLOW-AUTONOMO.md` (v4) — arquitetura dual-path com Desktop Commander como caminho primário.

## Tech-debt — RESOLVIDA (08/04/2026)
✅ Keychain nativo macOS validado e carregado com PAT fine-grained. Desktop Commander faz git autônomo. **Armadilha descoberta:** `.github-token` contém URL (`https://mfalcao09:PAT@github.com`), não PAT puro — para regravar, extrair com `sed -E 's|https://[^:]+:([^@]+)@.*|\1|'` antes de passar pro helper. Protocolo completo em `GIT-WORKFLOW-AUTONOMO.md` §2.5.1.1.
