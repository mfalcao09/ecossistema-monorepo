---
name: Sessão 061 — Fix Código e-MEC + Normalização Enums
description: API /api/cursos não incluía codigo_mec no select; enums banco (lowercase) normalizados para XSD v1.05 (Bacharelado, etc.)
type: project
---

Sessão 061 (11/04/2026): dois fixes na tela de revisão do diploma.

1. **Código e-MEC auto-preenchido:** `instituicoes ( nome, cnpj )` → `instituicoes ( nome, cnpj, codigo_mec )` na API `/api/cursos`. A página já usava o campo, só faltava no select do Supabase.

2. **Normalização enums banco→XSD:** banco armazena `bacharel`/`ead`/`presencial` (lowercase), mas selects do formulário usam valores XSD v1.05 (`Bacharelado`, `EAD`, `Presencial`). Mapas de normalização adicionados em `page.tsx` + extração de grau de texto livre no título conferido.

**Why:** Marcelo notou campo vazio na tela de revisão em produção.
**How to apply:** Qualquer novo campo do cadastro que precise aparecer no formulário de revisão → verificar se o select da API inclui a coluna.

Commit: `1286420` | Deploy: ● Ready 54s
