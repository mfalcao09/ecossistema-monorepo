# ADR-001 — RAG nos Agentes do ERP

| Campo | Valor |
|---|---|
| **Data** | 2026-04-13 |
| **Status** | ✅ Aceita (confirmada por Marcelo) |
| **Decisores** | Marcelo Silva + Claude (Claudinho) |
| **Caminho escolhido** | **A → C** (pular Fase B da memória Ecossistema; focar em levar RAG aos agentes do ERP) |
| **Supersede** | N/A |
| **Relacionada com** | `project_plano_skills_rag_aprovado.md` (05/04/2026) |

---

## Contexto

Até 13/04/2026 o Ecossistema de IA tinha 3 planos convivendo, cada um com sua própria nomenclatura de fases, o que causou confusão na interpretação do pedido "avançar de A para C":

| Plano | Nomenclatura | Situação em 13/04 |
|---|---|---|
| Skills + RAG no ERP | Fase 1 / 2 / 3 / 4 | Fase 1 ✅ (3 agentes em produção). Fase 2 (Skills Fixas) pendente. Fase 3 (RAG) pendente. |
| Memória do Ecossistema | Fase A / B | Fase A (dual-write) ativa. Fase B (Supabase primário) exige embeddings ≥ 80% — em 13/04 estava em 52.6%. |
| Caminho pragmático (deste ADR) | A / C | A = estado atual. C = RAG ativo nos agentes do ERP. |

A RAG Engine (Python, Railway, `gemini-embedding-001` @ 768 dims) já está validada como prova de conceito no Ecossistema, embedando memórias em ciclos horários.

## Decisão

Pular a virada de chave da memória do Ecossistema (que continua em dual-write, Fase A) e implementar a stack RAG direto nos 3 agentes do ERP (aluno / professor / colaborador), reaproveitando a infraestrutura e o modelo de embeddings já validados.

### As 5 sub-decisões (confirmadas por Marcelo em 13/04/2026)

| # | Decisão | Opção escolhida | Racional |
|---|---|---|---|
| 1 | **Escopo inicial do RAG** | `1d` — começar só com skills dos agentes, expandir para docs em sprint futura | Entrega incremental, baixo risco LGPD no MVP |
| 2 | **Onde roda o embedder do ERP** | `2b` — novo service Railway dedicado ao ERP | Isolamento de ciclos; reusa o código Python já testado |
| 3 | **Modelo de embedding** | `3a` — `gemini-embedding-001` @ 768 dims | Consistência com o Ecossistema; validado em produção |
| 4 | **Estratégia de busca** | `4b` — híbrida 70% semântica + 30% keyword (tsvector) | Pega nomes próprios e códigos de disciplina que embedding erra |
| 5 | **Integração nos agentes** | `5b` — tool call (`buscar_skills`) decidido pelo agente | Padrão moderno; Gemini 2.5 Flash suporta tool use |

## Alternativas consideradas

Cada sub-decisão teve 3–4 alternativas analisadas em conversa com Marcelo (ver conversa de 13/04/2026). Registro resumido:

- **Escopo**: 1a (só skills) / 1b (skills + docs) / 1c (skills + docs + código) / **1d (fases)**
- **Embedder**: 2a (reaproveitar single service) / **2b (service dedicado)** / 2c (Edge Function) / 2d (Next.js + Vercel Cron)
- **Modelo**: **3a (Gemini 768)** / 3b (Gemini 3072 nativo) / 3c (OpenAI text-embedding-3-small 1536)
- **Busca**: 4a (só semântica) / **4b (híbrida 70/30)** / 4c (híbrida + rerank LLM)
- **Integração**: 5a (pre-retrieval sempre) / **5b (tool call)** / 5c (orchestration classifica)

## Consequências

### Positivas
- Reaproveita stack validada (Python + Railway + Gemini 768d + Supabase vector)
- Entrega incremental reduz risco (só skills primeiro)
- Tool call deixa o agente decidir quando precisa — economia de tokens
- Busca híbrida evita falhas clássicas de embedding com nomes próprios/códigos

### Negativas / trade-offs aceitos
- 2 services Railway para manter (ECOSYSTEM + ERP) em vez de 1 consolidado
- Custo Gemini Embedding API escala com volume de skills + documentos futuros
- Fase B (Supabase ECOSYSTEM como primário) fica adiada indefinidamente — arquivos locais continuam fonte de verdade para memória
- Necessidade de reindexação sempre que skills forem editadas

## Plano de execução

Ver masterplan detalhado em `memory/masterplans/rag-agentes-erp.md`.

## Referências

- Plano original Skills+RAG: `../.auto-memory/project_plano_skills_rag_aprovado.md`
- Scheduled task de monitoramento: `schedule` do Ecossistema — RAG ENGINE READINESS CHECK
- RAG Engine (prova de conceito): `/Users/marcelosilva/Projects/GitHub/Ecossistema/rag-engine/`
- Supabase ERP: `bvryaopfjiyxjgsuhjsb`
- Supabase ECOSYSTEM: `gqckbunsfjgerbuiyzvn`
