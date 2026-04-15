---
name: Sessão 058 — E2E converter_sessao + Epic 2.1 completo
description: Teste e2e da RPC converter_sessao_em_processo encontrou 4 bugs (UF overflow, rg_orgao mismatch, ENADE derivação, check constraint) — todos corrigidos na RPC v2, commit 8275d16
type: project
---

Sessão 058 (11/04/2026): teste end-to-end da RPC `converter_sessao_em_processo` com sessão real (Kauana, 59 disciplinas).

**4 bugs corrigidos:**
1. `naturalidade_uf` char(2) recebia nome completo → helper `normalizar_uf()` com 27 estados
2. `rg_orgao` não lido (FormularioRevisao usa `rg_orgao`, RPC só lia `rg_orgao_expedidor`) → COALESCE chain
3. ENADE ignorado quando `situacao` ausente → derivação de `habilitado`/`condicao`
4. Check constraint sem `aguardando_revisao`/`convertido_em_processo` → recriado com 10 valores

**Why:** Esses 4 bugs só aparecem com dados reais — unit tests não cobrem mismatch de nomes de campo entre FormularioRevisao e RPC.
**How to apply:** Qualquer nova RPC que leia dados_confirmados/dados_extraidos DEVE usar COALESCE fallback chain para todos os nomes de campo conhecidos (diplomado/aluno, nome_completo/nome, rg_orgao/rg_orgao_expedidor, etc.)

Migration: `20260411_fix_rpc_converter_sessao_e2e.sql` (576 linhas). Commit `8275d16`, deploy READY.
**Epic 2.1 COMPLETO (100%).** Próximo: E2.2 BRy (bloqueado) ou Sprint 3.
