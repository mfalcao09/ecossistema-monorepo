---
name: Sessão 075 — Fix 6 bugs pós-s074 (nav + auditoria genitores/CH/comprobatórios)
description: 6 bugs corrigidos: nav lista→revisão, 3 links pipeline, redirect pós-confirmar, auditoria genitores/CH/comprobatórios. SQL RPC+data fix. Commit b82d6fd READY.
type: project
---

Fix cluster de 6 bugs encontrados após testes da sessão 074. Entregue em 12/04/2026.

**Commit:** `b82d6fd` | **Deploy:** `dpl_8y8B7ysvsWe4pMYR7YXAJojnXrHa` → READY ✅

**Bugs resolvidos:**

1. **Nav lista processos**: `sessao_id` presente → sempre abre revisão (removida condição de status).
2. **3 links pipeline** (`[id]/page.tsx`): apontavam para form antigo → agora usam `extracao?.id` para rota revisão.
3. **Redirect pós-confirmar**: `router.push("/diploma/processos")` → `router.push("/diploma/diplomas/${diplomaId}")`.
4. **Auditoria genitores**: `filiacoes` table adicionada ao Promise.all da rota de auditoria como fonte primária.
5. **Auditoria CH + docentes**: RPC corrigida (COALESCE `docente`/`nome_docente`, CH top-level); data fix 55 disciplinas + CH=4560.
6. **Auditoria comprobatórios**: RPC agora faz INSERT em `diploma_documentos_comprobatorios` com cast `::tipo_documento_comprobatorio`.

**SQL aplicado em produção:**
- `fix_rpc_comprobatorios_cast_s075`: RPC completa corrigida
- `fix_data_kauana_s075`: dados históricos da Kauana (sessão df0d24e1)

**Why:** Testes revelaram que o fluxo pós-upload estava quebrado em 6 pontos distintos; auditoria XSD dava falso-positivo em genitores, CH e comprobatórios.

**How to apply:** RPC `converter_sessao_em_processo` agora é a versão correta com COALESCE e cast. Novos campos do extractor devem ser sempre verificados contra as chaves usadas na RPC.
