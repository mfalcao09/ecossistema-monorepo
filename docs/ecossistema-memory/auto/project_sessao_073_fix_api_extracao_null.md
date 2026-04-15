---
name: Sessão 073 — Fix causa raiz botões auditoria (API extracao:null)
description: Causa raiz real dos botões de auditoria: GET /api/diplomas/[id] retornava extracao:null hardcoded. Fix: query extracao_sessoes via processo_id. Commit 8b10b4a READY.
type: project
---

Fix Bug #4 (causa raiz) da série de botões de auditoria XSD (sessão 073, 11/04/2026).

**Commit:** `8b10b4a` | **Deploy:** `dpl_2vK63Pdado3T6uPjUGqVHtAywuxm` → READY ✅

**Problema:** Sessões 071+072 corrigiram a prop chain e o roteamento dual, mas os botões ainda abriam o formulário legado. Causa raiz: `GET /api/diplomas/[id]` tinha `extracao: null` hardcoded no response com comentário "módulo de extração IA — não implementado nesta fase".

**Fix:** Query real em `extracao_sessoes` usando `processo_id` como FK:
- `extracao_sessoes WHERE processo_id = diploma.processo_id ORDER BY created_at DESC LIMIT 1`
- Retorna objeto com `id` UUID real
- `page.tsx` popula `extracao` state → `sessaoId={extracao?.id}` não-nulo
- `BotaoCorrecao` recebe `sessaoId` truthy → navega para `/diploma/processos/novo/revisao/{sessaoId}`

**Lição:** Verificar sempre a fonte dos dados (rota API), não apenas a cadeia de props, quando botões não navegam para o destino esperado.

**Why:** A API tinha um placeholder hardcoded de fase anterior. A prop chain estava correta mas sem dados não há como chegar ao destino correto.

**How to apply:** Ao debugar navegação de componentes: (1) verificar o componente, (2) verificar a prop chain, (3) verificar a API que alimenta o estado — nessa ordem.
