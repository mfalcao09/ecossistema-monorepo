---
name: project_sessao_049_fix_processando_0_arquivos
description: Sessão 049 (11/04): fix "Processando 0 arquivos" na Tela 2 — API lite retornava arquivos:[] em vez do JSONB real. Commit 5d7b4ef.
type: project
---

Sessão 049 (11/04/2026): Tela 2 mostrava "Processando 0 arquivos" porque o modo lite da API GET /api/extracao/sessoes/[id] retornava `arquivos: []` durante status `processando`. O campo `arquivos` é JSONB leve (~1KB), o pesado é `dados_extraidos`. Fix: `arquivos: sessao.arquivos ?? []`. Commit 5d7b4ef.

**Why:** Bug visual reportado pelo Marcelo — número de arquivos exibido não correspondia ao total real.

**How to apply:** Ao adicionar campos ao modo lite da API de sessões, avaliar se o campo é realmente pesado antes de omiti-lo. O split lite/heavy deve excluir apenas `dados_extraidos` e `dados_confirmados`.
