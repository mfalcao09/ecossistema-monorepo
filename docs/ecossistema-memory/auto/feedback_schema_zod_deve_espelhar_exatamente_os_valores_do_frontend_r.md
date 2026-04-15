---
name: Schema Zod deve espelhar exatamente os valores do frontend (roles ERP)
description: Schema Zod deve espelhar exatamente os valores do frontend (roles ERP)
type: feedback
project: erp
tags: ["zod", "validação", "roles", "enum", "usuários"]
success_score: 0.95
supabase_id: f2e58947-e3d1-40f9-a979-35dcf5cc8356
created_at: 2026-04-13 23:22:29.771969+00
updated_at: 2026-04-14 00:06:42.781881+00
---

Bug sessão 091: criarUsuarioSchema em zod-schemas.ts tinha roles antigas [admin, secretario, diretor, visualizador]. O frontend enviava os 10 perfis reais (admin_instituicao, aux_secretaria, diretoria, etc.) — todos rejeitados com "Dados inválidos". Regra: sempre que o frontend tiver um enum de valores, o schema Zod correspondente deve ter exatamente os mesmos valores. Roles corretas atuais: admin_instituicao, aux_bibliotecaria, aux_financeiro, aux_secretaria, bibliotecaria, cadastramento, comunidade, coordenacao_curso, diretoria, estudantes.
