---
name: 3 agentes de cadastro de pessoas em produção
description: Agentes dedicados para aluno, professor e colaborador implementados e deployados em 05/04/2026
type: project
---

3 agentes de cadastro implementados e em produção (commit 5196547, deploy READY):

| Agente | Funcionalidade | ID no banco |
|--------|---------------|-------------|
| Assistente de Cadastro de Alunos | cadastro_aluno | 92c59846-d072-4a0a-bcd0-562b47493f80 |
| Assistente de Cadastro de Professores | cadastro_professor | c45bfbad-e026-48b3-bdd6-96f276a04d7f |
| Assistente de Cadastro de Colaboradores | cadastro_colaborador | 5a8f067a-86b8-4732-a35f-26a58cb8f1e5 |

**Configuração:** módulo=pessoas, modelo=anthropic/claude-sonnet-4-5, temp=0.4, provider=OpenRouter

**Arquivos alterados:**
- `src/app/api/ia/chat/route.ts` — roteia agente por categoria via `mapearFuncionalidade()`
- `src/components/ia/AssistenteChat.tsx` — saudação dinâmica via `getMensagemBoasVindas()`
- `docs/PROMPTS-AGENTES-PESSOAS.md` — prompts aprovados documentados

**Como funciona:** O formulário `pessoas/novo` passa `categorias` no contexto. A API de chat mapeia a categoria principal para a funcionalidade do agente (`aluno→cadastro_aluno`, `professor→cadastro_professor`, `colaborador→cadastro_colaborador`). O persona do agente vem do banco + contexto dinâmico (campos, docs, instituição) é injetado.

**Why:** Cada tipo de pessoa tem documentos, tom e fluxo diferentes. Agentes dedicados são mais precisos que um genérico.
**How to apply:** Na Fase 2, esses agentes receberão skills fixas vinculadas via ia_agente_skills.
