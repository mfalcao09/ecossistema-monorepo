---
name: Confirmação humana sobrescreve qualquer regra automática
description: Validações automáticas devem chamar atenção, nunca bloquear em definitivo. Operador humano com responsabilidade definida tem a palavra final.
type: feedback
---

**Regra:** Toda validação automática do sistema (guardrails, schema constraints validados em runtime, regras de negócio do tipo "X precisa ser maior que Y", "data A precisa ser anterior a B", "campo obrigatório se Z", etc.) DEVE permitir override humano explícito com justificativa registrada.

**Why:** Marcelo (07/04/2026, decisão sobre Bug #H — carga horária integralizada vs total). Princípio dele: "a confirmação humana pode sobrescrever qualquer regra". O contexto do sistema é educação — há infinitas exceções legítimas que nenhuma regra automática consegue cobrir (grades antigas, casos especiais aprovados pelo conselho, alunos transferidos, dispensas, etc.). Se o sistema bloquear o operador em definitivo, ele vai contornar via SQL direto e perder o rastro. Se permitir override registrado, mantemos auditoria completa e o operador tem autonomia.

**How to apply:**
- Quando implementar QUALQUER validação automática que possa bloquear uma ação (geração de XML, salvamento, envio, aprovação...), o frontend NUNCA deve dar erro fatal sem oferecer "Confirmar mesmo assim".
- O override SEMPRE exige: (1) justificativa em texto livre obrigatória, (2) registro do user_id que aprovou, (3) snapshot dos valores originais que dispararam o aviso, (4) timestamp.
- Padrão de schema: tabela `validacao_overrides` (ou equivalente por contexto) com colunas `entidade_tipo`, `entidade_id`, `regra_codigo`, `valores_originais` (jsonb), `justificativa`, `usuario_id`, `created_at`.
- Backend: a rota deve aceitar uma flag (ex: `overrideValidacao: true` + `justificativa: string`) que pula a validação SE e somente se a justificativa estiver presente e o usuário tiver permissão.
- Auditoria: relatório de exceções aprovadas deve estar acessível para a coordenação revisar periodicamente.
- **Não confundir com validações de SCHEMA XSD obrigatórias (`minOccurs=1`, tipos enum, etc.)** — essas não podem ser sobrescritas porque o XML não passa na validação da registradora. Override é só para regras de NEGÓCIO da FIC.
