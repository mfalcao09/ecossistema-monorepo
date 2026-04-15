---
name: Sessão 069 — Fix C navegação pipeline
description: Fix C (commit 0f779dd, READY): list + form antigo agora reconhecem diploma_id e navegam direto para /diploma/diplomas/{id}; Fix A (emissora null) e Fix B (120 disciplinas sem docente_nome) explicitamente adiados
type: project
---

Fix C implementado (commit `0f779dd`, deploy READY): processos criados via novo fluxo de extração IA agora navegam direto para a pipeline ao invés de abrir o formulário antigo.

**Why:** O fluxo novo (drag-drop→extração→converter_sessao_em_processo) cria diploma automaticamente, mas a list page e o formulário antigo não sabiam disso — mostravam "Confirmar e Criar Processo" e bloqueavam acesso ao botão Gerar XML.

**How to apply:** 4 arquivos alterados: `api/processos/[id]/route.ts` (retorna diploma_id), `api/processos/route.ts` (FK join), `processos/[id]/page.tsx` (botão "Ir para Pipeline"), `processos/page.tsx` (onClick direto para diplomas).

Pendências adiadas explicitamente por Marcelo:
- Fix A: emissora_nome null em diplomas do novo fluxo
- Fix B: 120 disciplinas sem docente_nome (risco XSD v1.05)
