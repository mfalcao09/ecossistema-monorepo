---
name: Sessão 048 — Prompt v3 gavetas tipadas + Reducer relacional
description: Sessão 048 — Prompt v3 gavetas tipadas + Reducer relacional
type: project
project: erp
tags: ["gemini", "reducer", "fan-out", "sessao-048"]
success_score: 0.9
supabase_id: f60453ad-fa64-4eec-8527-9eeeeda32a9b
created_at: 2026-04-13 09:24:44.925893+00
updated_at: 2026-04-13 18:06:10.800771+00
---

Commit 5d7ea69 (10/04/2026). Sprint A do plano Fan-Out/Reducer. extractor.js: prompt v3 com 15 tipos documento, gavetas tipadas (horarios_extraidos, titulacoes_historicas, enade, historico_ensino_medio), confianca_campos por campo, maxOutputTokens 65536, temperature 0.1, timeout 90s. server.js: consolidarDados() substitui agregarDados() com normalizarNome (sem acentos, uppercase, sem prefixos acadêmicos), similaridade Jaccard threshold 0.6, mergeCampoACampo primeiro-não-nulo, JOIN disciplina×horário para docente, JOIN docente×planilha_titulacao para titulação temporal, flatten RG/naturalidade, mapping data_ingresso→data_inicio. FormularioRevisao: colunas Conceito + Integraliz. na tabela. Why: extração anterior inconsistente com prompt genérico.
