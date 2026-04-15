---
name: 3 agentes de cadastro de pessoas em produção
description: 3 agentes de cadastro de pessoas em produção
type: project
project: erp
tags: ["agentes", "pessoas", "ia", "cadastro"]
success_score: 0.9
supabase_id: f7fabc7b-212b-4ddd-8711-c705ce7660ef
created_at: 2026-04-13 09:26:27.981004+00
updated_at: 2026-04-13 20:06:24.392058+00
---

Commit 5196547, deploy READY (05/04/2026). Agente aluno (ID 92c59846), professor (c45bfbad), colaborador (5a8f067a). Config: módulo=pessoas, modelo=anthropic/claude-sonnet-4-5, temp=0.4, provider=OpenRouter. Arquivos: api/ia/chat/route.ts (roteia por mapearFuncionalidade()), AssistenteChat.tsx (saudação dinâmica getMensagemBoasVindas()), docs/PROMPTS-AGENTES-PESSOAS.md. Fluxo: formulário pessoas/novo passa categorias → API mapeia categoria → agente dedicado. How to apply: na Fase 2, agentes receberão skills fixas via ia_agente_skills. Agentes dedicados mais precisos que genérico pois cada tipo de pessoa tem docs, tom e fluxo diferentes.
