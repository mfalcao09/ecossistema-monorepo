---
name: Sessão 060 — Página dedicada /diploma/assinaturas
description: Página de assinaturas digitais BRy com listagem, expansão por diploma, AssinadorBry embutido e seleção em lote
type: project
---

Sessão 060 (11/04/2026): Página dedicada de assinatura digital BRy.

**Implementado:**
- Nova API `GET /api/diplomas/pendentes-assinatura` — lista diplomas com status xml_gerado/aguardando_assinatura_emissora/em_assinatura/assinado
- Nova página `/diploma/assinaturas` — listagem com checkboxes, expansão por diploma mostra AssinadorBry, seção "assinados recentemente"
- Sidebar: link "Assinaturas" com badge "BRy" entre Processos e Assinantes
- Página diploma `[id]`: botão "Ação 2" redireciona para `/diploma/assinaturas` em vez de chamar POST mock
- Função `enviarParaAssinatura()` removida (não mais usada)
- CSRF token lido do cookie `fic-csrf-token` via JS no cliente

**Commits:** `576d6ec` (página + sidebar) + `6d31370` (lote real) — ambos deploy READY 54s

**Why:** Assinatura com Token USB A3 exige fluxo multi-step (detectar extensão, listar certificados, Initialize→sign→Finalize) — não cabe num simples botão na página do diploma. Página dedicada permite ver todos os pendentes e assinar em lote.

**How to apply:** Lote funcional: seleciona diplomas → clica "Assinar N diplomas" → itera automaticamente (Initialize→sign→Finalize para todos os passos de cada diploma) → mostra resultado. Botão cancelar disponível. Modo individual (expandir e assinar passo a passo) também funciona. AssinadorBry.tsx original preservado como componente standalone mas não mais importado.
