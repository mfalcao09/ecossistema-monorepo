---
name: Módulos em Paralelo ao Diploma Digital
description: Módulos em Paralelo ao Diploma Digital
type: project
project: erp
tags: ["financeiro", "atendimento", "modulos", "paralelo", "cfo"]
success_score: 0.85
supabase_id: d6e09080-d73d-40fa-ab72-520b3285df81
created_at: 2026-04-13 01:55:12.070453+00
updated_at: 2026-04-13 06:04:08.533565+00
---

Módulo Financeiro (CFO — Multi-Agentes FIC):
- Masterplan: MASTERPLAN-FIC-MULTIAGENTES-v2
- Hierarquia: Marcelo=CEO, Claudinho=VP, C-Suite de IAs. CFO é P1
- S-01 ✅ COMPLETO: 4 tabelas Supabase + Python runtime Vercel + emit-boletos.py + payment-webhook.py
- S-02 ✅ Pré-implementado: OAuth2+mTLS Inter API, Bolepix emission, PDF download, Resend email
- BLOQUEADOR: Credenciais Inter sandbox (para S-02 real)
- Gateway: Banco Inter (Bolepix) — substitui Asaas
- 29 sessões planejadas para Departamento Financeiro completo

Módulo Atendimento (Multi-Agentes FIC):
- S1 ✅ COMPLETO: 9 tabelas Supabase + 8 arquivos frontend + TopBar Atendimento
- S2 PRÓXIMO: Webhook WhatsApp + Bull Queue Railway
- Canal WhatsApp: DECISÃO PENDENTE (Z-API, Evolution, Twilio, 360Dialog ou Nexvy)

Módulo de Assinatura Eletrônica (docs administrativos):
- BRy api-assinatura-digital (distinto de api-diploma-digital)
- Pendência: definição se usa assinatura eletrônica ou digital ICP-Brasil para histórico/expedição
