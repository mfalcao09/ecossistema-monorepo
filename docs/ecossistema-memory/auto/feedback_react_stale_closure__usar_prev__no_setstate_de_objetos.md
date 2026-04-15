---
name: React stale closure — usar (prev) => no setState de objetos
description: React stale closure — usar (prev) => no setState de objetos
type: feedback
project: erp
tags: ["react", "stale-closure", "usestate", "bug"]
success_score: 0.9
supabase_id: b28b47c7-42d0-4912-a51e-3209a5459725
created_at: 2026-04-13 09:15:02.133452+00
updated_at: 2026-04-13 12:05:06.106073+00
---

No ERP-Educacional, quando dois setState sequenciais atualizam campos diferentes do mesmo objeto, o segundo usa o objeto antigo do closure e sobrescreve a mudança do primeiro. Stale closure: em React, dois setState chamados em sequência no mesmo ciclo de renderização leem a mesma referência do closure. Como aplicar: em qualquer componente que use setRevisao({ ...revisao, ... }), SEMPRE usar a forma funcional setRevisao((prev) => ({ ...prev, [field]: value })). Especialmente quando há onChange que chama handleChange mais de uma vez.
