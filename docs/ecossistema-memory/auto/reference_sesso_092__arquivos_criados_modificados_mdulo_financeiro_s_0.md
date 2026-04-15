---
name: Sessão 092 — arquivos criados/modificados (Módulo Financeiro S-03)
description: Sessão 092 — arquivos criados/modificados (Módulo Financeiro S-03)
type: reference
project: erp
tags: ["financeiro", "referencia", "arquivos", "sessao-092", "proxima-sessao"]
success_score: 0.9
supabase_id: 3ad19297-e007-46cf-83fb-4580cb6da885
created_at: 2026-04-14 08:43:40.147328+00
updated_at: 2026-04-14 09:07:17.566559+00
---

Arquivos entregues na sessão 092:
- api/financeiro/emit-boletos.py (MODIFICADO): NAOTEMMULTA+desconto+numDiasAgenda=0+fixes
- api/financeiro/cron-inadimplencia.py (NOVO): detecção inadimplência + encargos + e-mail dia 1
- api/financeiro/gerar-pix-demanda.py (NOVO): PIX sob demanda, 1/dia, idempotente
- api/financeiro/cron-regua.py (NOVO): escalada 6 tons, restrição portal dia 23
- api/financeiro/cron-expirar-pix.py (NOVO): 00:01 diário, expira PIX anteriores
- supabase/migrations/20260413_financeiro_regua_cobranca.sql (NOVO + APLICADO)
- vercel.json (MODIFICADO): 3 novos crons registrados
Commit: 1f27208. Projeto Supabase ERP: ifdnjieklngcfodmtied (diploma-digital, sa-east-1).
Próxima sessão (093): MÓDULO FINANCEIRO — importar alunos 2026/1, configurar desconto_pontualidade, testar crons manualmente, implementar payment-webhook.py.
