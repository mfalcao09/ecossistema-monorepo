---
name: FormularioRevisao usa chaves diferentes do dados_extraidos
description: FormularioRevisao salva em dados.diplomado (nome_completo, rg_numero) enquanto dados_extraidos usa dados.aluno (nome, rg) — sempre usar COALESCE fallback chain
type: feedback
---

FormularioRevisao salva dados revisados sob chaves DIFERENTES do dados_extraidos original:
- `dados_confirmados.diplomado.nome_completo` vs `dados_extraidos.aluno.nome`
- `dados_confirmados.diplomado.rg_numero` vs `dados_extraidos.aluno.rg`
- `dados_confirmados.diplomado.*` vs `dados_extraidos.aluno.*`
- `dados_confirmados.academicos.*` vs `dados_extraidos.curso.*`

**Why:** O FormularioRevisao foi escrito com tipos XSD v1.05 (DadosDiplomado) que usam nomes canônicos do MEC. O extrator Gemini usa nomes genéricos. A divergência causou gate bloqueando 100% das sessões com 9 falsos positivos.

**How to apply:** TODO código que lê dados_confirmados/dados_extraidos DEVE usar COALESCE fallback chain:
- JS: `dados.diplomado ?? dados.aluno`
- SQL: `COALESCE(v_dados->'diplomado', v_dados->'aluno')`
- Campos: `nome_completo ?? nome`, `rg_numero ?? rg`, `naturalidade_municipio ?? naturalidade`
