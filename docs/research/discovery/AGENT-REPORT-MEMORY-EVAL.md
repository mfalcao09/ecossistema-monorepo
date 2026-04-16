# Agent Report — Memory + Evaluation (knowledge-based com caveats)

> Baseado em training data (cutoff Jan 2025). Números verificados via `gh` estão em TOP-REPOS-DESCOBERTOS.md

Both web search tools are denied. I cannot perform live web searches in this session.

However, I have extensive knowledge of the GitHub ecosystem for agent memory and evaluation frameworks from my training data (cutoff Jan 2025). Let me provide the structured markdown report based on that knowledge. I'll clearly flag that stats are approximate (as of late 2024/early 2025) rather than fetched live.

---

# GitHub Research: Agent Memory Systems & Evaluation Frameworks

**Research mode note:** Live WebSearch was denied in this session. Report compiled from model knowledge (cutoff Jan 2025). Star counts and "last update" are approximate â verify before committing. Rating legend: green = strong fit, yellow = partial fit / caveats, red = avoid or very niche.

---

## 1. Agent Memory Frameworks

### mem0ai/mem0
- **URL:** https://github.com/mem0ai/mem0
- **Stars / update:** ~27k+ / very active
- **What:** Self-improving memory layer for LLM agents â extracts, stores, and retrieves user-level facts with vector + graph hybrid.
- **Deploy:** Both â OSS (Apache 2.0) self-host, plus managed `mem0.ai` platform.
- **Relevance:** Memory (primary). Drop-in solution for cross-session persistence, which is the ECOSYSTEM dealbreaker.
- **Rating:** green â strongest "batteries-included" memory SDK in the Python/Node ecosystem; integrates natively with pgvector/Supabase.

### letta-ai/letta (formerly MemGPT)
- **URL:** https://github.com/letta-ai/letta
- **Stars / update:** ~15k+ / active
- **What:** Stateful agent server implementing the MemGPT paper â hierarchical memory (core + archival) with OS-like paging between context window and external store.
- **Deploy:** Self-hosted server (Docker) + optional Letta Cloud.
- **Relevance:** Memory (primary). Best academic-grounded approach for long-context agents.
- **Rating:** green â heavier than mem0 but gives you a full agent runtime, not just a memory SDK.

### getzep/zep
- **URL:** https://github.com/getzep/zep
- **Stars / update:** ~3k+ (OSS) / active; new `graphiti` variant has ~10k+
- **What:** Long-term memory store for conversational agents with temporal knowledge graph ("Graphiti") and fact extraction.
- **Deploy:** Self-hosted (Go) OSS; Zep Cloud SaaS.
- **Relevance:** Memory (primary). Temporal facts ("X was true until date Y") fit your dated-memory model.
- **Rating:** green â strongest temporal/graph story; worth evaluating alongside mem0.

### getzep/graphiti
- **URL:** https://github.com/getzep/graphiti
- **Stars / update:** ~10k+ / very active
- **What:** Temporal knowledge-graph framework for agents â bi-temporal edges, Neo4j-backed.
- **Deploy:** Self-hosted library; requires Neo4j or FalkorDB.
- **Relevance:** Memory (semantic/episodic hybrid). Strong for "what did Marcelo decide and when" queries.
- **Rating:** green â best-in-class if you care about temporality (Jarvis dealbreaker fits).

### MemTensor/MemOS
- **URL:** https://github.com/MemTensor/MemOS
- **Stars / update:** ~1â2k / active (2024â2025)
- **What:** "Memory OS" treating memory as a first-class resource (plaintext / activation / parametric tiers).
- **Deploy:** Self-hosted Python.
- **Relevance:** Memory, more experimental.
- **Rating:** yellow â promising research, less production-tested.

### cpacker/MemGPT (original)
- **URL:** https://github.com/cpacker/MemGPT
- **Status:** Now redirects to Letta â keep as reference.
- **Rating:** yellow â use Letta fork instead.

### kingjulio8238/Memary
- **URL:** https://github.com/kingjulio8238/Memary
- **Stars / update:** ~1.5k / moderate
- **What:** Knowledge-graph memory for autonomous agents; Neo4j + LlamaIndex.
- **Deploy:** Self-hosted.
- **Relevance:** Memory (semantic graph).
- **Rating:** yellow â lighter adoption than Zep/Graphiti.

---

## 2. Episodic / Semantic Memory

### princeton-nlp/SWE-agent (and related research forks)
- **URL:** https://github.com/princeton-nlp/SWE-agent
- **Relevance:** Not a memory system per se, but implements scratchpad/trajectory episodic memory patterns worth copying.
- **Rating:** yellow â reference implementation only.

### OSU-NLP-Group/HippoRAG
- **URL:** https://github.com/OSU-NLP-Group/HippoRAG
- **Stars / update:** ~2k / active
- **What:** Neurobiologically-inspired long-term memory (Personalized PageRank over a knowledge graph) â mimics hippocampal indexing.
- **Deploy:** Self-hosted Python.
- **Relevance:** Memory (episodic/semantic, research-grade).
- **Rating:** green â strong retrieval quality on multi-hop queries; worth prototyping for Jarvis.

### caleb-zheng/EM-LLM (Episodic Memory LLM)
- **URL:** https://github.com/em-llm/EM-LLM-model
- **Stars / update:** ~500â1k / moderate
- **What:** Event-segmented episodic memory over long contexts (ICLR 2025 paper).
- **Deploy:** Research code, self-hosted.
- **Rating:** yellow â research prototype.

---

## 3. Vector DB / pgvector

### pgvector/pgvector
- **URL:** https://github.com/pgvector/pgvector
- **Stars / update:** ~12k+ / very active
- **What:** Open-source vector similarity extension for Postgres (ivfflat + HNSW).
- **Deploy:** Self-hosted extension; native to Supabase/Railway Postgres.
- **Relevance:** Core dependency for mem0 / Zep / custom memory.
- **Rating:** green â canonical choice given your Supabase-on-Railway stack.

### neondatabase-labs/pgvector-python / supabase/vecs
- **URL:** https://github.com/supabase/vecs
- **Stars / update:** ~700 / active
- **What:** Python client for pgvector on Supabase with collection abstraction, filters, metadata.
- **Deploy:** Self-hosted lib against Supabase/Postgres.
- **Rating:** green â matches your Supabase-compartilhado decision.

### pgvector/pgvector-python
- **URL:** https://github.com/pgvector/pgvector-python
- **Relevance:** SQLAlchemy/psycopg integration.
- **Rating:** green â essential wiring.

### paradedb/paradedb
- **URL:** https://github.com/paradedb/paradedb
- **Stars / update:** ~7k+ / active
- **What:** Postgres extension for hybrid search (BM25 via `pg_search` + pgvector).
- **Deploy:** Self-hosted Postgres extension.
- **Relevance:** Hybrid search â critical for RAG quality.
- **Rating:** green â pairs well with pgvector for hybrid retrieval.

### neuml/txtai
- **URL:** https://github.com/neuml/txtai
- **Stars / update:** ~9k+ / active
- **What:** All-in-one embeddings DB (vector + SQL + graph) for semantic search and LLM workflows.
- **Deploy:** Self-hosted Python.
- **Relevance:** Alternative if you don't want Postgres-only.
- **Rating:** yellow â duplicates what pgvector gives you.

---

## 4. Agent Observability

### langfuse/langfuse
- **URL:** https://github.com/langfuse/langfuse
- **Stars / update:** ~8k+ / very active
- **What:** Open-source LLM engineering platform â tracing, evals, prompts, datasets, analytics.
- **Deploy:** Self-hosted (Docker/K8s) + Langfuse Cloud SaaS. MIT-licensed.
- **Relevance:** Observability (primary). Drop-in LangSmith alternative.
- **Rating:** green â strongest all-in-one OSS option; integrates with OpenAI, Anthropic, LiteLLM, LangChain, LlamaIndex.

### Arize-ai/phoenix
- **URL:** https://github.com/Arize-ai/phoenix
- **Stars / update:** ~4k+ / very active
- **What:** OSS tracing + evaluation for LLM/RAG apps; OpenTelemetry-native via OpenInference.
- **Deploy:** Self-hosted Docker; Arize SaaS available.
- **Relevance:** Observability (primary). OTel-first â fits Railway/standard infra.
- **Rating:** green â pick this if you want OTel-standard traces; pick Langfuse if you want prompt management built-in.

### Helicone/helicone
- **URL:** https://github.com/Helicone/helicone
- **Stars / update:** ~3k+ / active
- **What:** Proxy-based LLM observability (one-line integration); cost, latency, caching.
- **Deploy:** Self-hosted + Helicone Cloud.
- **Relevance:** Observability + cost tracking.
- **Rating:** green â lightest-touch integration; good for quick wins on cost visibility.

### traceloop/openllmetry
- **URL:** https://github.com/traceloop/openllmetry
- **Stars / update:** ~5k+ / active
- **What:** OpenTelemetry SDK for LLM apps â vendor-neutral instrumentation exportable to any OTel backend.
- **Deploy:** SDK only; ship to Langfuse/Phoenix/Grafana/Datadog.
- **Relevance:** Observability (instrumentation layer).
- **Rating:** green â emits to any backend; future-proofs the stack.

### langchain-ai/langsmith-sdk
- **URL:** https://github.com/langchain-ai/langsmith-sdk
- **Deploy:** SaaS-only (no OSS server).
- **Rating:** red â not self-hostable, conflicts with data-sovereignty if ECOSYSTEM needs on-prem.

### openlit/openlit
- **URL:** https://github.com/openlit/openlit
- **Stars / update:** ~1.5k / active
- **What:** OTel-native observability for GenAI + vector DBs + GPUs.
- **Deploy:** Self-hosted (ClickHouse-backed).
- **Rating:** yellow â strong alternative to Phoenix; newer, smaller community.

### lunary-ai/lunary
- **URL:** https://github.com/lunary-ai/lunary
- **Stars / update:** ~1.5k / active
- **What:** Observability + prompt management + evals for LLM apps.
- **Deploy:** Self-hosted + SaaS.
- **Rating:** yellow â smaller than Langfuse but feature-competitive.

---

## 5. Agent Evaluation

### promptfoo/promptfoo
- **URL:** https://github.com/promptfoo/promptfoo
- **Stars / update:** ~5k+ / very active
- **What:** CLI + library for testing/evaluating LLM prompts & agents; red-teaming; CI-friendly.
- **Deploy:** Self-hosted CLI; OSS.
- **Relevance:** Eval (primary). YAML-driven, Git-native.
- **Rating:** green â best developer-ergonomic eval harness; plugs into CI easily.

### confident-ai/deepeval
- **URL:** https://github.com/confident-ai/deepeval
- **Stars / update:** ~4k+ / very active
- **What:** Pytest-style LLM eval framework â G-Eval, RAGAS metrics, hallucination, bias, toxicity.
- **Deploy:** Self-hosted library; optional Confident AI SaaS.
- **Relevance:** Eval (primary).
- **Rating:** green â idiomatic for teams already using pytest.

### UKGovernmentBEIS/inspect_ai
- **URL:** https://github.com/UKGovernmentBEIS/inspect_ai
- **Stars / update:** ~900+ / very active
- **What:** UK AI Safety Institute's eval framework â used for frontier-model safety evals; async, scorers, tool-use support.
- **Deploy:** Self-hosted Python.
- **Relevance:** Eval (agentic tasks, safety).
- **Rating:** green â strong for agent benchmarks (tool use, multi-turn); growing industry adoption.

### openai/evals
- **URL:** https://github.com/openai/evals
- **Stars / update:** ~15k / low activity recently
- **Rating:** yellow â foundational but aging; community has moved to inspect_ai / deepeval.

### EleutherAI/lm-evaluation-harness
- **URL:** https://github.com/EleutherAI/lm-evaluation-harness
- **Relevance:** Model eval (not agent) â academic benchmarks.
- **Rating:** yellow â more for model selection than app eval.

---

## 6. RAG Evaluation

### explodinggradients/ragas
- **URL:** https://github.com/explodinggradients/ragas
- **Stars / update:** ~7k+ / very active
- **What:** Reference-free RAG evaluation â faithfulness, answer relevancy, context precision/recall.
- **Deploy:** Self-hosted library.
- **Relevance:** RAG eval (primary).
- **Rating:** green â de-facto standard; integrates with Langfuse/Phoenix.

### truera/trulens
- **URL:** https://github.com/truera/trulens
- **Stars / update:** ~2k+ / active
- **What:** RAG eval + tracing with "feedback functions" (groundedness, relevance).
- **Deploy:** Self-hosted.
- **Rating:** yellow â overlaps with Ragas + Phoenix.

### beir-cellar/beir
- **URL:** https://github.com/beir-cellar/beir
- **Relevance:** Retrieval benchmarks (BEIR).
- **Rating:** yellow â academic retrieval only.

---

## 7. Prompt Management

### langfuse/langfuse
- See Â§4 â includes strong prompt versioning.
- **Rating:** green â prefer this over standalone tools if already using Langfuse.

### agenta-ai/agenta
- **URL:** https://github.com/agenta-ai/agenta
- **Stars / update:** ~2k+ / active
- **What:** OSS prompt engineering/versioning + eval playground.
- **Deploy:** Self-hosted + SaaS.
- **Rating:** green â Humanloop-style alternative, fully OSS.

### promptlayer/PromptLayer
- **URL:** https://github.com/MagnivOrg/promptlayer-python (client)
- **Deploy:** SaaS-only server.
- **Rating:** red â not self-hostable.

### PromptTools (hegelai/prompttools)
- **URL:** https://github.com/hegelai/prompttools
- **Stars:** ~2.7k / low activity
- **Rating:** yellow â mostly superseded by promptfoo.

---

## 8. Production Monitoring / Cost Tracking

### BerriAI/litellm
- **URL:** https://github.com/BerriAI/litellm
- **Stars / update:** ~15k+ / very active
- **What:** Universal LLM gateway â unifies 100+ providers; cost tracking, budgets, rate limits, virtual keys.
- **Deploy:** Self-hosted proxy (Python + Postgres) + SaaS.
- **Relevance:** Cost + observability + routing (primary).
- **Rating:** green â near-mandatory for multi-model ECOSYSTEM; logs to Langfuse/Helicone/Phoenix natively.

### Portkey-AI/gateway
- **URL:** https://github.com/Portkey-AI/gateway
- **Stars / update:** ~7k+ / active
- **What:** Fast AI gateway (TypeScript) â routing, fallbacks, caching, guardrails.
- **Deploy:** Self-hosted + SaaS.
- **Rating:** green â lighter alternative to LiteLLM; strong if you're TS-first.

### agentops-ai/agentops
- **URL:** https://github.com/AgentOps-AI/agentops
- **Stars / update:** ~3k+ / active
- **What:** Session-level agent observability â replay, cost, errors, benchmarks.
- **Deploy:** SDK + SaaS (OSS client).
- **Rating:** yellow â strong agent-specific features but server is SaaS-only.

---

## 9. Conversation Analytics / Context Management

### msoedov/langcorn (reference only) â skip

### microsoft/autogen (memory module)
- **URL:** https://github.com/microsoft/autogen
- **Relevance:** Agent framework with conversation memory primitives.
- **Rating:** yellow â framework, not a memory product.

### anthropics/anthropic-cookbook
- **URL:** https://github.com/anthropics/anthropic-cookbook
- **Relevance:** Reference patterns for context compression / summarization.
- **Rating:** yellow â recipes only.

### run-llama/llama_index (memory + context)
- **URL:** https://github.com/run-llama/llama_index
- **Stars:** ~35k / very active
- **What:** Data framework for LLMs â includes `ChatMemoryBuffer`, `VectorMemory`, composable memory, workflows.
- **Deploy:** Self-hosted library.
- **Relevance:** Memory + RAG building blocks.
- **Rating:** green â use as glue between pgvector, mem0/Zep, and your agents.

### langchain-ai/langchain (memory modules)
- **URL:** https://github.com/langchain-ai/langchain
- **Stars:** ~90k+ / very active
- **Relevance:** Historical memory abstractions (now mostly deprecated in favor of LangGraph `Checkpointer`).
- **Rating:** yellow â use LangGraph checkpointers (Postgres) if you adopt LangChain.

### langchain-ai/langgraph
- **URL:** https://github.com/langchain-ai/langgraph
- **What:** Stateful graph runtime with Postgres/Redis checkpointing â durable conversation state.
- **Rating:** green â Postgres checkpointer aligns perfectly with your Supabase decision.

---

## 10. Context Window Compression

### FasterDecoding/SnapKV, microsoft/LLMLingua
- **URL:** https://github.com/microsoft/LLMLingua
- **Stars:** ~4k+ / active
- **What:** Prompt compression (up to 20x) preserving task performance.
- **Deploy:** Self-hosted library.
- **Rating:** green â real cost lever for long Jarvis conversations.

### cornelk/llm-compressor â skip (niche).

---

## Headline Recommendations for the ECOSYSTEM stack

Based on the "Managed Agents + Railway, Supabase compartilhado, monorepo, Jarvis-4-estÃ¡gios" decisions:

1. **Memory layer (dealbreaker):** `mem0` as SDK + `pgvector` on Supabase as backend. Add `graphiti` (Zep) later if temporal queries become central to Jarvis.
2. **Observability:** `langfuse` self-hosted on Railway (Postgres + ClickHouse) as the single pane â it covers tracing, prompts, and evals. Instrument via `openllmetry` so you can switch backends later.
3. **Gateway + cost:** `litellm` proxy in front of all model calls, wired to Langfuse.
4. **Evaluation:** `promptfoo` in CI + `ragas` for RAG-specific scores + `inspect_ai` for agent-task benchmarks.
5. **Retrieval quality:** `paradedb` (BM25 + pgvector hybrid) on the same Supabase instance once vector-only recall plateaus.
6. **Agent runtime state:** `langgraph` Postgres checkpointer OR `letta` server (pick one â don't run both).

**Gaps not fillable by OSS today:**
- Conversation-quality analytics tied to business KPIs â you'll likely build this on top of Langfuse traces.
- Cross-session identity resolution (same user across channels) â mem0/Zep handle user_id but org-level entity resolution is custom.

**Caveat:** All stars/dates are from Jan-2025 training data. Re-run `gh repo view <repo> --json stargazerCount,pushedAt` before finalizing any ADR.

