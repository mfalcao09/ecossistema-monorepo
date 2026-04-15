---
name: Sessão 069 — Fix banner recovery persiste após descartar
description: Bug: após descartar extração, banner "em andamento" reaparecia em /diploma/processos/novo por causa do localStorage não limpo
type: project
---

Sessão 069 (11/04/2026): bug banner de recovery persiste após descartar.

**Why:** O servidor retornava `sessao: null` (sessão descartada) mas o código
caía no fallback do localStorage — que ainda tinha o sessaoId dentro do TTL
de 6h — exibindo o banner com sessão já descartada.

**How to apply:**
- `novo/page.tsx`: quando servidor retorna null → `localStorage.removeItem(STORAGE_KEY_ULTIMA_SESSAO)`; fallback só quando fetch falha completamente
- `revisao/[sessaoId]/page.tsx`: `descartarExtracao()` → limpa `diploma:ultima-sessao` antes de `router.push("/diploma/processos")`

**Auditoria banco:** 22 sessões, todas `status=descartado` com `finalizado_em` — nenhuma órfã.

**Commit:** `6d07657` — deploy READY 53s

**Pendências:**
- Formulário antigo (`/diploma/processos/[id]/page.tsx`) ainda não removido
- 61 disciplinas com `docente_nome = NULL`
- Auto-preenchimento Curso/Emissora/IES
