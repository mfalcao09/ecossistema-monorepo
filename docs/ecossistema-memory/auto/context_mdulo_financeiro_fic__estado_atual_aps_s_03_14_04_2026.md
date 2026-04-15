---
name: Módulo Financeiro FIC — Estado Atual após S-03 (14/04/2026)
description: Módulo Financeiro FIC — Estado Atual após S-03 (14/04/2026)
type: context
project: erp
tags: ["financeiro", "estado-atual", "pendencias", "bloqueadores", "s-04"]
success_score: 0.9
supabase_id: fdf53873-4a4b-41a7-a01e-d0f1790aa840
created_at: 2026-04-14 08:43:40.147328+00
updated_at: 2026-04-14 09:07:14.714582+00
---

Estado do módulo financeiro após sessão 092:
COMPLETO (S-01 a S-03):
- 7 tabelas Supabase: alunos, cobrancas, comunicacoes, comprovantes, inadimplencia_diaria, pix_demanda, restricoes_aluno
- 6 endpoints Vercel Python: emit-boletos, payment-webhook (esqueleto), cron-inadimplencia, gerar-pix-demanda, cron-regua, cron-expirar-pix
- Régua de cobrança: 6 tons e-mail + bloquear portal dia 23
PENDENTE (Fases A-D):
- Fase A: credenciais Inter sandbox (6 env vars), importar alunos 2026/1, desconto_pontualidade por aluno, payment-webhook.py completo
- Fase B: WhatsApp Meta Business API para régua + PIX via resposta WhatsApp
- Fase C: Portal do aluno "Meu Financeiro" + botão Gerar PIX
- Fase D: Dashboard KPIs, relatório inadimplência, integração rematrícula
BLOQUEADOR: credenciais Inter sandbox (INTER_CLIENT_ID, INTER_CLIENT_SECRET, INTER_ACCOUNT_NUMBER, INTER_CERT_BASE64, INTER_KEY_BASE64, INTER_ENVIRONMENT=SANDBOX)
