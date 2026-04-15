# MCPs Locais Instalados (08/04/2026)

Config: `/Users/marcelosilva/Library/Application Support/Claude/claude_desktop_config.json`

## Desktop Commander (`@wonderwhy-er/desktop-commander`)
- **Função:** executa shell / git / filesystem **no Mac real** do Marcelo (não no sandbox).
- **Impacto no Intentus:** elimina limitações FUSE/bindfs do sandbox — git push autônomo direto do Mac, sem workaround `/tmp clone` + PAT, usando credential helper nativo (Keychain).
- **Tools principais:** `start_process`, `read_process_output`, `interact_with_process`, `read_file`, `write_file`, `edit_block`, `list_directory`, `list_processes` (26 no total).
- **Validado:** 08/04/2026 com `git status` real em outro projeto.

## Apple MCP (`@dhravya/apple-mcp`)
- **Função:** controla apps nativos macOS — Contacts, Notes, Messages, Mail, Reminders, WebSearch, Calendar, Maps (8 módulos).
- **NÃO faz:** shell, git, terminal. Para isso usar Desktop Commander.
- **Uso no Intentus:** criar lembretes de deploys, eventos no Calendar para releases, notas de decisões técnicas, emails via Mail.

## Ordem de preferência para git no Intentus
1. **Desktop Commander** (primário — Mac real, credential helper nativo)
2. **Sandbox + PAT v3** (`/mnt/GitHub/.github-token`) apenas se Desktop Commander indisponível

## Referência canônica cross-project
`/Users/marcelosilva/Projects/GitHub/GIT-WORKFLOW-AUTONOMO.md` **v4.2** — arquitetura dual-path + Definition of Done = deploy Vercel READY.

## 🚨 Definition of Done (v4.2 — 08/04/2026)
**Commit + push NÃO é "pronto". Só está encerrado quando o deploy Vercel chega em `READY`.**

Ciclo autônomo no Intentus:
1. Desktop Commander → `git commit` + `git push`
2. MCP Vercel → `list_deployments` (projeto `intentus-plataform`, team `mrcelooo-6898s-projects`) → achar deploy pelo SHA
3. MCP Vercel → `get_deployment` em loop: `QUEUED` → `BUILDING` → `READY` ✅ ou `ERROR` ❌
4. Se `ERROR`: `get_deployment_build_logs` → corrigir → `tsc` + `npm run build` (Vite) local → commit + push → **voltar ao passo 2**
5. Só após `READY`: `search_issues` Sentry (15min, org `mfalcao-organization`), validação de Edge Functions via `get_logs` Supabase se relevante
6. **Só então** a tarefa é considerada concluída

**Stop conditions (escalar pra Marcelo):**
- 3× mesmo erro (loop detectado)
- Env var / secret faltando, infra travada
- Marcelo interromper explicitamente

**Comunicação durante o loop:** status intermediário permitido ("push feito, BUILDING"), entrega final só após `READY`.

Ver `GIT-WORKFLOW-AUTONOMO.md` §3 (fase G), §7 (checklist), regras 17-18.
