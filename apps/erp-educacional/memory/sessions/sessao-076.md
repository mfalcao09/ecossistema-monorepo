# Sessão 076 — Auto-save Timestamp + Bloqueio Formulário Pós-Publicação

**Data:** 2026-04-12
**Sprint:** 2 (Assinatura + Motor) — polish E2.1
**Epic:** E2.1 polish / UX
**Commit principal:** `563cb88`
**Deploy:** `dpl_FoZ5sxf23KajUMgrGYFxdRPhUxhQ` — READY

---

## O que foi entregue

### Feature 1 — Timestamp de auto-save persistente

**Requisito:** Exibir "Salvo automaticamente, às HH:MM de DD/MM/AA" permanentemente no canto superior direito do header do formulário de revisão, após o primeiro auto-save.

**Implementação:**
- Estado `ultimoSalvamento: Date | null` já existia — passou a ser populado com `new Date()` no momento de sucesso do auto-save
- Removida a lógica que revertia o status para `"idle"` após 2s
- `AutoSaveIndicator` reescrito: formato duas linhas (status + timestamp abaixo)
- Quando `status === "idle"` com timestamp disponível → exibe verde "Salvo automaticamente" + timestamp permanente
- Formatação: `às ${hh}:${mm} de ${dd}/${mo}/${aa}` (hora local)

### Feature 2 — Bloqueio completo do formulário pós-publicação

**Requisito:** Garantir que, após diploma publicado/assinado, o formulário de revisão seja somente leitura.

**Backend (`/api/extracao/sessoes/[id]` — PUT):**
- Query da sessão expandida: `select('id, status, usuario_id, processo_id')`
- Após validar `STATUS_EDITAVEIS`, verifica diplomas vinculados via `processo_id`
- Se qualquer diploma está em `['assinado', 'registrado', 'rvdd_gerado', 'publicado']`, retorna HTTP 403:
  ```json
  { "erro": "DIPLOMA_PUBLICADO", "mensagem": "..." }
  ```

**Frontend (`revisao/[sessaoId]/page.tsx`):**
- `formBloqueado: boolean` state
- **Detecção na carga (useEffect):** fetch `/api/processos/{processo_id}` → `contagem_status` → seta `formBloqueado = true` se qualquer status bloqueado tiver count > 0
- **Detecção reativa (auto-save):** se PUT retorna 403 `DIPLOMA_PUBLICADO` → seta `formBloqueado = true` imediatamente
- **Banner âmbar** exibido quando bloqueado (ícone `Lock` + mensagem)
- **Formulário desabilitado:**
  - `FormularioRevisao.onChange` → `() => {}` quando bloqueado
  - `CardArquivoClassificacao.onChange` → `() => {}` quando bloqueado
  - Botão "Criar processo" → `disabled` quando bloqueado
- Importação de `Lock` de lucide-react adicionada

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/app/(erp)/diploma/processos/novo/revisao/[sessaoId]/page.tsx` | AutoSaveIndicator reescrito, formBloqueado state wired, lock-check useEffect, banner âmbar, controles desabilitados |
| `src/app/api/extracao/sessoes/[id]/route.ts` | PUT handler verifica diploma status via processo_id FK, retorna 403 DIPLOMA_PUBLICADO |

---

## Problemas e soluções

- **`git commit` bloqueado por `.git/index.lock`:** bindfs FUSE impede remoção do lock. Fix canônico: clone em `/tmp/erp-commit` via PAT bind mount, cópia dos arquivos modificados, commit + push de lá. (Ver `feedback_git_fuse_workaround.md`)
- **Nome do repo errado na primeira tentativa:** `ERP-Educacional` → correto é `diploma-digital`. Fix: `git remote -v` antes de clonar.
- **`next build` timeout no sandbox:** ~120-180s. Fix: `npx tsc --noEmit --skipLibCheck` em vez do build completo — saída limpa (apenas erros pré-existentes de vitest, não relacionados ao nosso código).

---

## Backlinks

- Masterplan: `memory/masterplans/diploma-digital-v4.md`
- Sprint 2: `memory/sprints/sprint-2-assinatura.md`
- Epic E2.1 polish — sessões 059-076
- Sessão anterior: `sessao-075.md` (6 bugs pós-s074)

---

## Próxima sessão sugerida

**Sessão 077:** E2.2 BRy OAuth2 (se credenciais disponíveis) OU Sprint 3 RVDD — a definir com Marcelo.
