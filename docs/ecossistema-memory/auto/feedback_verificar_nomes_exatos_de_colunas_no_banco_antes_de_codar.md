---
name: Verificar nomes exatos de colunas no banco antes de codar
description: Verificar nomes exatos de colunas no banco antes de codar
type: feedback
project: erp
tags: ["supabase", "colunas", "banco", "bugs"]
success_score: 0.9
supabase_id: 3154c99b-52fa-429b-8e18-9a055232302f
created_at: 2026-04-13 09:14:36.740071+00
updated_at: 2026-04-13 11:05:00.902269+00
---

Ao criar ou editar componentes que salvam dados no Supabase, SEMPRE verificar os nomes exatos das colunas no banco antes de usar no código. O Supabase ignora silenciosamente campos desconhecidos no update — não dá erro, simplesmente não salva. Exemplo: componente usava historico_timbrado_modelo_url mas banco tinha historico_arquivo_timbrado_url. O save parecia funcionar (200 OK) mas não salvava nada. Antes de criar campos em componentes React, rodar: SELECT column_name FROM information_schema.columns WHERE table_name = 'TABELA' ORDER BY ordinal_position;
