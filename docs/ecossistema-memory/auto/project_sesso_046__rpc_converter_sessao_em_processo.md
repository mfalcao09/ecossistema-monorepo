---
name: Sessão 046 — RPC converter_sessao_em_processo
description: Sessão 046 — RPC converter_sessao_em_processo
type: project
project: erp
tags: ["rpc", "supabase", "pipeline", "sessao-046"]
success_score: 0.92
supabase_id: 1d2d3704-dd8c-4b4f-82fc-102eb135ab9e
created_at: 2026-04-13 09:24:44.925893+00
updated_at: 2026-04-13 18:06:08.888083+00
---

Commit 71d619c (10/04/2026). RPC PL/pgSQL SECURITY DEFINER que converte extracao_sessoes → processos_emissao + diplomados + diplomas + tabelas relacionadas (14 passos atômicos). Era a ÚNICA peça faltante no pipeline end-to-end (/api/extracao/sessoes/[id]/converter existia mas chamava RPC inexistente). Bugs corrigidos: CASE %aproveit% movido ANTES de %aprov%; FOR UPDATE em SELECT de diplomados por CPF; enum corrigido sexo_tipo. How to apply: fluxo completo: Tela 1 → Gemini → Tela 2 → Criar Processo → Tela 3. Próximo passo: teste e2e real.
