---
name: Git Workflow Autônomo — doc canônico consolidado (v4)
description: GIT-WORKFLOW-AUTONOMO.md v4 (08/04/2026) — Desktop Commander MCP é o caminho PRIMÁRIO (Mac nativo, Keychain, sem FUSE). Sandbox bindfs+PAT é fallback. Sempre consultar antes de qualquer git.
type: feedback
---

**ATUALIZAÇÃO v4 (08/04/2026):** Desktop Commander MCP virou o **caminho primário** para git/shell em todos os projetos. Roda direto no Mac do Marcelo, usa `osxkeychain` nativo, elimina FUSE/bindfs e o workaround `/tmp`. Como saber se estou no caminho primário: se ToolSearch retorna `mcp__desktop-commander__*`, sim. O bootstrap de PAT do sandbox (v3) só roda como fallback se DC não estiver disponível. Apple MCP **NÃO** serve para git/shell — só apps nativos.

A partir de 08/04/2026, existe um documento canônico consolidado sobre commit & push autônomo que eu devo SEMPRE consultar antes de executar git em qualquer projeto do Marcelo:

- **Versão cross-project (baseline):** `/Users/marcelosilva/Projects/GitHub/GIT-WORKFLOW-AUTONOMO.md`
- **Versão ERP (adaptação local):** `/Users/marcelosilva/Projects/GitHub/ERP-Educacional/memory/workflows/commit-push-autonomo.md`
- **Referenciado em:** CENTRAL-MEMORY.md (Padrões Cross-Project → Código), ONBOARDING-KIT.md (seção Git Workflow + checklist item 3, 4, 5, 6)

Esse doc consolida 5 feedbacks que antes estavam fragmentados no auto-memory:
- feedback_git_author (user.email = contato@marcelofalcao.imb.br)
- feedback_git_fuse_workaround (clone em /tmp §6.4)
- feedback_verificar_build_antes_push (next build completo, não só tsc)
- feedback_consumidor_sem_produtor (nunca import de símbolo só-local)
- project_bug_f_tela_react_pronta (incidente origem do .git/index.lock bindfs delete-deny)

Também define o fluxo autônomo completo: edição → validação local → code review Buchecha → git diagnóstico paralelo → commit HEREDOC → push → MCP Vercel (deploy status) → MCP Sentry (regressões) → MCP Supabase (advisors se migration) → auto-save de memória.

**Why:** Marcelo pediu explicitamente que o processo fosse consolidado e sincronizado com a memória central para servir de referência em todos os projetos. Antes, o conhecimento estava espalhado em feedbacks individuais e a tendência era reinventar o fluxo a cada sessão.

**How to apply:** Em QUALQUER projeto (ERP, Intentus, Ecossistema, novos), antes de fazer commit/push, consultar o GIT-WORKFLOW-AUTONOMO.md (baseline) e o `memory/workflows/commit-push-autonomo.md` local (se existir) para seguir o padrão. Quando criar projeto novo via ONBOARDING-KIT, criar a pasta `memory/workflows/` e o arquivo local adaptado. Feedbacks individuais antigos continuam válidos, mas o doc canônico é a fonte consolidada.
