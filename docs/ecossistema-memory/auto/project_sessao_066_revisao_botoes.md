---
name: Sessão 066 — Substituir Arquivo + Excluir Importação na Revisão
description: Botão Substituir Arquivo no dialog + botão Excluir importação na sidebar da revisão + melhorias de disciplinas editáveis
type: project
---

Sessão 066 (11/04/2026): 4 tasks concluídas na tela de revisão pós-extração.

**Why:** Completar a UX da tela de revisão — operador precisava trocar arquivo errado sem sair da tela, e precisava poder cancelar uma importação inteira com segurança.

**How to apply:**
- `DialogVisualizarDocumento` agora recebe `onSubstituirArquivo` + `substituindo` props — botão âmbar no footer do dialog
- `descartarExtracao()` em `page.tsx` usa `window.confirm` + `POST /api/extracao/sessoes/${sessaoId}/descartar`
- Botão vermelho-outline na sidebar abaixo de "Voltar para a lista"
- Disciplinas: todos os campos editáveis, soma CH por período, banner CH integralizada

**Commit:** `444207c` — deploy READY 54s

**Pendências herdadas:**
- Formulário antigo (/diploma/processos/[id]/page.tsx) ainda não removido
- 61 disciplinas com docente_nome = NULL no processo b71cdb1b
- Auto-preenchimento Curso/Emissora/IES pendente
