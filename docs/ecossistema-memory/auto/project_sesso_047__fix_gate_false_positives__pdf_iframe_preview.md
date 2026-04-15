---
name: Sessão 047 — Fix gate false positives + PDF iframe preview
description: Sessão 047 — Fix gate false positives + PDF iframe preview
type: project
project: erp
tags: ["gate", "fix", "rpc", "sessao-047"]
success_score: 0.92
supabase_id: d20b68d7-865d-4c70-ad6e-dd819dbca9f5
created_at: 2026-04-13 09:24:44.925893+00
updated_at: 2026-04-13 18:06:11.716715+00
---

Commits 044bf49 + 5474b5d (10/04/2026). Gate reportava 9 violações falsas. 3 causas: (1) rota lia dados.aluno mas FormularioRevisao salva em dados.diplomado → COALESCE fallback; (2) campo nome vs nome_completo, rg vs rg_numero → mapeados; (3) gate filtrava por destino_xml=true mas default é false → removido filtro (conta todos com tipo_xsd preenchido). PDF preview: object substituído por iframe + blob URL. RPC converter atualizada com COALESCE + split_part naturalidade + rg_numero fallback. Why: sem esse fix, 100% das sessões eram bloqueadas. How to apply: mapeamento FormularioRevisao→backend deve usar fallback chain diplomado→aluno e nome_completo→nome.
