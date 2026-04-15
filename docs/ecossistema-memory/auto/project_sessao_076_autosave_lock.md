---
name: Sessão 076 — Auto-save timestamp + bloqueio formulário pós-publicação
description: Commit 563cb88 READY — timestamp persistente no header de revisão + 403 DIPLOMA_PUBLICADO backend + banner âmbar + form disabled no frontend
type: project
---

Sessão 076 (12/04/2026) — dois recursos de UX/segurança no formulário de revisão:

1. **Auto-save timestamp persistente:** `AutoSaveIndicator` reescrito em 2 linhas — status (saving/saved/error) + "às HH:MM de DD/MM/AA" abaixo. Timestamp permanece após o 1º save (não reverte para idle após 2s). Estado `ultimoSalvamento: Date | null` captura `new Date()` no sucesso do PUT.

2. **Bloqueio pós-publicação (full-stack):**
   - Backend: PUT `/api/extracao/sessoes/[id]` traversa `processo_id → diplomas`, retorna HTTP 403 `{ erro: 'DIPLOMA_PUBLICADO' }` se qualquer diploma está em `['assinado', 'registrado', 'rvdd_gerado', 'publicado']`
   - Frontend: `formBloqueado` state — detectado (a) na carga via `contagem_status` de `/api/processos/{id}`, (b) reativamente na resposta 403 do auto-save
   - Banner âmbar com ícone `Lock`, formulário desabilitado (onChange silenciado, botão "Criar processo" disabled)

**Why:** Impedir edição de dados após diploma publicado/assinado é requisito jurídico (imutabilidade).
**How to apply:** `STATUS_DIPLOMA_BLOQUEADO` = `['assinado', 'registrado', 'rvdd_gerado', 'publicado']` é a lista canônica de verificação pós-publicação no ERP.
