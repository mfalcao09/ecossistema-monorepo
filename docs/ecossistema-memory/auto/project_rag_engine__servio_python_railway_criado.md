---
name: RAG Engine — Serviço Python Railway criado
description: RAG Engine — Serviço Python Railway criado
type: project
project: ecosystem
tags: ["rag-engine", "railway", "embeddings", "python"]
success_score: 0.85
supabase_id: dffdfe33-e07e-4ea1-84c8-6ccbfb945214
created_at: 2026-04-13 04:27:19.300336+00
updated_at: 2026-04-13 08:04:30.952123+00
---

Serviço Python criado em Ecossistema/rag-engine/ em 13/04/2026.

Arquivos:
- main.py — loop principal: busca memórias sem embedding, gera via Gemini text-embedding-004, salva no Supabase
- requirements.txt — apenas requests==2.31.0 (sem dependências pesadas)
- railway.json — config de deploy (NIXPACKS, restart ON_FAILURE)
- .env.example — template das variáveis de ambiente

Variáveis Railway necessárias:
- SUPABASE_URL = https://gqckbunsfjgerbuiyzvn.supabase.co
- SUPABASE_SERVICE_KEY = <service_role key do Supabase ECOSYSTEM>
- GEMINI_API_KEY = <mesma chave usada no ERP Railway>
- BATCH_SIZE = 10 (opcional)
- INTERVAL_SECONDS = 3600 (opcional, padrão 1h)

Como funciona: a cada INTERVAL_SECONDS, busca até BATCH_SIZE memórias com embedding=NULL, chama Gemini text-embedding-004, salva vector(768) no Supabase. Quando 100% das memórias tiverem embedding, a busca semântica fica totalmente ativa.

PRÓXIMO PASSO: Deploy no Railway — Marcelo precisa da service_role key do Supabase ECOSYSTEM e da GEMINI_API_KEY.
