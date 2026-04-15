---
name: diplomados.rg_numero (não rg) — verificar nomes reais das colunas
description: diplomados.rg_numero (não rg) — verificar nomes reais das colunas
type: feedback
project: erp
tags: ["diplomados", "colunas", "rg", "banco"]
success_score: 0.9
supabase_id: 90a7b41b-ab43-4107-90fd-785bc62119c3
created_at: 2026-04-13 09:16:29.500429+00
updated_at: 2026-04-13 13:05:20.575547+00
---

A tabela diplomados NÃO tem coluna rg. Os campos de RG são: rg_numero (número do RG), rg_orgao_expedidor (órgão expedidor), rg_uf (UF do órgão). Query .select(id, cpf, email, rg) falhava silenciosamente retornando error, causando total:0 na migração PII. Sempre consultar information_schema.columns ou a migration original antes de referenciar colunas — não presumir nomes.
