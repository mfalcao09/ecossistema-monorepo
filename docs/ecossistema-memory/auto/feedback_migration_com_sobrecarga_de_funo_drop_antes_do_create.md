---
name: Migration com sobrecarga de função: DROP antes do CREATE
description: Migration com sobrecarga de função: DROP antes do CREATE
type: feedback
project: erp
tags: ["supabase", "migration", "sql", "sobrecarga", "erro-42725"]
success_score: 0.9
supabase_id: b241f151-2b27-4125-bd62-e5a016ede628
created_at: 2026-04-15 01:27:27.031373+00
updated_at: 2026-04-15 01:27:27.031373+00
---

Se uma função SQL tem múltiplas sobrecargas (diferentes assinaturas), apply_migration falha com 42725 "function name not unique" ao tentar recriar.

Por que: o DROP sem especificar tipos de argumento não sabe qual sobrecarga remover se há mais de uma.

Como aplicar: antes do CREATE OR REPLACE, fazer DROP FUNCTION IF EXISTS schema.funcao(tipo1, tipo2) especificando a assinatura exata que se quer remover. Cada sobrecarga requer um DROP separado com sua própria assinatura.
