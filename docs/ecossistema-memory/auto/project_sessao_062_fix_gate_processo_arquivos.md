---
name: Sessão 062 — Fix Gate Processo Arquivos
description: Causa raiz gate desincronizado: fluxo extração nunca criava linhas em processo_arquivos; fix INSERT non-blocking no POST /api/extracao/iniciar
type: project
---

Sessão 062 (11/04/2026): Bug recorrente — gate listava 4 comprobatórios faltantes enquanto sidebar mostrava 4/4 confirmados.

**Causa raiz:** POST /api/extracao/iniciar criava sessão + JSONB `arquivos` mas NUNCA populava tabela `processo_arquivos`. O gate validator lê `processo_arquivos.tipo_xsd` → via 0 linhas → bloqueava. Sidebar lia de `dados_extraidos` (JSONB in-memory) → caminho separado → mostrava tudo OK.

**Fix:** INSERT non-blocking em `processo_arquivos` step 5b da rota iniciar, logo após criação da sessão. Campos tipo_xsd/destino ficam NULL — preenchidos pelo auto-save do PUT revisão.

**Why:** Sessions 047 e 049b corrigiram sintomas (filename matching, tipo_xsd sync) mas sem linhas no banco não havia o que corrigir.

Commit `84ca857`, deploy Vercel READY 54s.
