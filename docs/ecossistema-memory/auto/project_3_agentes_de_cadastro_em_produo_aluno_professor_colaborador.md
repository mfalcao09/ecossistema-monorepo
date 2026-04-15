---
name: 3 agentes de cadastro em produção (aluno/professor/colaborador)
description: 3 agentes de cadastro em produção (aluno/professor/colaborador)
type: project
project: erp
tags: ["agentes", "ia", "pessoas", "cadastro"]
success_score: 0.9
supabase_id: e765618b-c9b2-4294-8b75-7f8939e871f8
created_at: 2026-04-13 09:17:44.594726+00
updated_at: 2026-04-13 14:05:31.505371+00
---

3 agentes implementados e em produção (commit 5196547, deploy READY, 05/04/2026). Assistente Alunos ID 92c59846, Assistente Professores ID c45bfbad, Assistente Colaboradores ID 5a8f067a. Configuração: módulo=pessoas, modelo=anthropic/claude-sonnet-4-5, temp=0.4, provider=OpenRouter. Arquivos: src/app/api/ia/chat/route.ts roteia por categoria via mapearFuncionalidade(). Fase 2: receberão skills fixas via ia_agente_skills.
