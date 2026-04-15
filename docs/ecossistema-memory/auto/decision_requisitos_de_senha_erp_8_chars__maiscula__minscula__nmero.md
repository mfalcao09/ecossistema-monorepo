---
name: Requisitos de senha ERP: 8 chars + maiúscula + minúscula + número + símbolo
description: Requisitos de senha ERP: 8 chars + maiúscula + minúscula + número + símbolo
type: decision
project: erp
tags: ["senha", "segurança", "política", "zod", "ux"]
success_score: 0.9
supabase_id: 3843a6bf-4c98-4c82-819e-a4ce1fdd58f1
created_at: 2026-04-13 23:22:29.771969+00
updated_at: 2026-04-14 00:06:44.665069+00
---

Decisão sessão 091: política de senha do ERP FIC definida como 8 caracteres mínimos, pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 símbolo. Implementada em: (a) zod-schemas.ts criarUsuarioSchema com 5 .regex() validations; (b) frontend com indicador visual em tempo real; (c) campo confirmação com feedback borda verde/vermelha. Cliente e servidor 100% alinhados.
