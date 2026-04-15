---
name: diplomados.rg não existe — coluna é rg_numero
description: Tabela diplomados tem rg_numero (não rg), rg_orgao_expedidor, rg_uf — sempre verificar nomes reais antes de usar
type: feedback
---

A tabela `diplomados` NÃO tem coluna `rg`. Os campos de RG são:
- `rg_numero` — número do RG
- `rg_orgao_expedidor` — órgão expedidor
- `rg_uf` — UF do órgão

**Why:** Query `.select('id, cpf, email, rg')` falhava silenciosamente retornando error, causando total:0 na migração PII.

**How to apply:** Sempre consultar `information_schema.columns` ou a migration original antes de referenciar colunas — não presumir nomes.
