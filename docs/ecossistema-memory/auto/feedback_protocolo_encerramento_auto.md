---
name: Protocolo de encerramento automático
description: Ao concluir as tarefas da sessão, executar automaticamente o protocolo de encerramento (persist) sem esperar Marcelo pedir
type: feedback
---

Ao concluir as tarefas/US da sessão, executar AUTOMATICAMENTE o protocolo de encerramento completo, sem esperar Marcelo pedir.

**Why:** Marcelo definiu que auto-save é absoluto — ele NUNCA deve precisar pedir para salvar. O protocolo de encerramento garante rastreabilidade entre sessões. Sem ele, sessões futuras perdem contexto e o TRACKER fica desatualizado.

**How to apply:**
Quando as tarefas da sessão estiverem concluídas (ou Marcelo sinalizar encerramento), executar imediatamente:

### ERP Educacional (6 passos — ver CLAUDE.md seção "Encerramento"):
1. Salvar sessão com backlinks (masterplan → sprint → epic)
2. Atualizar sprint (✅ itens, registrar sessão)
3. Atualizar TRACKER.md (%, última/próxima sessão)
4. Atualizar MEMORY.md (rotacionar decisões)
5. Atualizar CENTRAL-MEMORY.md
6. Indicar próxima sessão se pré-planejada

### Intentus Platform (9 passos — ver bloco_h_checklist.md ou equivalente):
1. US implementadas
2. Buchecha review
3. Deploy EF (se aplicável)
4. Commit/push
5. Vercel READY
6. Atualizar checklist/sprint
7. Salvar memória da sessão
8. Atualizar MEMORY.md / SINTESE.md
9. Informar Marcelo

### Cross-project (sempre):
- Atualizar CENTRAL-MEMORY.md se houve progresso relevante
- Atualizar TRACKER do projeto correspondente

**Gatilho:** Não depende de Marcelo dizer "encerra" — basta que as tarefas planejadas estejam concluídas.
