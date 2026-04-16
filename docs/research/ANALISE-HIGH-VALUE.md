# Análise Profunda — HIGH-VALUE

> Gerado por agente em 2026-04-15

Now I have enough information to compile the comprehensive report. Here it is:

---

## RESEARCH REPOS ANALYSIS REPORT -- Actionable Findings for Ecossistema AI

---

### 1. ai/ (Vercel AI SDK)

**What it ACTUALLY does:** A TypeScript SDK providing a unified, provider-agnostic interface for LLM interactions. The key abstraction is `LanguageModelV4` -- an interface that every provider (OpenAI, Anthropic, Google, etc.) implements. User-facing functions (`generateText`, `streamText`, `generateObject`, `streamObject`) consume any implementation of this interface interchangeably.

**Architecture patterns found:**

- **Provider Adapter Pattern (V4 spec):** Three-layer architecture: Specifications (`@ai-sdk/provider`) define interfaces, Utilities (`@ai-sdk/provider-utils`) provide shared code, Providers (`@ai-sdk/<provider>`) implement concretely. Core (`ai`) calls only the interface. This is the critical pattern for multi-model support.
- **ToolLoopAgent:** Located at `packages/ai/src/agent/tool-loop-agent.ts`. This is a loop-based agent that calls the LLM, executes tools if requested, then calls the LLM again with tool results. Loop terminates on: no tool calls, tool needs approval, or step count limit (default 20). This is the exact pattern Jarvis needs.
- **Tool Approval System:** Files like `is-approval-needed.ts`, `collect-tool-approvals.ts`, `tool-output-denied.ts` show a robust human-in-the-loop pattern where certain tool calls pause for user approval before execution.
- **Streaming-first architecture:** `streamText` and `stream-text-result.ts` show how to build real-time UIs. The `smooth-stream.ts` provides buffered streaming for better UX.
- **Agent UI Streaming:** `create-agent-ui-stream.ts` and `pipe-agent-ui-stream-to-response.ts` provide a pattern for streaming agent execution state to frontend clients.

**Concrete things to adopt:**

1. **Use AI SDK directly as the LLM abstraction layer.** Do NOT build custom provider wrappers. Use `@ai-sdk/anthropic` for Claude, `@ai-sdk/openai` for GPT, etc. All share the same `generateText`/`streamText` API.
2. **Adopt the ToolLoopAgent pattern** for Jarvis managed agents. Define tools as Zod-schema-validated functions, let the agent loop handle multi-step reasoning.
3. **Implement tool approval** for dangerous operations (database mutations, external API calls) using the `toolCallApproval` callback pattern.
4. **Use `generateObject` with Zod schemas** for structured data extraction from LLMs -- this is how to get reliable JSON from any model.

**Key files:**
- `/research-repos/ai/packages/ai/src/agent/tool-loop-agent.ts` -- Agent loop implementation
- `/research-repos/ai/packages/ai/src/agent/agent.ts` -- Agent type definitions with callbacks
- `/research-repos/ai/architecture/provider-abstraction.md` -- Full architecture diagram
- `/research-repos/ai/CLAUDE.md` -- Complete API surface and import patterns

---

### 2. firecrawl/ (Web Scraping for RAG)

**What it ACTUALLY does:** A monorepo containing an API server + workers that scrape web pages and convert them to structured data (Markdown, JSON, etc.). The core pipeline: URL -> engine selection (Playwright, fire-engine, or index cache) -> HTML fetch -> HTML-to-Markdown conversion (via a Go shared library loaded with `koffi`) -> post-processing -> LLM extraction (optional).

**Architecture patterns found:**

- **Engine Fallback Waterfall:** In `scraper/scrapeURL/index.ts`, there's a `buildFallbackList` function that creates an ordered list of scraping engines. If one fails, the system cascades to the next. Engines include cached index, fire-engine (headless browser), Playwright, and direct fetch.
- **Job Queue Architecture:** Uses Redis (`crawl-redis.ts`) for job queuing. Scrape jobs have three modes: `single_urls`, `kickoff` (crawl start), and `kickoff_sitemap`. Workers pull from queue and process asynchronously.
- **HTML-to-Markdown Pipeline:** The `html-to-markdown.ts` loads a compiled Go binary via FFI (koffi) for high-performance HTML conversion. Falls back to an HTTP service if configured. Then applies `postProcessMarkdown` from a Rust WASM module (`@mendable/firecrawl-rs`).
- **Cost Tracking:** `cost-tracking.ts` tracks per-request costs. Every scrape job carries billing metadata.
- **Retry with Tracker:** `ScrapeRetryTracker` manages retry state with exponential backoff and engine rotation.

**Concrete things to adopt:**

1. **Use Firecrawl as a service** (not self-hosted) for RAG data ingestion. Their JS SDK v2 at `apps/js-sdk/firecrawl/src/v2/` has methods for `scrape`, `crawl`, `extract`, `search`, `map`, and `agent`.
2. **Adopt the engine fallback pattern** for any unreliable external service integration. Define a priority list of strategies, try each, cascade on failure.
3. **For RAG pipelines:** Use their `extract` method with Zod schemas to pull structured data from web pages -- combine with AI SDK's `generateObject` for double-pass extraction.
4. **Redis job queue pattern** is directly applicable. Railway supports Redis. Use BullMQ for job processing with the same scrape-job-data structure.

**Key files:**
- `/research-repos/firecrawl/apps/api/src/scraper/scrapeURL/index.ts` -- Core scraping pipeline with fallback
- `/research-repos/firecrawl/apps/api/src/lib/html-to-markdown.ts` -- HTML conversion pipeline
- `/research-repos/firecrawl/apps/api/src/types.ts` -- Job type definitions
- `/research-repos/firecrawl/apps/js-sdk/firecrawl/src/v2/client.ts` -- SDK client for integration

---

### 3. supabase/ (Monorepo)

**What it ACTUALLY does:** This is the Supabase dashboard/Studio monorepo (NOT supabase-js client library). It is a Next.js (pages router) + Turborepo monorepo containing the Studio dashboard, docs site, and marketing site. The actual backend patterns are visible through their SQL migrations and `packages/ai-commands/`.

**Architecture patterns found:**

- **Monorepo Structure (pnpm + Turborepo):** Organized as `apps/studio`, `apps/docs`, `apps/www` with shared packages `packages/ui`, `packages/common`, `packages/shared-data`, `packages/ai-commands`.
- **Vector Similarity Search via SQL:** Their migrations at `supabase/migrations/20230128004504_embedding_similarity_search.sql` and `20250423133137_improve_vector_search.sql` show pgvector-based similarity search functions -- this is how to implement RAG with Supabase.
- **AI Commands Package:** `packages/ai-commands/` exports SQL helpers and error handling for AI-driven database operations. This is how they integrate AI into the dashboard.
- **Feature Flags + Telemetry:** `packages/common/configcat.ts` for feature flags, `packages/common/posthog-client.ts` for analytics -- production-grade observability pattern.

**Concrete things to adopt:**

1. **Use Supabase pgvector** for RAG embedding storage. Their SQL migration patterns show exactly how to create similarity search functions. Each business project gets its own Supabase project (per your DB-per-project architecture decision).
2. **Replicate their monorepo structure** with shared `packages/ui` for your component library across all 5 businesses.
3. **Adopt their telemetry pattern:** PostHog for analytics, ConfigCat for feature flags -- both have free tiers adequate for initial launch.
4. **Use Supabase Realtime** for live updates in Intentus and Klesis dashboards rather than polling.

**Key files:**
- `/research-repos/supabase/.claude/CLAUDE.md` -- Complete monorepo structure
- `/research-repos/supabase/supabase/migrations/` -- SQL patterns for vector search, RLS
- `/research-repos/supabase/packages/ai-commands/` -- AI integration patterns
- `/research-repos/supabase/packages/common/` -- Shared utilities pattern

---

### 4. DeepSeek-V3/

**What it ACTUALLY does:** Reference implementation for DeepSeek-V3, a 671B parameter Mixture-of-Experts (MoE) model where only 37B parameters are activated per token. The repo contains the inference code (model definition + generation script) and the technical paper. It is NOT something you deploy -- it is a research reference.

**Architecture patterns found:**

- **Mixture-of-Experts (MoE):** 64 routed experts + 2 shared experts, with 6 activated per token. The routing uses sigmoid/softmax scoring with `route_scale` factor. The `n_expert_groups` and `n_limited_groups` control expert selection diversity.
- **Multi-head Latent Attention (MLA):** Compressed KV cache using LoRA-style projections. `kv_lora_rank=512` compresses the full KV representation, with separate dimensions for positional (`qk_rope_head_dim=64`) and non-positional (`qk_nope_head_dim=128`) components.
- **FP8 Training:** First to validate FP8 mixed-precision training at 671B scale. The `fp8_cast_bf16.py` script handles format conversion.
- **Multi-Token Prediction (MTP):** Trained to predict multiple next tokens simultaneously, which also enables speculative decoding for faster inference.
- **Knowledge Distillation from R1:** Post-training distills reasoning capabilities from a Chain-of-Thought model (DeepSeek-R1) into the standard model, improving reasoning without the long CoT output.

**Concrete things to adopt:**

1. **MoE routing concept for agent dispatch:** The expert selection pattern (score -> top-k -> route) maps directly to how Jarvis should route tasks to specialized agents. Score each agent's relevance to a query, activate top-k agents.
2. **Speculative decoding concept for agent pre-computation:** Start multiple likely agent paths in parallel, commit to the one that succeeds -- reduces perceived latency.
3. **Use DeepSeek-V3 via API** as a cost-effective alternative model for non-critical tasks (it benchmarks close to GPT-4o at lower cost). Access through AI SDK's provider system.

**Key files:**
- `/research-repos/DeepSeek-V3/README.md` -- Full architecture description and benchmarks
- `/research-repos/DeepSeek-V3/inference/model.py` -- MoE routing, MLA, expert architecture
- `/research-repos/DeepSeek-V3/inference/generate.py` -- Token generation with temperature sampling

---

### 5. open-webui/

**What it ACTUALLY does:** A FastAPI-based backend that provides a unified chat interface for multiple LLM providers (Ollama, OpenAI-compatible APIs). It handles multi-model orchestration, user memory (vector-backed), tool execution, knowledge bases, and real-time communication via WebSockets.

**Architecture patterns found:**

- **Plugin/Function System:** In `functions.py`, functions are loaded dynamically by ID from database, with a `Valves` (configuration) and `UserValves` (per-user config) pattern. Functions of type `pipe` act as custom model endpoints. Functions of type `filter` modify messages before/after LLM calls.
- **Memory System with Vector Search:** `routers/memories.py` shows: user adds memory -> content gets embedded via `EMBEDDING_FUNCTION` -> stored in vector DB collection `user-memory-{user_id}` -> retrieved via similarity search during conversations. Per-user vector collections.
- **Tool Registry Pattern:** `routers/tools.py` loads tool modules from cache, each tool has a spec (JSON schema), valves (configuration), and execute function. Tools are access-controlled per user/group.
- **Multi-provider Routing:** Separate routers for `ollama` and `openai` providers, with a unified `models` router that aggregates available models from all providers. The `MODELS` dict in socket module tracks available models.
- **WebSocket Real-time:** `socket/main.py` handles real-time communication, model usage tracking, and session management.

**Concrete things to adopt:**

1. **Adopt the Valves pattern** for agent configuration: each agent/tool has a typed configuration class (`Valves`) that can be set globally and overridden per-user (`UserValves`). Store in Supabase.
2. **Per-user vector memory collections** -- exactly what Jarvis needs. Each user gets `user-memory-{user_id}` collection. Use Supabase pgvector instead of separate vector DB.
3. **Dynamic function loading from database** -- store agent definitions in Supabase, load dynamically. This enables hot-reloading agents without redeployment.
4. **The filter/pipe function type pattern** maps to Jarvis stages: `filter` functions are pre/post-processors, `pipe` functions are actual LLM routers.

**Key files:**
- `/research-repos/open-webui/backend/open_webui/functions.py` -- Dynamic function loading, pipe/filter pattern
- `/research-repos/open-webui/backend/open_webui/routers/memories.py` -- Vector-backed user memory
- `/research-repos/open-webui/backend/open_webui/routers/tools.py` -- Tool registry with access control
- `/research-repos/open-webui/backend/open_webui/main.py` -- Full app wiring with all routers

---

### 6. system-design-primer/

**What it ACTUALLY does:** A comprehensive catalog of system design patterns, not a codebase. It covers the full spectrum: scalability, availability, consistency, caching, asynchronism, database partitioning, load balancing, and microservices.

**Patterns directly applicable to the multi-business ecosystem:**

1. **CAP Theorem / AP vs CP:** For your 5-business ecosystem, choose AP (Availability + Partition Tolerance) with eventual consistency. Supabase with Realtime subscriptions gives you this. Accept that cross-business data may be seconds stale.

2. **Cache-aside pattern:** For Jarvis: check Redis cache first, then query LLM, then store result. Critical for reducing API costs on repeated queries.

3. **Message queues + Task queues:** Use Redis (BullMQ) for async agent execution. Long-running agent tasks go to queue, results pushed via Supabase Realtime. This is how Railway workers should consume tasks.

4. **Back pressure:** When agent queue fills up, push back on clients rather than dropping requests. Implement with queue depth monitoring.

5. **Federation (database):** Each business gets its own Supabase project (your existing decision). Cross-business queries go through a shared ECOSYSTEM schema. This is federation.

6. **Reverse proxy pattern:** Vercel serves as the reverse proxy + CDN + edge for all frontends. Railway services behind it handle compute.

7. **Microservices + Service Discovery:** Each managed agent is a microservice. Use Supabase as the service registry (store agent metadata, endpoints, capabilities).

8. **Horizontal scaling:** Stateless agent workers on Railway can scale horizontally. State lives in Supabase + Redis.

**Key files:**
- `/research-repos/system-design-primer/README.md` -- Full pattern catalog with trade-off analysis

---

### 7. gemini-cli/

**What it ACTUALLY does:** Google's terminal-based AI agent, structured as a monorepo with `packages/core` (backend logic, API orchestration, tool execution), `packages/cli` (terminal UI via Ink/React), `packages/sdk` (programmatic embedding), and `packages/a2a-server` (agent-to-agent protocol).

**Architecture patterns found:**

- **Hierarchical Memory System:** In `config/memory.ts`, memory has four levels: `global` (user-wide), `extension` (from extensions), `project` (per-project GEMINI.md), and `userProjectMemory` (user-specific per-project). Flattened into a single string for the system prompt. This is exactly the memory hierarchy Jarvis needs.
- **Tool Registry with Declarative Tools:** `tools/tool-registry.ts` has `BaseDeclarativeTool` and `BaseToolInvocation` classes. Tools declare their schema via `FunctionDeclaration`, validate params, then execute. The `DiscoveredToolInvocation` wraps external tools (from extensions) in a sandboxed execution environment.
- **Agent Event System:** `core/turn.ts` defines `GeminiEventType` enum with events like `Content`, `ToolCallRequest`, `ToolCallResponse`, `ToolCallConfirmation`, `Thought`, `ContextWindowWillOverflow`, `LoopDetected`. This event-driven architecture decouples execution from UI.
- **Session Management with Resume:** `sdk/src/agent.ts` shows `GeminiCliAgent` creates sessions with unique IDs, and can `resumeSession` by loading conversation history from disk. Sessions are stored as JSON conversation records.
- **Policy Engine:** `policy/policy-engine.ts` with TOML-based policy files controlling what tools can do. `ApprovalMode` with `YOLO_ALLOW_ALL` option.
- **Agent-to-Agent (A2A):** The `packages/a2a-server` implements Google's Agent-to-Agent protocol for inter-agent communication.
- **Scheduler + Tool Executor:** `scheduler/scheduler.ts` and `scheduler/tool-executor.ts` manage tool execution ordering and parallelism.
- **Subagent Architecture:** `agents/types.ts` defines agent termination modes (ERROR, TIMEOUT, GOAL, MAX_TURNS, ABORTED), default max 30 turns, 10-minute timeout. `agents/agentLoader.ts` and `agents/local-executor.ts` handle spawning sub-agents.

**Concrete things to adopt:**

1. **Adopt the 4-level memory hierarchy** for Jarvis: Global (cross-business), Extension (per-integration), Project (per-business), User-Project (per-user-per-business). Store in Supabase with RLS.
2. **Implement the event-driven agent execution pattern:** Define your own event enum (Content, ToolCall, Approval, Error, Finished). Stream events via Supabase Realtime to frontend.
3. **Session resumability** -- store conversation records in Supabase, enable users to resume agent sessions. Critical for long-running real estate analysis tasks.
4. **The policy engine concept** -- TOML-based rules controlling what each agent can do. Store in Supabase, evaluate at runtime. Prevents agent misuse.
5. **Subagent pattern with timeouts** -- each sub-agent gets max turns (30) and max time (10 min). If it exceeds, terminate gracefully and report.

**Key files:**
- `/research-repos/gemini-cli/packages/core/src/index.ts` -- Full module export map (296 lines of architecture)
- `/research-repos/gemini-cli/packages/core/src/config/memory.ts` -- Hierarchical memory system
- `/research-repos/gemini-cli/packages/core/src/tools/tools.ts` -- Tool invocation contract
- `/research-repos/gemini-cli/packages/core/src/core/turn.ts` -- Agent event system
- `/research-repos/gemini-cli/packages/core/src/agents/types.ts` -- Subagent architecture
- `/research-repos/gemini-cli/packages/sdk/src/agent.ts` -- Session management with resume

---

## SYNTHESIS: Architecture Blueprint for Ecossistema

Based on all 7 repos, here is the concrete architecture to implement:

### Layer 1: LLM Abstraction
Use **Vercel AI SDK** directly. `ToolLoopAgent` is your agent primitive. Define tools with Zod schemas. Use `generateObject` for structured extraction.

### Layer 2: Agent Execution
Adopt **Gemini CLI's event-driven model**: agents emit typed events (Content, ToolCallRequest, ToolCallResponse, Error, Finished). Stream events to frontend via **Supabase Realtime**. Each agent has max turns (30) and max time (10 min) with graceful termination.

### Layer 3: Memory
**4-level hierarchy** from Gemini CLI: Global > Extension > Project > User-Project. Store in **Supabase pgvector** with per-user collections (from Open WebUI pattern). Enable session resume by persisting conversation records.

### Layer 4: Tool System
Combine AI SDK's tool definition (Zod schema + execute function) with Open WebUI's **Valves pattern** (typed configuration per tool). Tools stored in Supabase, loaded dynamically. Access-controlled per user/group.

### Layer 5: Data Ingestion
Use **Firecrawl** for web scraping/RAG. Adopt their **engine fallback waterfall** for any unreliable service integration. Job queue via **Redis on Railway** with BullMQ.

### Layer 6: Infrastructure
- **Vercel**: All Next.js frontends (5 businesses)
- **Railway**: Stateless agent workers, Redis, background jobs
- **Supabase**: Per-project databases, auth, realtime, vector search, agent state
- Pattern from system-design-primer: **AP with eventual consistency**, **cache-aside**, **message queues with back-pressure**

### Layer 7: Agent Routing (from DeepSeek MoE)
Score each specialized agent's relevance to incoming query (like MoE expert selection). Activate top-k agents. Merge results. This is how Jarvis dispatches across business domains.

The analysis is complete. Here is a summary of the most critical, immediately-actionable findings:

**Highest-priority adoptions for your Anthropic Managed Agents + Supabase + Railway + Vercel stack:**

1. **Vercel AI SDK's `ToolLoopAgent`** is the exact agent primitive you need. It handles the LLM-calls-tool-calls-LLM loop, tool approval, and step counting out of the box. Do not build a custom agent loop.

2. **Gemini CLI's 4-level hierarchical memory** (Global / Extension / Project / User-Project) mapped to Supabase with RLS is the memory architecture for Jarvis. Combined with Open WebUI's per-user vector collections stored via pgvector.

3. **Firecrawl's engine fallback waterfall** should be the standard pattern for any external service call in your ecosystem -- not just scraping. Define a priority list of strategies, try each, cascade on failure with tracking.

4. **Open WebUI's Valves pattern** for tool/agent configuration solves the "how do we configure agents per business" problem. Each tool has a typed `Valves` class (global config) and `UserValves` class (per-user overrides), stored in Supabase.

5. **DeepSeek's MoE routing concept** translates directly to Jarvis agent dispatch: score each specialist agent against the query, activate top-k, merge results. This replaces a naive if/else routing tree.

6. **System Design Primer patterns** to enforce: AP consistency (not CP), cache-aside with Redis, message queues with back-pressure for agent jobs, federation for cross-business database access.

