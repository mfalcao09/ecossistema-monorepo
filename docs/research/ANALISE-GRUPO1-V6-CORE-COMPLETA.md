# Análise Profunda — V6 Core: 7 Repos (código-fonte real)

> Gerado por agente de pesquisa em 2026-04-15

I now have enough data to produce the comprehensive analysis. Here is the structured output:

---

# V6 Research Repos -- Deep Analysis

## 1. LightRAG -- RAG with Knowledge Graphs

**What it ACTUALLY does:**
A production-grade Retrieval-Augmented Generation framework that extracts entities and relationships from documents, builds a knowledge graph, then uses multi-modal retrieval (local, global, hybrid, mix, naive) to answer queries. It is NOT a toy -- it has a full FastAPI server, React WebUI, Ollama-compatible API, and pluggable storage backends for every layer.

**Architecture:**
- 4-layer pluggable storage: KV (LLM cache, chunks, doc info), Vector (embeddings), Graph (entity-relation graph), DocStatus (processing tracking)
- Backends per layer: JSON/NetworkX (dev), PostgreSQL/Neo4j/MongoDB/Redis/Milvus/Qdrant/Faiss (prod)
- Core pipeline: `lightrag.py` (orchestrator) -> `operate.py` (extraction + query) -> `base.py` (abstract storage interfaces) -> `kg/` (concrete implementations)
- Query modes: `local` (entity-focused), `global` (community summaries), `hybrid` (both), `naive` (vector-only), `mix` (KG + vector with reranker -- recommended)
- Workspace isolation via namespace parameter -- different implementation per storage type (subdirs, prefixes, columns)
- All async/await, dataclass-based config, environment-driven

**Key patterns for our ecosystem:**
- **Pluggable storage backend pattern** via abstract base classes (`BaseKVStorage`, `BaseVectorStorage`, `BaseGraphStorage`) -- directly applicable to our per-project DB architecture
- **Workspace isolation** -- each LightRAG instance can use a `workspace` param for data isolation. This maps to our "ECOSYSTEM compartilhado + DBs per-projeto" decision
- **Entity extraction -> KG -> multi-mode retrieval** pipeline for Jarvis's knowledge layer
- **Reranker integration** for retrieval quality (BAAI/bge-reranker-v2-m3)
- **The `initialize_storages()` / `finalize_storages()` lifecycle** -- explicit async init/teardown for services

**Key files:**
- `/research-repos/LightRAG/lightrag/lightrag.py` -- main orchestrator class
- `/research-repos/LightRAG/lightrag/base.py` -- abstract storage interfaces + QueryParam
- `/research-repos/LightRAG/lightrag/operate.py` -- entity extraction, chunking, query logic
- `/research-repos/LightRAG/lightrag/kg/` -- all storage backend implementations
- `/research-repos/LightRAG/CLAUDE.md` -- excellent architecture reference

---

## 2. OpenSpace -- Self-Evolving Skill Engine for Agents

**What it ACTUALLY does:**
An MCP server that plugs into any agent (Claude Code, nanobot, Codex, etc.) and provides a **self-evolving skill system**. Skills (SKILL.md files) are discovered, matched to tasks, executed, analyzed, and then automatically improved (FIX, DERIVED, CAPTURED). Includes a cloud skill-sharing community and communication gateways (WhatsApp, Feishu).

**Architecture:**
- **MCP Server** (`mcp_server.py`) exposes 4 tools: `execute_task`, `search_skills`, `fix_skill`, `upload_skill`
- **Skill Engine** is the core: `SkillRegistry` (discover/load/match) -> `ExecutionAnalyzer` (post-execution analysis) -> `SkillEvolver` (auto-fix/derive/capture) -> `SkillStore` (persistence)
- **3 evolution types**: FIX (repair broken skill in-place), DERIVED (create enhanced version), CAPTURED (brand new skill from successful workflow)
- **3 trigger sources**: Post-analysis, tool degradation, metric monitoring
- **SkillRanker** with keyword prefiltering + LLM-based selection
- **Cloud layer** for skill sharing with access control (public/private/team)
- **Grounding agents** with visual analysis capabilities
- **Host detection** auto-detects which agent is running (Claude Code, nanobot, etc.)

**Key patterns for our ecosystem:**
- **Self-evolving SKILL.md pattern** -- skills that auto-fix and improve. Directly applicable to Jarvis stage 3-4
- **The Skill lifecycle**: discover -> match -> inject -> execute -> analyze -> evolve -> store. This is the blueprint for how Jarvis should learn
- **MCP server as integration layer** -- any agent can use OpenSpace via MCP. Our ecosystem agents should expose capabilities the same way
- **SkillEvolver's 3-type evolution model** (FIX/DERIVED/CAPTURED) is a concrete pattern for continuous improvement
- **Cloud skill community** with visibility controls -- pattern for cross-business knowledge sharing in the ecosystem

**Key files:**
- `/research-repos/OpenSpace/openspace/mcp_server.py` -- MCP tool definitions
- `/research-repos/OpenSpace/openspace/skill_engine/registry.py` -- skill discovery, matching
- `/research-repos/OpenSpace/openspace/skill_engine/evolver.py` -- auto-evolution logic
- `/research-repos/OpenSpace/openspace/skill_engine/analyzer.py` -- execution analysis
- `/research-repos/OpenSpace/openspace/skill_engine/types.py` -- EvolutionType, SkillRecord, etc.

---

## 3. nanobot -- Ultra-Lightweight Personal AI Agent

**What it ACTUALLY does:**
A personal AI agent runtime with 99% less code than alternatives like OpenClaw. It runs 24/7, connects to 15+ chat channels (WhatsApp, Telegram, Slack, Discord, Feishu, WeChat, email, etc.), supports MCP, has a skill system, memory (MEMORY.md + SOUL.md + history.jsonl), cron scheduling, and multi-provider LLM support (OpenAI, Anthropic, Ollama, DeepSeek, etc.).

**Architecture:**
- **AgentLoop** is the core (`agent/loop.py`): processes messages via ContextBuilder -> AgentRunner -> tool execution -> streaming response
- **MessageBus** event system for decoupled communication
- **ToolRegistry** pattern -- tools registered: filesystem (read/write/edit/glob/grep), shell (exec), web (fetch/search), cron, spawn (subagents), notebook, message
- **Memory system** (`agent/memory.py`): `MemoryStore` (file I/O for MEMORY.md, history.jsonl, SOUL.md, USER.md) + `Consolidator` (lightweight) + `Dream` (async deep processing with two-stage memory)
- **Channel abstraction** (`channels/base.py`) with 15+ implementations: each channel adapts platform-specific messaging to the unified MessageBus
- **Provider abstraction** (`providers/base.py`): LLMProvider interface with native OpenAI + Anthropic SDKs (litellm removed)
- **Session management** with auto-compact for long-running sessions
- **Skills via SKILL.md** files in workspace/skills/ and builtin skills directory
- **AgentHook system** for lifecycle events (before/after tool execution, streaming, etc.)
- **SubagentManager** for spawning child agents
- **GitStore** for version-controlled memory persistence

**Key patterns for our ecosystem:**
- **The channel/gateway pattern** -- one agent runtime, 15+ messaging adapters. Essential for Jarvis (WhatsApp is already a gateway)
- **Memory architecture**: MEMORY.md (persistent knowledge) + SOUL.md (personality/instructions) + USER.md (user profile) + history.jsonl (conversation log) + GitStore for versioning. This is the memory model for Jarvis
- **Dream processor** -- async background memory consolidation. Directly applicable to Jarvis stage 2
- **AgentHook lifecycle** -- composable hooks for before/after tool execution, streaming. Pattern for ecosystem agent extensibility
- **Auto-compact** for context window management in long-running sessions
- **Config-driven everything** via `config.json` with schema validation

**Key files:**
- `/research-repos/nanobot/nanobot/agent/loop.py` -- core agent loop
- `/research-repos/nanobot/nanobot/agent/memory.py` -- MemoryStore, Consolidator, Dream
- `/research-repos/nanobot/nanobot/agent/skills.py` -- SkillsLoader
- `/research-repos/nanobot/nanobot/nanobot.py` -- programmatic SDK facade
- `/research-repos/nanobot/nanobot/channels/` -- all 15+ channel adapters
- `/research-repos/nanobot/nanobot/agent/tools/` -- tool registry and implementations

---

## 4. DeepCode -- Multi-Agent Code Generation from Research Papers

**What it ACTUALLY does:**
An agentic coding platform that transforms research papers and natural language descriptions into production-ready code. Uses a 7-agent orchestration pipeline: Research Analysis -> Workspace Infrastructure -> Code Architecture -> Reference Intelligence -> Repository Acquisition -> Codebase Intelligence -> Code Implementation. Has both CLI and Web UI.

**Architecture:**
- **Agent Orchestration Engine** (`workflows/agent_orchestration_engine.py`): coordinates 7 specialized agents using `mcp_agent` framework with `ParallelLLM` for concurrent processing
- **Agents** are specialized: `document_segmentation_agent` (long papers), `requirement_analysis_agent`, `code_implementation_agent`, `memory_agent_concise` (tracks context across steps)
- **Workflow pattern**: YAML-based implementation plans with 5 required sections (file_structure, implementation_components, validation_approach, environment_setup, implementation_strategy)
- **Completeness assessment** function checks if LLM output has all required YAML sections
- **Adaptive configuration** via `get_adaptive_agent_config()` -- adjusts agent behavior based on input complexity
- **nanobot integration** -- can be invoked as a skill from nanobot/Feishu
- **FastAPI backend + React frontend** (new_ui/)
- **WebSocket real-time communication** for user-in-the-loop interaction

**Key patterns for our ecosystem:**
- **Multi-agent orchestration engine** with specialized role separation -- direct blueprint for Jarvis stage 3-4 where agents coordinate
- **The 7-agent pipeline** is a concrete example of how to decompose complex tasks into specialized agent roles
- **YAML-based plan validation with completeness scoring** -- pattern for ensuring quality in multi-step agent outputs
- **Document segmentation** for handling long inputs -- applicable to contract analysis in BAM/legal business
- **Memory agent** that maintains concise context across workflow steps -- pattern for multi-step agent memory

**Key files:**
- `/research-repos/DeepCode/workflows/agent_orchestration_engine.py` -- main orchestrator
- `/research-repos/DeepCode/workflows/agents/` -- 7 specialized agents
- `/research-repos/DeepCode/workflows/code_implementation_workflow.py` -- implementation pipeline
- `/research-repos/DeepCode/prompts/` -- all agent prompts
- `/research-repos/DeepCode/deepcode.py` -- launcher with dependency checking

---

## 5. VideoRAG -- Video Knowledge Extraction via Graph RAG

**What it ACTUALLY does:**
Extends LightRAG's knowledge graph approach to video content. Splits videos into segments, extracts audio (speech-to-text), generates captions, builds a multi-modal knowledge graph from video + text, and answers questions about extremely long videos (100+ hours). Ships as a desktop app (Vimo) built with Electron.

**Architecture:**
- **Dual-channel processing**: Video segments (visual frames via ImageBind) + Text transcripts (speech-to-text)
- **VideoRAG dataclass** extends the LightRAG pattern: `working_dir`, chunking configs, entity extraction configs, LLM configs
- **Storage layer**: `JsonKVStorage`, `NanoVectorDBStorage`, `NanoVectorDBVideoSegmentStorage`, `NetworkXStorage` -- simplified versions of LightRAG's backends
- **Video pipeline**: `split_video()` -> `speech_to_text()` -> `segment_caption()` -> `merge_segment_information()` -> `saving_video_segments()` -> entity extraction -> KG construction
- **Query modes**: local (entity-focused) and global (community summaries), plus naive RAG fallback
- **Video embedding**: ImageBind model at 1024 dimensions, batch processing
- **Segment retrieval** with configurable top_k

**Key patterns for our ecosystem:**
- **Multi-modal RAG pattern** -- extending text RAG to video/audio. Applicable to real estate (property tour videos), educational content (Colegios), training materials
- **The segment + transcript + caption merging pipeline** -- pattern for any media processing workflow
- **Inheriting and simplifying a complex framework** -- VideoRAG is a focused subset of LightRAG's architecture. Pattern for creating domain-specific RAG instances
- **Desktop app (Electron) wrapping Python backend** -- pattern for user-facing tools in the ecosystem

**Key files:**
- `/research-repos/VideoRAG/VideoRAG-algorithm/videorag/videorag.py` -- main VideoRAG class
- `/research-repos/VideoRAG/VideoRAG-algorithm/videorag/base.py` -- storage abstractions
- `/research-repos/VideoRAG/VideoRAG-algorithm/videorag/_op.py` -- extraction operations
- `/research-repos/VideoRAG/VideoRAG-algorithm/videorag/_videoutil/` -- video processing utilities

---

## 6. CLI-Anything -- Making ALL Software Agent-Native

**What it ACTUALLY does:**
A methodology + toolkit for creating CLI harnesses that wrap GUI applications, making them usable by AI agents. Includes a standard operating procedure (HARNESS.md), a plugin for Claude Code, and a registry (CLI-Hub) of 30+ completed CLI wrappers (Blender, GIMP, Inkscape, Audacity, FreeCAD, Godot, n8n, etc.). Each CLI has a REPL mode, JSON output, undo/redo, and comprehensive tests.

**Architecture:**
- **HARNESS.md** is the core -- a 7-phase SOP: Codebase Analysis -> CLI Architecture Design -> Implementation -> Test Planning -> Test Implementation -> Documentation -> Publishing
- **Plugin** (`cli-anything-plugin/`) auto-generates CLIs from GUI app source code
- **CLI-Hub** (`cli-hub/`) -- a package manager (`pip install cli-anything-hub`) for browsing, installing, and managing CLIs
- **Per-CLI structure**: Click-based Python CLI with subcommand groups, REPL mode, JSON output, session state management, undo/redo
- **State model**: JSON session files for REPL persistence, file-based locking
- **Output format**: Dual human-readable (tables, colors) + machine-readable (JSON via `--json` flag)
- **Testing**: Unit + E2E tests per CLI, 2,130+ passing tests across all implementations
- **SKILL.md per CLI** -- each generated CLI includes a skill file for agent discovery

**Key patterns for our ecosystem:**
- **The GUI-to-CLI bridge pattern** -- making any software agent-operable. Critical for Jarvis integrating with tools like n8n, Dify, etc.
- **HARNESS.md as SOP** -- the pattern of encoding an entire methodology into a single reference document. Blueprint for our ecosystem's operational SOPs
- **CLI-Hub registry** -- a searchable registry of agent capabilities. Pattern for our ecosystem's service registry
- **SKILL.md per tool** -- each tool comes with agent-readable instructions. Standard for how ecosystem services should expose their capabilities
- **Dual output format** (human + JSON) -- every service in our ecosystem should support both

**Key files:**
- `/research-repos/CLI-Anything/cli-anything-plugin/HARNESS.md` -- the core 7-phase methodology
- `/research-repos/CLI-Anything/cli-anything-plugin/skill_generator.py` -- auto-generates SKILL.md
- `/research-repos/CLI-Anything/cli-hub/` -- package manager
- `/research-repos/CLI-Anything/anygen/` -- the generic CLI scaffolding

---

## 7. claude-mem -- Persistent Memory for Claude Code

**What it ACTUALLY does:**
A Claude Code plugin that captures tool usage observations during sessions, compresses them using an AI agent (Claude Agent SDK), stores them in SQLite + ChromaDB (vector embeddings), and injects relevant context into future sessions. Provides a web viewer UI at localhost:37777, search skills, and progressive disclosure of memory.

**Architecture:**
- **5 lifecycle hooks**: SessionStart -> UserPromptSubmit -> PostToolUse -> Summary -> SessionEnd
- **Worker Service** (`src/services/worker-service.ts`): Express API on port 37777, orchestrator pattern delegating to specialized modules
- **Domain services**: DatabaseManager (SQLite), SessionManager, SSEBroadcaster, SDKAgent (Claude API), SearchManager, FormattingService, TimelineService
- **ChromaSync** for vector embeddings in ChromaDB (semantic search)
- **Progressive disclosure** strategy for context injection -- layered memory retrieval with token cost visibility
- **Skills**: `mem-search` (search past work via HTTP API), `make-plan` (phased implementation planning), `do` (plan execution via subagents)
- **Privacy tags**: `<private>content</private>` strips data at hook layer before storage
- **Supervisor** pattern for process management (PID files, health monitoring, graceful shutdown)
- **Multi-IDE support**: Claude Code, Gemini CLI, OpenCode, OpenClaw

**Key patterns for our ecosystem:**
- **The 5-hook lifecycle** (SessionStart/UserPromptSubmit/PostToolUse/Summary/SessionEnd) -- this is the blueprint for how Jarvis should capture and persist context
- **Progressive disclosure** of memory -- inject context in layers based on relevance, with token cost awareness. Essential for staying within context windows
- **Worker service as background daemon** -- always-on process that handles AI processing async while the main agent works. Pattern for ecosystem background services
- **SQLite + ChromaDB dual storage** -- structured data + semantic vector search. Applicable to Jarvis's memory layer
- **Privacy tags at the edge** -- data filtering at capture time, not at retrieval. Pattern for LGPD compliance
- **Supervisor pattern** with PID files, health monitoring, graceful shutdown -- production-grade process management for any ecosystem service

**Key files:**
- `/research-repos/claude-mem/src/services/worker-service.ts` -- orchestrator
- `/research-repos/claude-mem/src/hooks/hook-response.ts` -- hook contract
- `/research-repos/claude-mem/src/services/worker/DatabaseManager.js` -- SQLite layer
- `/research-repos/claude-mem/src/services/sync/ChromaSync.ts` -- vector embeddings
- `/research-repos/claude-mem/CLAUDE.md` -- architecture reference

---

## Cross-Cutting Patterns for the Ecosystem

All 7 repos share common architectural DNA from the HKUDS lab (HKU Data Intelligence Lab -- LightRAG, OpenSpace, nanobot, DeepCode, VideoRAG, CLI-Anything are all HKUDS projects):

| Pattern | Where | Ecosystem Applicability |
|---------|-------|------------------------|
| **SKILL.md as agent capability descriptor** | OpenSpace, nanobot, CLI-Anything | Every ecosystem service should have a SKILL.md |
| **MCP as integration protocol** | OpenSpace, nanobot, claude-mem | Standard inter-agent communication |
| **Pluggable storage backends** | LightRAG, VideoRAG | Per-project DB isolation |
| **Async lifecycle (init/run/finalize)** | LightRAG, nanobot | Service lifecycle management |
| **Channel/gateway abstraction** | nanobot (15+ channels) | Jarvis multi-platform presence |
| **Memory: file-based + vector + structured** | nanobot, claude-mem, LightRAG | Three-tier memory for Jarvis |
| **Self-evolving skills** | OpenSpace (FIX/DERIVED/CAPTURED) | Continuous improvement loop |
| **Multi-agent orchestration** | DeepCode (7 agents), nanobot (subagents) | Complex task decomposition |
| **HARNESS.md methodology encoding** | CLI-Anything | SOPs as executable documents |
| **KG-based RAG** | LightRAG, VideoRAG | Knowledge layer for all businesses |

