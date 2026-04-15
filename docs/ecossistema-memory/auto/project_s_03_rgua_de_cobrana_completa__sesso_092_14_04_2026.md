---
name: S-03 Régua de Cobrança Completa — Sessão 092 (14/04/2026)
description: S-03 Régua de Cobrança Completa — Sessão 092 (14/04/2026)
type: project
project: erp
tags: ["financeiro", "cobranca", "regua", "pix", "inter-api", "cron", "s-03", "sessao-092"]
success_score: 0.95
supabase_id: 08279a95-84dc-476b-8c1e-f302ff4ba9bb
created_at: 2026-04-14 08:43:40.147328+00
updated_at: 2026-04-14 09:07:16.535931+00
---

Implementação completa do módulo financeiro S-03 FIC. 6 componentes entregues:
1. Migration 20260413_financeiro_regua_cobranca.sql aplicada no Supabase ifdnjieklngcfodmtied: 3 novas tabelas (inadimplencia_diaria, pix_demanda, restricoes_aluno), ALTER em alunos (desconto_pontualidade) e cobrancas (tipo, desconto_aplicado, cobranca_pai_id, status expandido 8 valores).
2. emit-boletos.py ajustado: NAOTEMMULTA+ISENTO (encargos só no PIX sob demanda), desconto pontualidade Inter quantidadeDias=0, numDiasAgenda=0.
3. cron-inadimplencia.py (NOVO): roda 08:00, detecta vencidos, multa 10%+juros 2%/mês, upsert inadimplencia_diaria, e-mail dia 1.
4. gerar-pix-demanda.py (NOVO): POST endpoint, 1 PIX/dia/cobrança (UNIQUE), valor calculado dia exato, Inter numDiasAgenda=0, idempotente.
5. cron-regua.py (NOVO): escalada e-mail dias 1/3/7/12/17/22, 6 tons, bloquear portal dia 23.
6. cron-expirar-pix.py (NOVO): 00:01 diário, expira PIX status=ativo com data_validade < hoje.
Commit: 1f27208. Todos endpoints HTTP 401 (deploy READY).
