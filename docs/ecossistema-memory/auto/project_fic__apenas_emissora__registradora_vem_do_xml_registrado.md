---
name: FIC é apenas emissora — registradora vem do XML registrado
description: FIC é apenas emissora — registradora vem do XML registrado
type: project
project: erp
tags: ["fic", "registradora", "ufms", "emissora"]
success_score: 0.9
supabase_id: f7a2090c-f336-4130-ae41-0a8430fda449
created_at: 2026-04-13 09:17:12.70224+00
updated_at: 2026-04-13 14:05:25.096252+00
---

FIC (código MEC 1606) atua APENAS como IES Emissora. A IES Registradora historicamente é a UFMS (código MEC 694), mas pode ser alterada — nunca deve ser presumida. A identidade da registradora não deve ser hardcoded. Dados devem vir sempre do XML/fonte autoritativa. O pipeline do ERP da FIC para na Fase 3 (Trânsito) — a Fase 4+ é responsabilidade da Registradora.
