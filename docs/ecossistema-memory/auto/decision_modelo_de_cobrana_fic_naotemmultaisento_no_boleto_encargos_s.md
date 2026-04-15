---
name: Modelo de Cobrança FIC: NAOTEMMULTA+ISENTO no boleto, encargos só no PIX sob demanda
description: Modelo de Cobrança FIC: NAOTEMMULTA+ISENTO no boleto, encargos só no PIX sob demanda
type: decision
project: erp
tags: ["financeiro", "decisao-arquitetural", "inter-api", "pix", "boleto", "juridico"]
success_score: 0.95
supabase_id: 7f82f522-a144-4827-ae34-c669231d6d28
created_at: 2026-04-14 08:43:40.147328+00
updated_at: 2026-04-14 09:07:15.623065+00
---

Decisão de design do módulo financeiro FIC (sessão 092):
- Boleto (Bolepix): NAOTEMMULTA + ISENTO. Sem encargos no boleto. Desconto pontualidade via Inter quantidadeDias=0 (válido até vencimento inclusive). numDiasAgenda=0 (boleto expira no dia do vencimento).
- PIX sob demanda: encargos calculados internamente (multa 10% fixo dia 1 + juros 2%/mês acumulado). 1 PIX por cobrança por dia (UNIQUE constraint). Expira 23:59 do dia solicitado.
- Régua de escalada: dias de atraso 1/3/7/12/17/22 → e-mail com tons distintos (amigavel/lembrete/atencao/urgencia/institucional/pre_restricao). Dia 23: bloquear portal do aluno automaticamente.
- Restrições legais: NÃO pode bloquear matrícula já realizada (jurisprudência pacificada). PODE bloquear portal. PODE impedir rematrícula semestre seguinte.
Why: Inter exige numDiasAgenda>=0; usar 0 resolve problema de limitDate. Encargos no boleto seriam duplicados com encargos automáticos do Inter.
