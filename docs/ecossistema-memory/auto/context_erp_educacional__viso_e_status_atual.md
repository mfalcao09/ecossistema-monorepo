---
name: ERP Educacional — Visão e Status Atual
description: ERP Educacional — Visão e Status Atual
type: context
project: erp
tags: ["erp", "fic", "status", "visao", "diploma"]
success_score: 0.9
supabase_id: 0f726010-81f3-49f0-bfea-6951feb7ca73
created_at: 2026-04-13 01:55:12.070453+00
updated_at: 2026-04-14 09:16:25.652222+00
---

Estado atualizado em 14/04/2026 (sessão 092).

## Sprint Ativo
- **Diploma:** Sprint 2 (Assinatura + Motor) — E2.1 ✅ 100%, E2.2 ~80%, E2.3-2.4 pendentes
- **Financeiro:** S-01 ✅ S-02 ✅ S-03 ✅ COMPLETO → S-04 próxima (importar alunos + descontos 2026/1)
- **Atendimento:** S3 ✅ Tela de Conversas em produção → S4 próxima (WhatsApp real + atribuição agentes)

## Progresso Global
| Sprint | Nome | Progresso | Status |
|--------|------|-----------|--------|
| Pré-Masterplan | Fundação | ✅ | Base ERP construída |
| Sprint 1 | Segurança Zero-Trust | 4/4 (100%) | ✅ COMPLETO |
| Sprint 2 | Assinatura + Motor | ~2/4 (50%) | 🔄 E2.1 ✅, E2.2 ~80% |
| Sprint 3 | RVDD + Portal | 0/3 (0%) | 🔲 Não iniciado |
| Sprint 4 | Compliance MEC | 0/3 (0%) | 🔲 Não iniciado |
| Sprint 5 | Backup + Expedição | 0/3 (0%) | 🔲 Não iniciado |
| Sprint 6 | Observabilidade | 0/3 (0%) | 🔲 Não iniciado |

**Progresso Diploma:** ~20% | **Progresso Financeiro:** ~25% (S-01/02/03 ✅) | **Sessões totais:** 92

## Últimas Sessões
- s092 (14/04): S-03 Régua de Cobrança Completa — migration + crons + PIX sob demanda. Commit `1f27208` READY
- s091 (13/04): Hotfixes Usuários — CSRF, Zod roles, senha, título site
- s090 (13/04): Sprint S3 Tela de Conversas — 3 painéis + Realtime + Meta Cloud API. Commit `552be02` READY
- s089b (13/04): Webhook WABA VALIDADO E2E — 3 rows gravados
- s088 (13/04): Nexvy batches 3-10 documentados + ATENDIMENTO-PLANO-v2

## Bloqueadores
- BRy credenciais homologação (bloqueia Sprint 2 E2.2)
- Inter sandbox credentials (bloqueia S-04 financeiro)
- Prazo MEC 01/07/2025 vencido (urgente)
