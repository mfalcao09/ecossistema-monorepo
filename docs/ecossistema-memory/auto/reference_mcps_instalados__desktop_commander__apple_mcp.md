---
name: MCPs instalados — Desktop Commander + Apple MCP
description: MCPs instalados — Desktop Commander + Apple MCP
type: reference
project: ecosystem
tags: ["mcp", "desktop-commander", "apple-mcp", "mac", "ferramentas"]
success_score: 0.88
supabase_id: 9bcbce05-dd57-4a29-9ae2-625ac42a65ce
created_at: 2026-04-14 09:15:31.294656+00
updated_at: 2026-04-14 11:07:34.894337+00
---

Config file: `/Users/marcelosilva/Library/Application Support/Claude/claude_desktop_config.json`

## 1. Desktop Commander (`@wonderwhy-er/desktop-commander`)
- **O que faz:** executa shell commands, git, lê/escreve arquivos, lista diretórios — **no Mac real do Marcelo**, não no sandbox.
- **Tools principais:** `start_process`, `read_process_output`, `interact_with_process`, `read_file`, `write_file`, `edit_block`, `list_directory` (26 tools no total).
- **Por que importa:** elimina limitações do sandbox (FUSE, bindfs, `.git/index.lock`). Git push autônomo direto do Mac.
- **Auth git:** 100% autônoma via Keychain nativo macOS. `credential.helper=osxkeychain` gravado via `git-credential-osxkeychain store`.
- **Command:** `npx -y @wonderwhy-er/desktop-commander@latest`

## 2. Apple MCP (`@dhravya/apple-mcp`)
- Controla apps nativos do macOS via AppleScript.
- Apps: Notes, Calendar, Mail, Contacts, Messages, Reminders, Maps, WebSearch
- **NÃO executa terminal** — só apps GUI.
