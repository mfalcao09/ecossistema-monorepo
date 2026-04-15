---
name: Sessão 065 — Fix CPF+NOME no card de extração
description: Fix "Diplomando não identificado" → CPF + NOME COMPLETO no card /diploma/processos via API /api/extracao/minhas
type: project
---

Sessão 065 (11/04/2026): fix extração de nome/CPF aninhado em dados_extraidos. Commit `805d6b1`, deploy READY.

**Why:** Card exibia "Diplomando não identificado" pois API buscava campos top-level, mas estrutura real é `dados_extraidos.diplomado.{cpf, nome_completo}`.

**How to apply:**
- `/api/extracao/minhas` agora usa cadeia de fallback: `dip.cpf/nome_completo` → `dip.nome` → `dados.nome_completo` → `dados.nome`
- Formato: `"{cpf} - {nome}"` (padrão sessão 064)
- `nome_diplomando_provisorio` no payload carrega esse valor formatado

**Pendências herdadas:**
- Formulário antigo (`/diploma/processos/[id]/page.tsx`) ainda não removido
- 61 disciplinas com docente_nome = NULL no processo b71cdb1b
- Auto-preenchimento Curso/Emissora/IES pendente
