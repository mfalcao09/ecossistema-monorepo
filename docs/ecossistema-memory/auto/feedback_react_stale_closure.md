---
name: React stale closure — sempre usar prev => no setState de objetos
description: Quando dois setState sequenciais atualizam campos diferentes do mesmo objeto, usar (prev) => ({ ...prev, [field]: value }) em vez de { ...state, [field]: value }
type: feedback
---

No ERP-Educacional, o handleChange fazia `setRevisao({ ...revisao, [field]: value })`. Quando o onChange do ENADE chamava handleChange duas vezes seguidas (uma para situacao, outra para condicao), a segunda chamada usava o `revisao` antigo e sobrescrevia o campo alterado pela primeira.

**Why:** Stale closure — em React, dois `setState` chamados em sequência no mesmo ciclo de renderização: ambos leem a mesma referência `revisao` do closure, então o segundo "esquece" a mudança do primeiro.

**How to apply:** Em qualquer componente que use `setRevisao({ ...revisao, ... })` ou padrão similar, SEMPRE usar a forma funcional `setRevisao((prev) => ({ ...prev, [field]: value }))`. Especialmente quando há onChange que chama handleChange mais de uma vez.
