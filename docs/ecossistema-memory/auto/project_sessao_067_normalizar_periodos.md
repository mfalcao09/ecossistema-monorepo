---
name: Sessão 067 — Normalizar períodos + labels editáveis em SecaoDisciplinas
description: SecaoDisciplinas.tsx ganha normalizarPeriodo(), agrupamento por chave numérica, labels editáveis (pencil icon) e botão "Padronizar Períodos"
type: project
---

Sessão 067 (11/04/2026): Padronização e edição de períodos nas disciplinas.

**Problema:** Gemini extrai períodos com formatos inconsistentes ("7º Período", "8º SEMESTRE", "8º Período") causando agrupamentos separados para o mesmo período.

**Implementado:**
- `normalizarPeriodo(raw)` — extrai número de qualquer formato ("7º SEMESTRE" → "7")
- `useMemo` agrupa disciplinas por chave numérica normalizada
- Labels editáveis: pencil icon hover → inline input (Enter salva, Esc cancela)
- Estado `labelsPersonalizados` permite renomear cada grupo (ex: "7º Período" → "7º Semestre Letivo")
- Botão "✨ Padronizar Períodos" na toolbar — grava número puro no campo `periodo` de todas as disciplinas
- Interface `GrupoPeriodo` com campos tipados (periodo, label, disciplinas, chTotal, pendentes)

**Commit:** `821cad3` — deploy Vercel READY 54s

**Why:** Dados vindos da extração Gemini precisam ser normalizados para evitar duplicação de grupos. Edição manual dá flexibilidade ao operador.

**How to apply:** O botão "Padronizar Períodos" aparece só no modo agrupado com >1 grupo e quando não readOnly. O label personalizado persiste no state local (não salva no banco — é visual durante a revisão).
