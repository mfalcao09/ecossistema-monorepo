---
name: Diplomado só aparece após registro pela UFMS (status registrado+)
description: Diplomado só aparece após registro pela UFMS (status registrado+)
type: feedback
project: erp
tags: ["diplomados", "ufms", "registradora", "status"]
success_score: 0.9
supabase_id: 9cbcd521-6733-4d82-a269-3c907ce70bac
created_at: 2026-04-13 09:16:28.130214+00
updated_at: 2026-04-13 13:05:13.95879+00
---

A listagem de Diplomados em /diploma/diplomados deve conter EXCLUSIVAMENTE pessoas com pelo menos 1 diploma em status registrado, gerando_rvdd, rvdd_gerado ou publicado (após retorno do XML registrado pela registradora UFMS, código MEC 694). FIC é apenas EMISSORA. Antes do retorno da UFMS, a pessoa é apenas "processo em emissão" — não é diplomada. Query da /api/diplomados GET deve filtrar por diplomas!inner com status IN (registrado,gerando_rvdd,rvdd_gerado,publicado). Cadastro de novo diplomado NÃO deve ser manual — diplomado nasce via processo.
