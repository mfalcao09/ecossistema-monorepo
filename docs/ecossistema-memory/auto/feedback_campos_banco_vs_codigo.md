---
name: Sempre verificar nomes de colunas no banco antes de usar no código
description: Nomes de campos no componente DEVEM coincidir exatamente com as colunas do banco Supabase — verificar com SQL antes de codar
type: feedback
---

Ao criar ou editar componentes que salvam dados no Supabase, SEMPRE verificar os nomes exatos das colunas no banco antes de usar no código. O Supabase ignora silenciosamente campos desconhecidos no update — não dá erro, simplesmente não salva.

**Why:** O componente AbaVisualHistorico usava `historico_timbrado_modelo_url` mas o banco tinha `historico_arquivo_timbrado_url`. Usava `historico_margem_baixo` mas o banco tinha `historico_margem_inferior`. O save parecia funcionar (200 OK) mas não salvava nada.

**How to apply:** Antes de criar campos em componentes React, rodar:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'TABELA' ORDER BY ordinal_position;
```
E usar os nomes exatos retornados.
