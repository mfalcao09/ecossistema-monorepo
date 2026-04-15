---
name: Sessão 046 — RPC converter_sessao_em_processo
description: RPC PL/pgSQL transacional criada e aplicada no Supabase — fecha loop Tela 2 → Criar Processo. Commit 71d619c.
type: project
---

Sessão 046 (10/04/2026): RPC `converter_sessao_em_processo` criada e aplicada no Supabase (`ifdnjieklngcfodmtied`).

**O que é:** Função PL/pgSQL SECURITY DEFINER que converte `extracao_sessoes` em `processos_emissao` + `diplomados` + `diplomas` + todas tabelas relacionadas de forma atômica (14 passos).

**Por que era crítico:** Era a ÚNICA peça faltante no pipeline end-to-end. A API route (`/api/extracao/sessoes/[id]/converter`) já existia e chamava `supabase.rpc('converter_sessao_em_processo')`, mas a função não existia no banco.

**Bugs corrigidos no review:**
- CASE `%aproveit%` movido ANTES de `%aprov%` (senão 'aproveitado' nunca seria capturado)
- `FOR UPDATE` adicionado no SELECT de diplomados por CPF (anti-race condition)
- Enum corrigido: `sexo_tipo` (não `sexo_enum`)

**Commit:** `71d619c` — `feat(db): add RPC converter_sessao_em_processo`

**How to apply:** O fluxo completo agora funciona: Tela 1 (drag-drop) → extração Gemini → Tela 2 (revisão + gate FIC) → Criar Processo → Tela 3 (accordion). Próximo passo é teste end-to-end real.
