---
name: Confirmação humana sobrescreve qualquer regra automática
description: Confirmação humana sobrescreve qualquer regra automática
type: feedback
project: erp
tags: ["validacao", "override", "auditoria", "ux"]
success_score: 0.95
supabase_id: 01cbbff8-2b50-4438-992e-d47d8d6bc422
created_at: 2026-04-13 09:16:28.130214+00
updated_at: 2026-04-13 13:05:16.821024+00
---

Toda validação automática do sistema DEVE permitir override humano explícito com justificativa registrada. Princípio do Marcelo: "a confirmação humana pode sobrescrever qualquer regra". O contexto é educação — há infinitas exceções legítimas (grades antigas, casos especiais aprovados pelo conselho, alunos transferidos, dispensas). Padrão: o frontend NUNCA deve dar erro fatal sem oferecer "Confirmar mesmo assim". Override SEMPRE exige: (1) justificativa em texto livre obrigatória, (2) registro do user_id que aprovou, (3) snapshot dos valores originais, (4) timestamp. Tabela validacao_overrides com colunas entidade_tipo, entidade_id, regra_codigo, valores_originais (jsonb), justificativa, usuario_id.
