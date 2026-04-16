# Análise Profunda — Grupo 1: V6 Core (RAG/Grafos/Agentes)

> Gerado por agente de pesquisa em 2026-04-15

Here is the complete analysis report:

---

# Research Repos Deep Analysis Report

## 1. LightRAG -- RAG with Knowledge Graphs

### Architecture

LightRAG is a **mature, production-grade RAG system** (~10k+ lines of core Python) that combines traditional vector retrieval with knowledge graph extraction. The architecture is layered:

- **Storage abstraction layer** (`base.py`): Abstract base classes for KV storage, vector storage, graph storage, and doc status storage. Each has 5-7 interchangeable implementations (Postgres, Neo4j, Milvus, Redis, MongoDB, Qdrant, Faiss, OpenSearch, etc.).
- **Entity/relation extraction pipeline** (`operate.py`, 5197 lines): Chunks documents, extracts entities and relations via LLM, builds a knowledge graph, then does map-reduce summarization of entity descriptions.
- **Multi-mode query engine** (`lightrag.py`, 4507 lines): Supports `local`, `global`, `hybrid`, `naive`, `mix`, and `bypass` retrieval modes -- combining KG traversal with vector similarity.
- **LLM abstraction** (`llm/`): Supports OpenAI, Anthropic, Azure, Bedrock, Gemini, Ollama, HuggingFace, Jina, etc.
- **REST API server** (`api/`): Full Gunicorn-based server with auth, config, runtime validation.
- **WebUI** (`lightrag_webui/`): Separate React-based frontend.

### Agent Patterns

LightRAG is **not an agent system** -- it has zero orchestration or delegation. It is a retrieval pipeline. However, the entity extraction uses structured LLM prompting with gleanings (re-extraction passes) and map-reduce summarization, which is an interesting pattern for iterative knowledge extraction.

### Key Files

- `/tmp/research-repos/LightRAG/lightrag/lightrag.py` -- Main orchestrator class, document ingestion and query dispatch
- `/tmp/research-repos/LightRAG/lightrag/operate.py` -- Core pipeline: chunking, entity extraction, KG query, naive query
- `/tmp/research-repos/LightRAG/lightrag/base.py` -- Abstract storage interfaces (BaseKVStorage, BaseVectorStorage, BaseGraphStorage)
- `/tmp/research-repos/LightRAG/lightrag/kg/__init__.py` -- Storage registry with all backend implementations mapped
- `/tmp/research-repos/LightRAG/lightrag/prompt.py` -- Detailed entity/relation extraction prompts with examples

### Applicable Insights for Your Ecosystem

**STEAL: Storage abstraction pattern.** LightRAG's `STORAGES` registry maps storage type -> implementations -> env requirements. This is directly applicable for your ecosystem where you need Supabase per-project DBs. You could build a similar registry: `{"MEMORY_STORAGE": {"supabase": SupabaseMemory, "redis": RedisMemory}, "GRAPH_STORAGE": {...}}`.

**STEAL: Multi-mode retrieval.** The local/global/hybrid/mix query modes are excellent for a cross-business knowledge base. Each business project could have its own namespace (LightRAG already supports namespaces), and a "global" query could span all 5 businesses while "local" stays within one.

**STEAL: Entity extraction prompts.** The entity extraction system prompt in `prompt.py` is extremely well-engineered with explicit formatting rules, N-ary decomposition, and deduplication guidance. Directly reusable for knowledge graph construction from business documents.

### Reality Check

LightRAG is **real and production-ready**. It has Docker/K8s deployment configs, comprehensive test suite (53 test files), comprehensive backend support. The knowledge graph approach genuinely adds value over pure vector RAG for complex queries. However, it is a library/service, not a framework -- you would integrate it as a component, not build on it.

---

## 2. OpenSpace -- P2P Agent Network

### Architecture

OpenSpace is a **full-stack autonomous agent platform** with sophisticated architecture:

- **GroundingAgent** (`agents/grounding_agent.py`): Core agent that executes tasks through multi-round iteration with self-correction (up to 15-20 iterations). Supports backends: `gui`, `shell`, `mcp`, `web`, `system`.
- **OpenSpace orchestrator** (`tool_layer.py`): Top-level class managing LLM client, grounding client, skill registry, execution analyzer, skill evolver, and recording manager.
- **Skill Engine** (`skill_engine/`): Self-evolving skill system with SQLite-backed store, registry, analyzer, evolver, fuzzy matching, and ranking. Skills are markdown files with frontmatter.
- **Communication Gateway** (`communication/gateway.py`): Multi-platform messaging bridge with adapters for Feishu (Lark) and WhatsApp, session management, attachment caching, and webhook HTTP server.
- **Recording System** (`recording/`): Full execution recording with screenshots, video, and conversation logs.

### Agent Patterns

**This is the most relevant repo for your ecosystem.** Key patterns:

1. **Skill Evolution Loop**: After each task execution, `ExecutionAnalyzer` reviews the recording/conversation, assigns per-skill judgments, and surfaces `EvolutionSuggestion` objects. `SkillEvolver` then executes three evolution types: FIX (repair broken skills), DERIVED (enhanced versions), CAPTURED (novel patterns from execution). This is a self-improving agent.

2. **Multi-backend grounding**: The `GroundingClient` supports multiple execution backends (GUI automation, shell, MCP protocol, web browser, system commands) with per-backend scope filtering.

3. **Visual analysis**: `VisualAnalyzer` takes screenshots and analyzes them with a dedicated LLM model for GUI tasks.

4. **Skill-injected prompts**: Skills are matched to incoming tasks, and their content is injected into the system prompt via `set_skill_context()`. Mid-iteration, the agent can call `retrieve_skill` to find additional skills.

5. **Communication Gateway as multi-channel bridge**: Adapters for WhatsApp/Feishu with session isolation, rate limiting, attachment caching, and scoped locks.

### Key Files

- `/tmp/research-repos/OpenSpace/openspace/tool_layer.py` -- Main OpenSpace class, initialization, skill/agent orchestration
- `/tmp/research-repos/OpenSpace/openspace/agents/grounding_agent.py` -- Core agent with multi-round iteration
- `/tmp/research-repos/OpenSpace/openspace/skill_engine/store.py` -- SQLite-backed skill persistence (DDL for skill_records, lineage, analyses, judgments)
- `/tmp/research-repos/OpenSpace/openspace/skill_engine/evolver.py` -- Self-improving skill evolution (FIX/DERIVED/CAPTURED)
- `/tmp/research-repos/OpenSpace/openspace/skill_engine/analyzer.py` -- Post-execution analysis with conversation replay
- `/tmp/research-repos/OpenSpace/openspace/communication/gateway.py` -- Multi-platform messaging gateway

### Applicable Insights for Your Ecosystem

**STEAL: Skill Evolution architecture.** The FIX/DERIVED/CAPTURED evolution loop is directly applicable to Jarvis Stage 3-4. Each business agent could have skills that evolve based on execution results. Store skills in Supabase with the same schema OpenSpace uses (skill_records, lineage, judgments).

**STEAL: Communication Gateway pattern.** The adapter-based multi-channel bridge is perfect for your WhatsApp/Instagram integration needs across 5 businesses. One gateway, multiple adapters, session isolation per conversation.

**STEAL: Execution analysis.** After every agent task, analyzing the conversation log and tool results to improve future performance. This is your Jarvis "learning from experience" pattern.

**STEAL: Backend scope filtering.** The pattern of declaring `backend_scope: ["shell", "mcp", "web"]` per agent and filtering available tools accordingly maps to how your Managed Agents could have different capability profiles per business domain.

### Reality Check

OpenSpace is **ambitious and well-engineered** but still early-stage (v0.1.0). The skill evolution system is the crown jewel -- genuinely novel self-improving behavior. The communication gateway with Feishu/WhatsApp adapters is production-oriented. The `gdpval_bench/` directory suggests academic benchmarking. The main weakness: it is tightly coupled to desktop/GUI automation (screenshots, browser control), which is less relevant for your server-side agent ecosystem.

---

## 3. nanobot -- Lightweight Agent Orchestration

### Architecture

nanobot is a **clean, well-factored agent runtime** similar to Claude Code itself:

- **AgentLoop** (`agent/loop.py`): Core processing engine that receives messages from a bus, builds context, calls LLM, executes tools, sends responses. Supports sessions, auto-compaction, subagents, cron, and MCP servers.
- **MessageBus** (`bus/queue.py`): Simple async queue-based pub/sub decoupling channels from agent core. Clean separation of concerns.
- **SubagentManager** (`agent/subagent.py`): Spawns background tasks as independent agent runs with their own tool registries, max iterations, and system prompts.
- **Memory system** (`agent/memory.py`): MemoryStore (file-based: MEMORY.md, history.jsonl, SOUL.md, USER.md), Consolidator (summarizes old conversations), Dream (background reflective processing).
- **AutoCompact** (`agent/autocompact.py`): Proactive compression of idle sessions -- archives old messages, summarizes them, keeps recent tail. TTL-based expiration.
- **Skills system** (`agent/skills.py` + `skills/`): Built-in skills as directories (github, cron, memory, weather, tmux, etc.).
- **Tool Registry** (`agent/tools/`): File ops, shell, web fetch/search, glob, grep, notebooks, messaging, spawn.
- **Multi-provider LLM** (`providers/`): OpenAI, Anthropic, Azure, GitHub Copilot, OpenAI Codex, generic OpenAI-compatible.
- **Session Manager** (`session/manager.py`): Conversation persistence with consolidation tracking.
- **Channels** (`channels/`): Multi-channel input support.

### Agent Patterns

1. **Subagent spawning**: The main agent can spawn background subagents via `SubagentManager.spawn()`. Each subagent gets its own ToolRegistry, system prompt, max iterations. Results are posted back to the message bus. This is the delegation pattern.

2. **Dream/Consolidation memory**: The `Dream` processor runs background reflective analysis on conversation history. The `Consolidator` archives old messages into summaries. This creates a layered memory: immediate (messages) -> consolidated (summaries) -> persistent (MEMORY.md, SOUL.md, USER.md).

3. **AutoCompact for token efficiency**: Idle sessions are proactively compressed by archiving old messages and replacing them with summaries. This prevents context window overflow.

4. **Hook system**: `AgentHook` lifecycle callbacks (before_execute_tools, after_iteration, on_stream, finalize_content) allow extensibility without modifying core logic.

5. **MessageBus decoupling**: Clean async queue pattern separating message ingestion from agent processing.

### Key Files

- `/tmp/research-repos/nanobot/nanobot/nanobot.py` -- Programmatic facade (`Nanobot.from_config()` -> `run()`)
- `/tmp/research-repos/nanobot/nanobot/agent/loop.py` -- Core agent loop with context building, LLM calling, tool execution
- `/tmp/research-repos/nanobot/nanobot/agent/subagent.py` -- Background task spawning with isolated tool registries
- `/tmp/research-repos/nanobot/nanobot/agent/memory.py` -- Multi-layer memory: MemoryStore, Consolidator, Dream
- `/tmp/research-repos/nanobot/nanobot/agent/autocompact.py` -- Proactive session compression
- `/tmp/research-repos/nanobot/nanobot/bus/queue.py` -- Async inbound/outbound message bus

### Applicable Insights for Your Ecosystem

**STEAL: Three-tier memory architecture.** Immediate messages -> consolidated summaries -> persistent files (MEMORY.md, SOUL.md, USER.md). This directly maps to your Jarvis memory needs. MEMORY.md = working knowledge, SOUL.md = agent identity/personality, USER.md = user preferences. Store these in Supabase per-business.

**STEAL: AutoCompact pattern.** For long-running agent sessions managing businesses, proactive compression of idle sessions prevents token blowout. TTL-based archival with summary retention is exactly what you need for agents monitoring 5 businesses.

**STEAL: Subagent spawning with isolated tool registries.** When Jarvis delegates a task to a business-specific agent, that agent gets its own tool set (Intentus gets real estate tools, law office gets legal tools). The nanobot pattern of `SubagentManager.spawn()` with per-subagent `ToolRegistry` is the template.

**STEAL: MessageBus pattern.** Simple async queue for decoupling. Your Railway-deployed agents could use a Redis-backed version of this pattern for inter-agent communication.

**STEAL: Hook system.** The `AgentHook` lifecycle is perfect for adding logging, monitoring, and business-specific behavior without modifying agent core.

### Reality Check

nanobot is **highly practical and well-designed**. It is essentially a clean-room reimplementation of Claude Code's agent runtime patterns. The codebase is organized, the patterns are proven. The main limitation: it is a single-agent system with subagent support, not a multi-agent orchestration framework. For your ecosystem, you would use these patterns within each Managed Agent, not to orchestrate between them.

---

## 4. DeepCode -- Code Generation from Research Papers

### Architecture

DeepCode is a **research-to-code automation platform** with a multi-agent pipeline:

- **Agent Orchestration Engine** (`workflows/agent_orchestration_engine.py`): Coordinates 7 specialized agents in sequence: Research Analysis, Workspace Infrastructure, Code Architecture, Reference Intelligence, Repository Acquisition, Codebase Intelligence, Code Implementation.
- **Code Implementation Workflow** (`workflows/code_implementation_workflow.py`): MCP-based iterative development using file tree creation followed by file-by-file code generation.
- **Memory Agent** (`workflows/agents/memory_agent_concise.py`): Manages context window by keeping only system prompt + initial plan + current round tool results. Clears history after each `write_file` call.
- **MCP Integration**: Uses `mcp_agent` framework with `Agent`, `RequestParams`, `ParallelLLM` for multi-agent coordination. Server configs in `mcp_agent.config.yaml`.
- **Tools** (`tools/`): PDF conversion/download, code indexing, search, document segmentation, command execution, git operations.
- **Frontend**: FastAPI backend + Vite/React frontend for the UI.
- **Embedded nanobot**: Contains a full copy of nanobot under `nanobot/` directory as a bridge component.

### Agent Patterns

1. **Sequential multi-agent pipeline**: 7 agents run in sequence, each with a specialized prompt and tool set. Uses MCP protocol for tool communication.

2. **Adaptive retry with token reduction**: When LLM context limits are hit, the system progressively reduces max_tokens (to 80%, then 60%) and lowers temperature. This is a practical pattern for handling model limitations.

3. **Concise Memory Agent**: Instead of growing context indefinitely, the memory agent implements a "clean slate" approach -- after each file is written, previous conversation history is purged, keeping only the plan and fresh tool results. This is aggressive but prevents context pollution.

4. **Output completeness assessment**: `_assess_output_completeness()` checks if YAML-formatted implementation plans have all required sections, proper structure, and adequate length before accepting them. This is a validation pattern for structured LLM outputs.

5. **ParallelLLM**: From mcp_agent framework, runs multiple agents in parallel for tasks like reference analysis.

### Key Files

- `/tmp/research-repos/DeepCode/workflows/agent_orchestration_engine.py` -- 7-agent pipeline coordinator
- `/tmp/research-repos/DeepCode/workflows/code_implementation_workflow.py` -- MCP-based iterative code generation
- `/tmp/research-repos/DeepCode/workflows/agents/memory_agent_concise.py` -- Clean-slate memory management
- `/tmp/research-repos/DeepCode/deepcode.py` -- FastAPI+Vite launcher with dependency management
- `/tmp/research-repos/DeepCode/tools/code_implementation_server.py` -- MCP server for code operations
- `/tmp/research-repos/DeepCode/mcp_agent.config.yaml` -- Agent/server configuration

### Applicable Insights for Your Ecosystem

**STEAL: Sequential multi-agent pipeline pattern.** For complex workflows (e.g., new property listing pipeline at Intentus), a sequence of specialized agents each handling one step is cleaner than one mega-agent. DeepCode's pattern of 7 named agents with clear hand-offs is a template.

**STEAL: Adaptive retry with token reduction.** When your agents hit Anthropic API limits, automatically reducing output tokens and temperature is a practical fallback strategy.

**STEAL: Clean-slate memory for implementation tasks.** When an agent is generating multiple artifacts (contracts, analyses, proposals), clearing history between each generation prevents cross-contamination. Keep only the plan + current context.

**STEAL: Output completeness validation.** Before accepting structured outputs (YAML, JSON) from LLMs, validate that all required sections are present. Prevents half-baked plans from propagating.

### Reality Check

DeepCode is **specialized and narrowly focused** -- it transforms research papers into code implementations. The multi-agent pipeline is real but tightly coupled to the paper-to-code use case. The embedded nanobot copy suggests integration challenges. The FastAPI/Vite UI is functional but the core value is in the orchestration engine and memory management. For your ecosystem, the patterns are more valuable than the implementation.

---

## 5. VideoRAG -- Video as Knowledge Source

### Architecture

VideoRAG extends the LightRAG pattern to video content:

- **VideoRAG dataclass** (`videorag/videorag.py`): Main orchestrator with parameters for video processing (segment length, frames per segment, embedding dimensions) and text RAG (chunk size, entity extraction).
- **Video processing pipeline** (`_videoutil/`): Split video into segments, speech-to-text transcription, visual captioning using MiniCPM-V-2_6, feature extraction.
- **Knowledge graph extraction** (`_op.py`): Same entity/relation extraction as LightRAG but adapted for video segments -- chunks are grouped by video segments, not arbitrary text boundaries.
- **Dual retrieval**: Video segment feature VDB (visual similarity) + text chunks VDB (semantic similarity) + entity KG (graph traversal).
- **Storage** (`_storage/`): JSON-based KV, NanoVectorDB, NetworkX graph -- lightweight, local-only implementations.
- **Desktop app** (`Vimo-desktop/`): Electron+TypeScript frontend with Python backend.

### Agent Patterns

VideoRAG has **no agent patterns** -- it is a retrieval pipeline like LightRAG, specialized for video. No orchestration, no delegation, no memory management.

### Key Files

- `/tmp/research-repos/VideoRAG/VideoRAG-algorithm/videorag/videorag.py` -- Main VideoRAG class with all config parameters
- `/tmp/research-repos/VideoRAG/VideoRAG-algorithm/videorag/_op.py` -- Chunking by video segments, entity extraction
- `/tmp/research-repos/VideoRAG/VideoRAG-algorithm/videorag/_videoutil/` -- Video split, ASR, captioning, feature extraction
- `/tmp/research-repos/VideoRAG/VideoRAG-algorithm/videorag/base.py` -- Storage abstractions (same pattern as LightRAG)

### Applicable Insights for Your Ecosystem

**STEAL: Multi-modal retrieval pattern.** The combination of visual features + text embeddings + knowledge graph is relevant if your ecosystem ever processes video content (e.g., property tour videos for Intentus, educational content for the school).

**STEAL: Segment-aware chunking.** Instead of arbitrary text boundaries, chunking by meaningful segments (video segments, document sections, conversation turns) preserves semantic coherence. Apply this to your business document processing.

### Reality Check

VideoRAG is **academic/research-grade** code. It depends on local model loading (MiniCPM-V-2_6), has only lightweight JSON/NanoVectorDB storage (no production backends), and the Electron desktop app suggests a demo-oriented project. The video processing pipeline is real but requires significant GPU resources. For your ecosystem, the multi-modal retrieval concept is interesting but the implementation is too specialized and resource-heavy for immediate use.

---

## Synthesis: What to Steal for Managed Agents + Supabase + Railway

### Tier 1 -- Implement Now

| Pattern | Source | Application |
|---------|--------|-------------|
| Three-tier memory (immediate/consolidated/persistent) | nanobot | MEMORY.md, SOUL.md, USER.md per business in Supabase |
| Storage abstraction registry | LightRAG | Pluggable Supabase/Redis/Postgres backends per project |
| MessageBus decoupling | nanobot | Redis-backed async queue between Railway-deployed agents |
| Subagent spawning with isolated tools | nanobot | Jarvis delegates to business agents with scoped tool sets |
| AutoCompact for long-running sessions | nanobot | Prevent token blowout for agents monitoring 5 businesses |

### Tier 2 -- Implement in Jarvis Stage 2-3

| Pattern | Source | Application |
|---------|--------|-------------|
| Skill Evolution (FIX/DERIVED/CAPTURED) | OpenSpace | Agents learn from execution, improve their own skills |
| Communication Gateway with channel adapters | OpenSpace | WhatsApp/Instagram adapter pattern for all 5 businesses |
| Post-execution analysis | OpenSpace | After every task, analyze quality and surface improvements |
| Hook lifecycle system | nanobot | Logging, monitoring, business-specific behavior per agent |
| Sequential multi-agent pipelines | DeepCode | Complex workflows split into specialized agent steps |

### Tier 3 -- Consider for Later

| Pattern | Source | Application |
|---------|--------|-------------|
| Knowledge graph extraction prompts | LightRAG | Build KGs from business documents across 5 businesses |
| Multi-mode retrieval (local/global/hybrid) | LightRAG | Cross-business knowledge queries |
| Adaptive retry with token reduction | DeepCode | Handle API limits gracefully |
| Output completeness validation | DeepCode | Validate structured outputs before acting on them |
| Multi-modal retrieval | VideoRAG | Video content from properties, educational material |

### Architecture Recommendation

Based on this analysis, the strongest patterns for your ecosystem are:

1. **nanobot's agent runtime patterns** are the most directly applicable foundation for each individual Managed Agent. The AgentLoop + ToolRegistry + SubagentManager + MemoryStore pattern is clean and proven.

2. **OpenSpace's Skill Engine** is the most innovative component across all 5 repos and directly maps to your Jarvis Stage 3-4 vision of self-improving agents.

3. **LightRAG's storage abstraction** is the right pattern for your shared ECOSYSTEM database + per-project DBs architecture.

The other repos (DeepCode, VideoRAG) offer useful patterns but are too domain-specific to serve as foundations.

The analysis is complete. Here is the summary of the key findings and the structured report above.

**Top-level takeaway**: The three most valuable repos for your Managed Agents + Supabase + Railway ecosystem are:

1. **nanobot** -- Best foundation patterns for individual agent runtime (memory tiers, subagent spawning, AutoCompact, MessageBus, Hook lifecycle)
2. **OpenSpace** -- Most innovative self-improving agent architecture (Skill Evolution with FIX/DERIVED/CAPTURED, Communication Gateway with channel adapters, post-execution analysis)
3. **LightRAG** -- Best storage abstraction and knowledge graph patterns for a cross-business knowledge layer

DeepCode contributes useful sequential multi-agent pipeline and adaptive retry patterns. VideoRAG is academic-grade and too specialized for immediate use but demonstrates multi-modal retrieval concepts.

The full structured report above contains: architecture breakdown, agent patterns, key file paths, concrete "steal this" recommendations organized in three implementation tiers, and reality checks for each repo.

