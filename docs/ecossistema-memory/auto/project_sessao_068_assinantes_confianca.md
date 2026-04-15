---
name: Sessão 068 — Fix assinantes + confiança na revisão pós-extração
description: Assinantes auto-carregados de /api/assinantes no FormularioRevisao; RPC calcula confianca_geral como média por arquivo (antes ficava 0%)
type: project
---

Sessão 068 (11/04/2026): Dois bugs corrigidos na tela de revisão pós-extração.

**Bug 1 — Assinantes "Nenhum assinante configurado":**
- Causa raiz: FormularioRevisao.tsx (reescrito em sessão paralela com 12 seções) inclui seção Assinantes, mas a página de revisão (`/processos/novo/revisao/[sessaoId]/page.tsx`) nunca injetava `dados.assinantes` no DadosRevisao.
- Fix: useEffect na página de revisão busca `/api/assinantes`, filtra ativos, separa eCPFs (por ordem_assinatura) e eCNPJ, e injeta no `setDadosRevisao`. Guard: pula se `dados_confirmados` já tem assinantes salvos.

**Bug 2 — Confiança 0%:**
- Causa raiz: RPC `update_extracao_with_audit` não incluía `confianca_geral` no SET do UPDATE. O campo ficava com default 0.
- Fix: RPC agora calcula `AVG(por_arquivo->>'confianca_geral')` antes do UPDATE e grava no campo.
- Retrofix: UPDATE em todas as sessões existentes que tinham confianca_geral=0 → agora ~97%.

**Commit:** `334dcf2` — deploy Vercel READY 52s.

**Why:** Assinantes são obrigatórios no XML e a confiança guia o operador na revisão.

**How to apply:** Futuras extrações já terão confiança calculada automaticamente. Assinantes são preenchidos 1x no mount se o array está vazio.
