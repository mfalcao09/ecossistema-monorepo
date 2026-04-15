---
name: Sessão 070 — Pipeline Auditar Requisitos XSD completa
description: 6 validators XSD v1.05 + GET /api/diplomas/[id]/auditoria + useAuditoria hook + PainelAuditoria UI + gate suave no page.tsx — commit 17efbc4 deploy dg0grt8m6 READY
type: project
---

Pipeline "Auditar Requisitos XSD" implementada e em produção (sessão 070, 11/04/2026).

**Commit:** `17efbc4` | **Deploy:** `dg0grt8m6` → READY em 56s

**Arquitetura:**
- `src/lib/auditoria/tipos.ts` — tipos centrais
- `src/lib/auditoria/grupos/{diplomado,filiacao,curso,ies,historico,comprobatorios}.ts` — 6 validators
- `src/lib/auditoria/index.ts` — orquestrador: `executarAuditoria(input)` → `RespostaAuditoria`
- `src/app/api/diplomas/[id]/auditoria/route.ts` — GET route com Promise.all(5 queries paralelas)
- `src/hooks/useAuditoria.ts` — cache sessionStorage key `auditoria:{diplomaId}:{updatedAt}`
- `src/components/diploma/PainelAuditoria.tsx` — UI com badges, grupos expandíveis, botões de correção
- `page.tsx` — PainelAuditoria integrado + gate suave amber (override humano preservado)

**Fontes de dados:**
- IES: tabela `instituicoes` (ativo=true, limit 1) + tabela `credenciamentos` (tipo='credenciamento')
- Comprobatórios: `diploma_documentos_comprobatorios` — `tem_arquivo = arquivo_origem_id IS NOT NULL`
- FIC extra: 4 tipos obrigatórios além do mínimo XSD

**Why:** Previne erros XSD antes da geração dos XMLs; gate suave respeita o princípio de override humano do ERP.

**How to apply:** O painel aparece automaticamente na página do diploma para status rascunho/preenchido/validando_dados/erro. Botão "Auditar" chama GET /api/diplomas/[id]/auditoria e exibe resultado por grupo.
