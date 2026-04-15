---
name: Atendimento S2 COMPLETO — Webhook WABA FIC configurado e verificado
description: Atendimento S2 COMPLETO — Webhook WABA FIC configurado e verificado
type: project
project: erp
tags: ["atendimento", "webhook", "waba", "meta", "sprint-s2", "completo"]
success_score: 0.95
supabase_id: 8de6a470-9ba5-44be-b415-398a2f344195
created_at: 2026-04-13 05:10:02.992026+00
updated_at: 2026-04-13 08:04:32.668563+00
---

Sprint S2 do módulo Atendimento 100% concluída na sessão 089 (13/04/2026).

Entregas:
- Webhook POST /api/atendimento/webhook com HMAC-SHA256 (route.ts)
- Middleware bypass adicionado para /api/atendimento/webhook (sem CSRF/auth)
- Meta Developer Console: substituído webhook Nexvy por ERP URL
- Webhook URL: https://gestao.ficcassilandia.com.br/api/atendimento/webhook
- Verify Token: fic_waba_verify_2026_xK9mPqR3tL7vW
- Campo messages: Assinado v24.0 (já estava)
- App Secret: c23032c1e075d9cf324c9003b656c615 → Vercel env WHATSAPP_APP_SECRET
- Deploy: dpl_Dw9TG7FSpbnQEx4RMYgD148VdwTh READY (~88s)
- Teste GET e2e: curl retornou TEST_CHALLENGE_123 HTTP 200 ✅

Credenciais WABA FIC:
- Phone Number ID: 938274582707248
- WABA ID: 1833772130511929
- App Meta ID: 946507761265751

Próximo: Sprint S3 — Inbox 3 painéis + Filas (UI core)
OU: Teste real (enviar WhatsApp para FIC e verificar Supabase chat_messages)
