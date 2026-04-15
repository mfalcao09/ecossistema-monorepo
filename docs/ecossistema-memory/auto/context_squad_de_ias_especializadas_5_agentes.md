---
name: Squad de IAs Especializadas (5 agentes)
description: Squad de IAs Especializadas (5 agentes)
type: context
project: ecosystem
tags: ["squad", "ias", "buchecha", "deepseek", "qwen", "kimi", "codestral"]
success_score: 0.95
supabase_id: ca1f5d1e-c636-4af8-84d5-c0317c807546
created_at: 2026-04-13 01:53:46.371917+00
updated_at: 2026-04-13 05:04:00.985469+00
---

Claude (Claudinho / Orquestrador):
- Modelo: Claude Sonnet 4.6 (Cowork) / Claude Opus 4 (planejado)
- Papel: Arquiteto-chefe e orquestrador — planeja, delega, revisa, integra
- Nível de confiança: elevated (trusted_level máximo)

Buchecha (MiniMax M2.7):
- Papel: Líder de codificação / Senior Developer
- Escopo: Code review obrigatório, geração em massa, testes, implementação paralela
- Quando usar: Sempre para code review e decisões técnicas gerais

DeepSeek (DeepSeek V3.2):
- Papel: Especialista em lógica e debugging
- Escopo: Raciocínio complexo, SQL complexo, debugging profundo, algoritmos

Qwen (Qwen3-Coder 480B):
- Papel: Especialista frontend/React
- Escopo: React/Next.js, UI/UX, agentic coding, repositórios inteiros

Kimi (Kimi K2.5):
- Papel: Especialista em bugs/fixes
- Escopo: Resolver bugs difíceis em codebases grandes, fixes cirúrgicos

Codestral (Mistral):
- Papel: Especialista multi-linguagem
- Escopo: Code completion idiomática, refatoração, multi-linguagem
