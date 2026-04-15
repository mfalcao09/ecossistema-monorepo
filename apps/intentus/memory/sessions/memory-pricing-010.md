# Sessão 10 — Multi-plataforma pricing-ai v26 → v27 (fix critical bugs)

- **v26 — Arquitetura multi-actor** (criada nesta sessão):
  - pricing-ai v25 só retornava dados do VivaReal (1 plataforma)
  - Causa: Actor Apify `f1xSvpkpklEh2EhGJ` ignorava parameter `sources`
  - Solução: 3 actors Apify em paralelo via `Promise.allSettled()`
  - Deploy v26: funcionou deploy, mas **retornava erro 404 em produção**
- **v27 — Fix de 4 bugs críticos**:
  - **BUG 1 (ROOT CAUSE)**: v26 consultava tabela `contracts` para obter `city, state, neighborhood, area` — mas essas colunas **não existem** na tabela `contracts`. Existem na tabela `properties`.
  - **BUG 2**: Usava `property_id` como ID na tabela `contracts` (errado — `property_id` é FK para `properties`)
  - **BUG 3**: Coluna `area` não existe em `properties` — o correto é `area_total` (com fallback para `area_built`)
  - **BUG 4**: Response format retornava chaves flat (`suggested_price`, `confidence`) mas o frontend `mapEdgeFunctionResponse()` espera objeto `stats` aninhado com chaves específicas (`stats.suggested_value`, `stats.confidence_score`, etc.)
  - **Solução v27**: Property resolution com 4 estratégias de fallback:
    1. Lookup direto na tabela `properties` por `property_id`
    2. `contracts` → `property_id` → `properties`
    3. `contract_renewals` → `contracts` → `properties`
    4. Body params (frontend já envia `neighborhood`, `city`)
  - Response format com `stats` object compatível com `mapEdgeFunctionResponse()`
  - AI analysis gerada localmente (sem GPT-4o-mini nesta versão — análise estatística pura)
- **Deploy**: v27 deployada via Supabase MCP (ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 27)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado com código v27 completo (731 linhas)
