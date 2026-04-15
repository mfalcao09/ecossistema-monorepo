# PENDÊNCIAS — Plano vs Execução
> Gerado automaticamente pela automação `plan-audit`
> Masterplan: parcelamento-solo
> Última auditoria: 2026-04-15 09:30

## Backlog (planejado, sem progresso ou parcial)

| Bloco | US | Item | Planejado desde | Sessões | Bloqueador |
|-------|-----|------|-----------------|---------|------------|
| G | — | Execute actions (ações diretas do copilot) | ~10/04/2026 | 0 | — |
| G | — | Análise preditiva | ~10/04/2026 | 0 | — |
| G | — | Comparador de empreendimentos | ~10/04/2026 | 0 | — |
| H | US125 | Zoneamento Municipal (frontend pendente) | 11/04/2026 | 1 (backend s145) | Backend ✅, frontend pendente |
| H | US127 | Autônoma 1 (próxima sessão) | 11/04/2026 | 0 | — |
| H | US128 | Autônoma 1 (próxima sessão) | 11/04/2026 | 0 | — |
| H | US129 | Autônoma 1 (próxima sessão) | 11/04/2026 | 0 | — |
| H | US132 | Autônoma 1 (próxima sessão) | 11/04/2026 | 0 | — |
| H | US121-123 | Autônoma 2 (3 US) | 11/04/2026 | 0 | — |
| H | US124,126,131 | Autônoma 3 (3 US) | 11/04/2026 | 0 | — |
| H | US117 | Autônoma 4 | 11/04/2026 | 0 | — |
| H | US130 | Autônoma 5 | 11/04/2026 | 0 | — |
| H | US133,134/135 | Autônoma 7 (2 US) | 11/04/2026 | 0 | — |
| K | — | Bloco K (a definir, ~15 US) | — | 0 | Aguarda H |
| L | — | Bloco L (a definir, ~15 US) | — | 0 | Aguarda K |
| E | — | Land Designer Fase 2+ (PRD v1.0 pronto, E1 ✅) | — | 0 | — |
| — | — | Pricing AI (retomar) | Indeterminado | 0 | ⛔ Urbit API (negociação comercial) |

> ✅ Removidos desta lista: Bloco J (US-60,62,63,65 concluídos s148), Bloco E Fase E1 (CAD Studio s149), US125 backend (s145).

## Desvios (feito fora do plano)

| Sessão | Data | O que fez | Classificação |
|--------|------|-----------|---------------|
| 145 | 11/04/2026 | US-125 Zoneamento Municipal — somente backend (3 arquivos), frontend pendente | parcial/fora de sequência |
| 148 | 11/04/2026 | Bloco J Geo Avançado (US-60,62,63,65) — antecipado antes de completar H | avanço fora da sequência |
| 149 | 11/04/2026 | CAD Studio Bloco E Fase E1 — antecipado antes de completar H e G S2 | avanço fora da sequência |
| 150 | 11/04/2026 | 8 bugs resolvidos (mapa, 3D, EFs 401) | bugfix/QA |
| 151 | 12/04/2026 | Auth fix sistêmico 19 EFs + 4 standalone | bugfix/QA |

> Obs: Blocos J e E foram antecipados antes da conclusão de H e G Sprint 2. Sem impacto negativo (sem dependências duras), mas H e G S2 ficaram com itens pendentes.

## Métricas

| Métrica | Valor |
|---------|-------|
| Sessões totais no período (s145,148-151) | 5 sessões |
| Sessões no plano (H, J, E) | 3 sessões (145, 148, 149) |
| Sessões QA/bugfix | 2 sessões (150, 151) |
| % hotfix/QA | 40% (meta: < 30%) ⚠️ |
| Velocidade | 2 blocos completos (J + E1) em 2 sessões |
| Bloco H Autônoma 1 bloqueado há | 4 dias (desde 11/04/2026) |
| Bloco G Sprint 2 bloqueado há | 5 dias (desde 10/04/2026) |
| Novas sessões desde última auditoria (13/04) | 0 sessões |

## Inconsistências detectadas

| Item | Observado | Esperado | Ação |
|------|-----------|----------|------|
| bloco-h-moat-regional.md | US125 marcada como 🔲 | Deveria registrar backend s145 | Atualizar bloco-h na próxima sessão de H |
| TRACKER Bloco H | "— sessões" mas H5 aparece no progresso global | Registrar s145 como sessão parcial de H | — |
| Bloco J | J ✅ no TRACKER mas sem arquivo sprint próprio | Normal — J foi definido ad-hoc | — |

## Alertas

- 🔴 **CRÍTICO:** Pricing AI bloqueado por Urbit API — negociação comercial em andamento, sem prazo definido.
- 🟡 **ATENÇÃO:** Bloco H Autônoma 1 (US127,128,129,132) — 4 dias sem progresso. É o próximo passo imediato definido no TRACKER.
- 🟡 **ATENÇÃO:** Bloco G Sprint 2 (3 features: Execute actions, Análise preditiva, Comparador) sem sessão planejada há 5 dias.
- 🟡 **ATENÇÃO:** % QA/hotfix = 40% nas últimas 5 sessões (acima da meta de 30%). Relacionado ao lançamento dos blocos E1, J, H5.
- 🟠 **INCONSISTÊNCIA:** bloco-h-moat-regional.md não reflete backend US125 feito em s145 — corrigir na próxima sessão de Bloco H.
- 🟢 **OK:** Blocos A-D + F + G S1 + J + E1 todos ✅. PRD Bloco E (60 US) pronto. ~60% global.
- 🟢 **OK:** TRACKER global condizente com blocos entregues.
- 🟢 **OK:** Nenhuma sessão nova desde última auditoria (12/04) — projeto está em pausa aguardando próxima sessão agendada (Bloco H Autônoma 1).
