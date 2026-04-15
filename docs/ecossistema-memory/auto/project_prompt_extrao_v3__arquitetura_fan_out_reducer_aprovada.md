---
name: Prompt Extração v3 — Arquitetura Fan-Out/Reducer aprovada
description: Prompt Extração v3 — Arquitetura Fan-Out/Reducer aprovada
type: project
project: erp
tags: ["gemini", "arquitetura", "extracao", "fan-out"]
success_score: 0.9
supabase_id: 63e556c5-fc27-47ea-81b1-fd28036d8c9a
created_at: 2026-04-13 09:25:18.754153+00
updated_at: 2026-04-13 19:06:16.132286+00
---

Decisão aprovada 10/04/2026. Arquitetura: cada arquivo vai individualmente ao Gemini (Fan-Out) → Reducer relacional para correlação cross-document. Prompt v3 com 15 tipos de documento, gavetas tipadas (horarios_extraidos, titulacoes_historicas, enade, enem, historico_ensino_medio), confianca_campos por campo, genitores estrutura {nome,sexo}, disciplinas com conceito/forma_integralizacao/docente. Reducer: JOIN disciplina×horário→professor; JOIN professor×planilha_titulacao→titulação temporal; fuzzy matching normalize BR (Levenshtein); merge primeiro-não-nulo-ganha por campo. Pendência: fonte dados institucionais (horário aulas + planilha titulação) — 3 opções A/B/C aguardando Marcelo decidir. Nota: XSD exige OU nota OU conceito por disciplina — tratar no builder XML. 4 sprints: A(prompt)✅ B(Reducer) C(contexto) D(ajustes).
