# Sessão 15 — Rollback para pricing-ai v24 (reconstruída)

- **Pedido do Marcelo**: Reverter pricing-ai para v24 (versão mais simples)
- **Problema**: v24 e v25 originais nunca foram commitadas no git (apenas stubs). Supabase só guarda versão atual
- **Solução**: Reconstrução completa da v24 baseada na documentação do stub e formato do frontend
- **Diferenças v24r vs v31**:
  - **Removido**: City-strict filtering, tier system complexo, metro area detection, tx type sanity filter
  - **Removido**: cityMatch(), isMetroArea(), normalizeTransaction(), filterByTransactionType()
  - **Adicionado**: OpenAI GPT-4o-mini para AI analysis (v31 usava análise local)
  - **Simplificado**: Stats calculation (filtro área ±70%, top 15 por proximidade, sem tiers geográficos)
  - **Simplificado**: Property resolution (3 strategies vs 4)
  - **Mantido**: Auto-persist em pricing_analyses, formato de response compatível com frontend
- **Deploy**: v24r deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 33)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~430 linhas — redução de ~580 linhas vs v31)
