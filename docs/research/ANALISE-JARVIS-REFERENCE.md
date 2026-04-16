# Análise Profunda — Jarvis Reference Stack (phantom + SDK + memory)

> phantom (Jarvis blueprint), claude-agent-sdk-python, claude-agent-sdk-demos, claude-cookbooks, mem0, letta, fastmcp

I have enough material. Let me compile the comprehensive analysis.

---

# Deep Research Analysis: Jarvis + Memory + Anthropic SDK Layer

Analysis of 7 repos at `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/`. I only analyzed existing code â no modifications were made.

---

## 1. phantom/ â THE JARVIS BLUEPRINT (CRITICAL)

**Repo root:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/`

### What it ACTUALLY does (concrete)
An autonomous Bun process that wraps the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) as a subprocess with `permissionMode: "bypassPermissions"`. Lives on a VM with full Docker/bash/filesystem access. Persists sessions in SQLite, vectorizes episodes/facts/procedures in Qdrant (with Ollama `nomic-embed-text` embeddings), rewrites its own YAML/MD config via a validated 6-step reflection subprocess, and exposes every capability as a Streamable HTTP MCP server on `/mcp`. Multi-channel (Slack Socket Mode, Telegram, IMAP/SMTP email, HMAC-SHA256 webhooks, React 19 SPA at `/chat` over SSE, CLI). 30,000+ TS lines, 1,584 tests, v0.19.1.

### Architecture patterns (code-level, from actual source)

**The Cardinal Rule ("TypeScript is plumbing, Agent SDK is the brain"):**
TS handles only mechanical work (routing, state, HTTP, SQLite). Never parses intent with regex, never detects frameworks heuristically â the agent reads files and figures it out. The only exception: "HEURISTIC FALLBACK" paths for when the LLM is unavailable.

**AgentRuntime (`src/agent/runtime.ts`)** â the core Agent SDK wrapper:
- Constructs SDK `query()` with `systemPrompt: { type: "preset", preset: "claude_code", append: appendPrompt }` â reuses Claude Code preset + appends dynamic context
- `permissionMode: "bypassPermissions"`, `allowDangerouslySkipPermissions: true`, `persistSession: true`
- Session resumption via `{ resume: session.sdk_session_id }`, falls back to fresh session if SDK says "No conversation found"
- Security wrapping for external channels: injects `[SECURITY]` banners around user messages (bidirectional wrapping â before AND after â to resist prompt injection)
- Concurrency guard: `activeSessions` Set prevents double-firing on the same `channelId:conversationId`
- AbortController + 240-minute default timeout
- Provider env injection via `buildProviderEnv(config)` â swaps Anthropic / Z.AI / OpenRouter / Ollama / vLLM transparently
- MCP servers are recreated per-call via factory pattern (SDK rejects reused instances)
- Stream iteration over `system/init`, `assistant`, `result` message types â emits `RuntimeEvent` union for channels to consume

**PromptAssembler (`src/agent/prompt-assembler.ts`)** â 9-section layered system prompt:
1. Identity (who you are)
2. Environment (Docker/VM awareness, tools available, public URL, MCP endpoint)
3. Security (what you must never do)
4. Role template (YAML-defined specialization, e.g. `swe.yaml`)
5. Onboarding prompt (first-run only)
6. Evolved config (constitution + persona + user-profile + domain-knowledge + strategies/{task-patterns, tool-preferences, error-recovery})
6b. Agent memory instructions (teach it to Write to `phantom-config/memory/agent-notes.md`)
7. Instructions (how you work)
8. Working memory (semi-stable personal notes)
9. Memory context (dynamic per-query vector recall)

Key insight: the evolved config files grow over time as the agent learns; memory-instructions block sits after them and deliberately does NOT inject `agent-notes.md` contents (avoids feedback loop).

**MemorySystem (`src/memory/system.ts`)** â three Qdrant collections:
- `episodic.ts` â tasks/conversations, named vectors `summary` (768) + `detail` (768) + sparse `text_bm25`. Payload indexes on `type`, `outcome`, `session_id`, `user_id`, `started_at/ended_at`, `importance`, `access_count`, `tools_used`, `files_touched`, `parent_id`
- `semantic.ts` â atomic facts (subject/predicate/object + natural_language). **Contradiction detection at write time** with `SIMILARITY_THRESHOLD = 0.85` â existing contradictions trigger `resolveContradiction()` (versioning)
- `procedural.ts` â workflows with success/failure outcome tracking
- Hybrid search: dense (cosine) + sparse (BM25 via `textToSparseVector`) + reciprocal rank fusion in `ranking.ts`
- Degraded mode: if Qdrant/Ollama unavailable, all writes/reads no-op silently. Storage never crashes the agent.

**EvolutionEngine (`src/evolution/engine.ts`)** â self-rewriting config:
- Gate-then-queue-then-drain pipeline: `enqueueIfWorthy â decideGate â queue â runDrainPipeline â runReflectionSubprocess`
- Constitution file check at boot â fails loud if missing
- Auto-detect reflection mode: disabled if no ANTHROPIC_API_KEY / `~/.claude/.credentials.json` and provider is plain Anthropic; always-on if custom provider/base_url set
- Sonnet is the default judge (cross-model from Opus main) to avoid self-enhancement bias
- Triple-judge minority veto: one dissent blocks the change
- 5 invariant gates: constitution (immutable), regression, size, drift, safety
- Git-like versioning in `versioning.ts` with rollback

**Security/Safety (`src/agent/hooks.ts`)**:
- `createDangerousCommandBlocker()` â regex blocklist of `rm -rf /`, `mkfs`, `dd of=/dev/`, `git push --force`, `docker compose down`, `systemctl stop phantom`, `kill -9 1`, etc. Returns `{ decision: "block", reason }` on `PreToolUse` hook
- `createFileTracker()` â `PostToolUse` hook on `Edit|Write` to track which files the agent touched this session
- Explicit comment: this is defense in depth, NOT a security boundary. Real boundaries: constitution, LLM judges, owner access control, firewall egress

**Secrets vault (`src/secrets/crypto.ts`)**:
- AES-256-GCM with 12-byte IV, 16-byte auth tag
- Key resolution: `SECRET_ENCRYPTION_KEY` env (hex 32 bytes) â auto-generated at `data/secret-encryption-key` (mode 0600)
- `phantom_collect_secrets` tool creates magic-link URL â user pastes credentials in web form â AES-GCM encrypted in SQLite â agent retrieves with `phantom_get_secret`. Never flows through Slack/chat.

**MCP Server (`src/mcp/server.ts`)**:
- `@modelcontextprotocol/sdk` McpServer wrapped by `McpTransportManager` factory
- Bearer token auth (`auth.ts`), SHA-256 hashed, 3 scopes (`reader`, `operator`, `admin`)
- `getRequiredScope(toolName)` enforces per-tool scope BEFORE delegating to transport
- RateLimiter per client, AuditLogger to SQLite, cleanup every 5 minutes
- Tool registration layers: universal (8 tools) â role-specific (`registerSweTools`) â dynamic management â dynamic tools (loaded from SQLite)

**Dynamic Tools (`src/mcp/dynamic-tools.ts`)**:
- SQLite-persisted tool registry, loaded at startup via `loadFromDatabase()`
- Handler types: `"shell"` (handler_code = bash) or `"script"` (handler_path = file on disk)
- **RCE prevention**: `"inline"` (new Function) was removed â only shell/script allowed
- `buildSafeEnv()` passes only `PATH/HOME/LANG/TERM/TOOL_INPUT` to subprocess â API keys never leak
- Zod input schema stored as JSON, validated per call
- Tool name regex: `/^[a-z][a-z0-9_]*$/`

### Patterns to ADOPT in our ecosystem (specific)
1. **Cardinal Rule as governance principle** â write it into the monorepo's root CLAUDE.md. Forbid `detectXxx()` / `parseXxx()` / `classifyXxx()` helpers; delegate to the Managed Agent.
2. **9-section layered prompt assembler** â identity â env â security â role â onboarding â evolved config â memory instructions â instructions â working memory â dynamic memory context. Use as blueprint for Jarvis system prompt.
3. **Three-tier vector memory (Episodic/Semantic/Procedural)** on Supabase pgvector â mirror Qdrant schema: named vectors for summary+detail, BM25 sparse, payload indexes on user_id/session/outcome/importance. Semantic contradiction detection at write time.
4. **Security wrapping for external messages** â bidirectional `[SECURITY]` bookends around every message from Slack/WhatsApp/Email channels before it hits the agent.
5. **Dangerous command blocker as PreToolUse hook** â regex blocklist on Bash (never the sole security layer, but catches mistakes).
6. **File tracker as PostToolUse hook on Edit|Write** â feeds session consolidation with `files_touched` payload.
7. **AES-256-GCM encrypted secret vault + magic-link form** â NEVER ask credentials in chat. Pattern: `collect_secret` â URL â encrypted store â `get_secret`.
8. **Session resumption with stale-session retry** â try `resume`, if "No conversation found" clear and retry fresh.
9. **Cross-model judge** â main on Opus 4.7, judges on Sonnet 4.6, triple-judge minority veto.
10. **Immutable constitution.md** â evolution engine sandbox-denies edits; invariant I2 does a byte-compare.
11. **Factory pattern for MCP server instances** â the SDK rejects reused McpServer across `query()` calls.
12. **Per-tool scope enforcement BEFORE transport** â clone request, inspect `params.name`, block if insufficient scope.
13. **Dynamic tool registry backed by SQL + shell/script handlers only** (no `new Function()`).
14. **`buildSafeEnv()` allowlist** â never leak `process.env` to subprocesses.
15. **Evolved config as 8 separate MD files** (constitution / persona / user-profile / domain-knowledge / strategies/*) â diffable, version-controlled, roll-backable.
16. **Degraded-mode memory** â if vector DB is down, silently no-op, never crash the agent.
17. **Concurrency guard Set on `channel:conversation` keys** to bounce double-fire.
18. **`persistSession: true` + `settingSources: ["project", "user"]`** in SDK query options â Jarvis should load project skills and user settings the same way.

### Integration points with Anthropic Managed Agents
Phantom uses the **local Agent SDK subprocess model**, not Managed Agents. To adapt to Managed Agents:
- Replace `query()` from `@anthropic-ai/claude-agent-sdk` with Managed Agents `sessions.create/messages/stream` â the 9-layer prompt assembler still applies as the session's `system_prompt`
- Evolved config files become Managed Agents **prompt versions** (see `CMA_prompt_versioning_and_rollback.ipynb`) â use `agents.update` + `sessions.create(version=N)` for rollback
- Memory system stays client-side (Supabase pgvector) â pre-query context enrichment injects recalled episodes/facts into the first user message
- Dynamic tools become Managed Agents **custom tools** registered at environment level
- MCP server remains client-side but is consumed by Managed Agent as an MCP toolset in environment config
- `reflection-subprocess.ts` pattern maps naturally to a separate Managed Agent session with its own sandboxed environment for config rewrites

### Key files referenced (absolute paths)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/CLAUDE.md` â single best document; internal architecture overview
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/agent/runtime.ts` â SDK wrapper, session mgmt
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/agent/prompt-assembler.ts` â 9-section prompt composition
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/agent/hooks.ts` â safety hooks
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/memory/system.ts` â memory coordinator
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/memory/episodic.ts` + `semantic.ts` + `procedural.ts` + `ranking.ts` + `consolidation.ts`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/evolution/engine.ts` â 6-step reflection
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/mcp/server.ts` + `auth.ts` + `dynamic-tools.ts`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/secrets/crypto.ts` â AES-GCM vault
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/src/config/providers.ts` â multi-provider support
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/config/roles/swe.yaml` â role template example
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/phantom-config/constitution.md` â immutable behavioral rules
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/phantom/docs/architecture.md`, `memory.md`, `self-evolution.md`, `security.md`, `mcp.md`

---

## 2. claude-agent-sdk-python/

**Repo root:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-python/`

### What it does
Official Anthropic Python SDK (Python 3.10+). Wraps the bundled Claude Code CLI as a subprocess. Exposes two APIs: `query()` (async-iterator, one-shot/streaming-unidirectional) and `ClaudeSDKClient` (bidirectional, stateful, supports interrupts + custom tools + hooks). Transport abstraction (`src/claude_agent_sdk/_internal/transport/subprocess_cli.py`) allows custom transports.

### Architecture patterns
- **`query()` is stateless, `ClaudeSDKClient` is stateful** â explicit design split in the code comments
- **In-process MCP servers** via `@tool` decorator + `create_sdk_mcp_server(...)` â no subprocess, direct Python function calls, type-safe
- `AgentDefinition` dataclass for subagents: `description`, `prompt`, `tools`, `disallowedTools`, `model` (alias like `"sonnet"/"opus"/"haiku"/"inherit"` OR full ID), `skills`, `memory` (`"user"/"project"/"local"`), `mcpServers`, `initialPrompt`, `maxTurns`, `background`, `effort` (`"low"/"medium"/"high"/"max"` or int), `permissionMode`
- **`PermissionMode`** literals: `default | acceptEdits | plan | bypassPermissions | dontAsk | auto`
- **`SystemPromptPreset`**: `{ type: "preset", preset: "claude_code", append?, exclude_dynamic_sections? }` â phantom uses this exactly. The `exclude_dynamic_sections` flag strips per-user dynamic content (cwd, auto-memory, git status) for prompt-cache-hit across users.
- **`SystemPromptFile`**: `{ type: "file", path }` â load system prompt from disk
- **`TaskBudget`** (`task-budgets-2026-03-13` beta): tells the model its remaining token budget so it paces tool use
- **`PermissionUpdate`** dataclass with `to_dict()` â runtime permission mutations: `addRules/replaceRules/removeRules/setMode/addDirectories/removeDirectories`, destinations `userSettings/projectSettings/localSettings/session`

### Patterns to adopt
1. Use **SystemPromptPreset with `exclude_dynamic_sections: true`** when you want prompt-cache to hit across users/sessions â the stripped content is re-injected in the first user message so the model still sees it
2. Use **AgentDefinition** for role/subagent templates (maps exactly to phantom's YAML roles, but in code)
3. Use **in-process MCP servers** (`@tool` + `create_sdk_mcp_server`) for any tool that's Python-native â zero IPC overhead, type-safe
4. **Permission mode model** (`acceptEdits`, `bypassPermissions`, `plan`, etc.) gives you runtime control without restarting â use `"plan"` mode for dry-runs, `"bypassPermissions"` only when VM-isolated
5. **Runtime `PermissionUpdate.addRules/setMode`** â lets the agent modify its own permissions per-session based on task class

### Integration with Managed Agents
Same SDK surface used for Managed Agents runtime. The `AgentDefinition` dataclass maps 1:1 to Managed Agent definitions. `mcp_servers` dict accepts both in-process SDK servers and remote URL/stdio configs â identical shape across both runtimes.

### Key files
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-python/src/claude_agent_sdk/query.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-python/src/claude_agent_sdk/client.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-python/src/claude_agent_sdk/types.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-python/src/claude_agent_sdk/_internal/transport/subprocess_cli.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-python/examples/mcp_calculator.py`

---

## 3. claude-agent-sdk-demos/

**Repo root:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-demos/`

### What it does
8 demo apps: `hello-world`, `hello-world-v2` (new V2 Session API with separate `send()`/`stream()`), `research-agent` (multi-agent orchestration), `email-agent` (IMAP + full-stack SPA), `excel-demo`, `resume-generator`, `simple-chatapp` (React + Express + WebSocket), `ask-user-question-previews` (HTML option cards via `previewFormat: "html"`).

### Architecture patterns (from `research-agent/research_agent/agent.py`)
- **Lead agent + specialized subagents pattern** â one `ClaudeSDKClient` with `allowed_tools=["Task"]` spawns subagents via the Task tool
- Subagents defined via `AgentDefinition` dict with distinct prompts, tool allowlists, and models (researcher/data-analyst/report-writer â all on `haiku` for cost)
- **File-based inter-agent communication**: researcher writes to `files/research_notes/`, data-analyst reads/writes `files/data/` + `files/charts/`, report-writer reads all + writes `files/reports/`. Filesystem IS the message bus.
- `SubagentTracker` uses PreToolUse + PostToolUse hooks with `matcher=None` (match all) to track subagent activity into JSONL
- `TranscriptWriter` writes session transcript to disk in parallel to stdout
- `setting_sources=["project"]` loads skills from `.claude/` directory
- Email-agent demo: agent-side tool-call streaming over WebSocket to React client (spec in `LISTENERS_SPEC.md`, `UI_STATE_COMPONENTS_SPEC.md`)

### Patterns to adopt
1. **Lead-agent + subagents with file-based IPC** â cleaner than event passing, gives natural audit trail. Subagents don't need to know about each other, just about directory conventions.
2. **Hooks with `matcher=None`** for global tool-use tracking (observability, cost, audit)
3. **Separate TranscriptWriter** that writes to file independently of the SDK message stream â always have a post-mortem artifact
4. **AgentDefinition + "Task" as only allowed tool on lead** â forces delegation, prevents lead from doing work itself
5. **Haiku for specialists, Opus for orchestrator** â cost discipline pattern

### Integration with Managed Agents
The research-agent multi-agent pattern maps to Managed Agents' subagent feature (multi-session with per-agent sandboxed environments). File-based IPC becomes **resources** in Managed Agents (mounted files + `sessions.resources.add` at runtime).

### Key files
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-demos/research-agent/research_agent/agent.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-demos/research-agent/research_agent/prompts/*.txt`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-demos/email-agent/LISTENERS_SPEC.md`, `UI_STATE_SYSTEM.md`, `recursive-code-generation.md`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-demos/simple-chatapp/`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-agent-sdk-demos/hello-world-v2/` (V2 session API)

---

## 4. claude-cookbooks/

**Repo root:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/`

### What it does
Official production-pattern notebooks. Most important directories for our stack:
- `managed_agents/` â 9 notebooks on **Claude Managed Agents** (the runtime our ecosystem targets)
- `claude_agent_sdk/` â 6 notebooks (one-liner research, chief-of-staff, observability, SRE, migrating-from-openai, session-browser)
- `patterns/agents/` â 3 foundational patterns: `basic_workflows.ipynb`, `evaluator_optimizer.ipynb`, `orchestrator_workers.ipynb`
- `extended_thinking/`, `multimodal/`, `tool_use/`, `skills/`, `observability/`

### Architecture patterns

**Managed Agents core concepts** (from `managed_agents/README.md`):
- **Agent + Environment + Session** trinity: define agent (prompt, tools, model) + sandboxed environment (files, tools, resources) once â run sessions that persist files + tool state + conversation across turns
- `agents.update` + **prompt versioning** â `sessions.create(version=N)` pins sessions to specific prompt versions â A/B + rollback without code deploys
- **`session.status_idled` webhook** pattern for HITL (human-in-the-loop) without long-lived connections â agent idles awaiting decision, webhook fires when state changes
- **Custom tool round-trip**: `requires_action` idle-bounce + `decide()/escalate()` pattern for gated approvals + parallel-tool-call dedup
- **`utilities.stream_until_end_turn`** â canonical streaming event loop factored into shared helper. Everyone uses it except gate.ipynb (needs `requires_action` handling)
- **Resources** (mounted files) vs **`github_repository` resource** (live repo) â swap for local dev vs prod
- **Vaults** for per-end-user credentials (server-side encrypted, referenced by ID in agent code)
- **MCP toolsets** at environment level â agent inherits all MCP tools from the env

**Three foundational agent patterns** (`patterns/agents/`):
1. **Basic workflows** â prompt chaining, routing, parallelization
2. **Evaluator-Optimizer** â one LLM generates, another evaluates, iterate until quality gate passes
3. **Orchestrator-Workers** â lead plans + dispatches, workers execute in parallel

**Claude Agent SDK cookbooks** (`claude_agent_sdk/`):
- `00_The_one_liner_research_agent.ipynb` â minimum viable agent in <20 lines
- `01_The_chief_of_staff_agent.ipynb` â personal orchestrator pattern (calendar, email, tasks)
- `02_The_observability_agent.ipynb` â agent reading logs/metrics/traces
- `03_The_site_reliability_agent.ipynb` â incident response workflow
- `05_Building_a_session_browser.ipynb` â inspect/replay SDK sessions

### Patterns to adopt
1. **Prompt versioning + session version pinning** for Jarvis' evolved config â every evolution cycle = new prompt version on Managed Agents side, rollback = pin sessions to v(N-1)
2. **`session.status_idled` + webhook** for HITL approvals â use this in BAM/Legal/Finance skills that need human gate before execution
3. **Evaluator-Optimizer** for content generation skills (marketing, copywriting) â Opus generates, Sonnet judges, iterate N times
4. **Orchestrator-Workers** for research/sales-enablement (lead decomposes â parallel Haiku workers â lead synthesizes)
5. **Vaults for per-end-user credentials** â map to Supabase RLS-protected user_credentials table; Managed Agent receives token-scoped reference, never raw secret
6. **MCP toolsets at environment level** â register our ecosystem MCPs (Supabase, GitHub, n8n, WhatsApp, etc.) once per environment
7. **Resources.add at runtime** for dynamic file injection (user uploads, fetched docs)
8. **Stream-until-end-turn helper** â factor our Jarvis SSE loop the same way
9. **Custom-tool `decide()/escalate()` round-trip** â standard pattern for approvals

### Integration with Managed Agents
THIS IS the Managed Agents playbook. Every pattern translates directly.

### Key files
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/managed_agents/README.md`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/managed_agents/CMA_iterate_fix_failing_tests.ipynb` (entry point)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/managed_agents/CMA_operate_in_production.ipynb` (MCP toolsets, vaults, webhooks, resource lifecycle)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/managed_agents/CMA_prompt_versioning_and_rollback.ipynb`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/managed_agents/CMA_gate_human_in_the_loop.ipynb`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/managed_agents/utilities.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/patterns/agents/{basic_workflows,evaluator_optimizer,orchestrator_workers}.ipynb`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/claude-cookbooks/claude_agent_sdk/*.ipynb`

---

## 5. mem0/

**Repo root:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/`

### What it does
Production memory layer. v3 (April 2026) hits **91.6 LoCoMo, 93.4 LongMemEval** with single-pass retrieval. Polyglot monorepo: Python SDK (`mem0/`), TS SDK (`mem0-ts/`), hosted `MemoryClient` + self-hosted `Memory`. Claims 24 LLMs, 30 vector stores, 15 embeddings, 4 graph stores, 5 rerankers via uniform provider pattern.

### Architecture patterns

**v3 algorithm breakthrough** (from README):
- **Single-pass ADD-only extraction** â one LLM call, no UPDATE/DELETE. Memories accumulate; nothing is overwritten. (Massive simplification vs v2's dual-pass CRUD.)
- **Agent-generated facts are first-class** â when an agent confirms an action, that info is stored with equal weight to user-stated facts
- **Entity linking** â entities extracted, embedded, and linked across memories for retrieval boosting
- **Multi-signal retrieval** â semantic + BM25 keyword + entity matching, scored in parallel and fused

**Code-level** (from `mem0/memory/main.py`):
- `Memory` + `AsyncMemory` sync/async pair with identical API
- Uniform API: `add(messages, *, user_id, agent_id, run_id, metadata)`, `search(query, *, filters, limit)`, `get/get_all/update/delete/delete_all/history`
- **`ENTITY_PARAMS` validation** â `user_id/agent_id/run_id` MUST be passed via `filters={}`, not top-level. `_reject_top_level_entity_params()` raises ValueError otherwise.
- **3-tier sensitive-field detection** for telemetry: `_RUNTIME_FIELDS` allowlist (auth objects like `AWSV4SignerAuth` â preserved) â `_SENSITIVE_FIELDS_EXACT` denylist â `_SENSITIVE_SUFFIXES` pattern match (`_password`, `_secret`, `_token`, etc.)
- **`_safe_deepcopy_config()`** â falls back to `model_dump()` then `__dict__` when deepcopy fails on non-serializable objects
- Scoring pipeline: `utils/scoring.py` with `ENTITY_BOOST_WEIGHT`, `get_bm25_params`, `normalize_bm25`, `score_and_rank` â transparent, tunable
- Entity extraction: `utils/entity_extraction.py` with `extract_entities` + `extract_entities_batch`
- `cookbooks/`, `examples/` (Chrome extension, multi-agent), `evaluation/` (LoCoMo benchmarks reproducible)
- MCP integration: `openmemory/api/` exposes 9 MCP tools (`add_memory`, `search_memories`, `get_memories`, `get_memory`, `update_memory`, `delete_memory`, `delete_all_memories`, `delete_entities`, `list_entities`). `mem0-plugin/` wires Claude Code + Cursor + Codex via MCP + lifecycle hooks.

### Patterns to adopt
1. **Single-pass ADD-only extraction** as default mem0 v3 pattern â no UPDATE/DELETE in hot path. Semantic contradiction becomes a versioning problem (phantom pattern) not an overwrite problem.
2. **Strict entity-scoping via `filters={}` (not kwargs)** â architecturally forbids accidentally dropping the user_id and leaking cross-tenant memories. Copy this validation directly.
3. **3-tier sensitive-field detection** for any telemetry/logging layer â runtime-allowlist â exact-denylist â suffix-denylist
4. **Multi-signal retrieval fusion** (semantic + BM25 + entity) â matches phantom's hybrid pattern, plus entity boost
5. **`agent_id/user_id/run_id` triad** as the universal memory scope â adopt these three names across our ecosystem for consistency (Jarvis sessions become `run_id`)
6. **Uniform provider pattern** (`base.py` abstract + `configs.py` Pydantic + `__init__.py` registry) for ALL pluggable components â use this for our LLM/storage/auth adapters
7. **9 canonical memory MCP tools** â wire these into our Jarvis MCP endpoint
8. **OpenMemory architecture** â FastAPI + Alembic + MCP + Qdrant + Next.js 15 UI. This is the open-source reference for a memory-as-a-service we can self-host on Railway.

### Integration with Managed Agents
- Wire `mem0ai` Python SDK into Jarvis agent code as the memory layer â `Memory.add()` after each session, `Memory.search()` into system prompt on next session
- Alternatively: deploy `openmemory/api/` on Railway (FastAPI + Qdrant), register it as **MCP toolset** in Managed Agents environment â agent calls `add_memory/search_memories` as native tools
- `MemoryClient` (hosted) is the drop-in if we don't want to self-host â just `MEM0_API_KEY` env var

### Key files
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/mem0/memory/main.py` â core `Memory` class
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/mem0/memory/base.py` â abstract
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/mem0/configs/prompts.py` â `ADDITIVE_EXTRACTION_PROMPT`, `generate_additive_extraction_prompt`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/mem0/utils/scoring.py`, `entity_extraction.py`, `factory.py`, `lemmatization.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/mem0/memory/storage.py` (SQLiteManager)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/openmemory/api/` (FastAPI + MCP + Alembic migrations)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/mem0-plugin/` (Claude Code MCP integration + lifecycle hooks)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/mem0/LLM.md`, `CLAUDE.md` â project map
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/mem0/MIGRATION_GUIDE_v1.0.md`, v2âv3 migration

---

## 6. letta/ (formerly MemGPT)

**Repo root:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/`

### What it does
Stateful agents framework. Postgres + pgvector + Alembic migrations. REST API via FastAPI (`letta/server/`), SDK in Python + TS. Multiple agent classes: `letta_agent.py`, `letta_agent_v2.py`, `letta_agent_v3.py`, `voice_agent.py`, `voice_sleeptime_agent.py`, `ephemeral_agent.py`. Uses OpenAI-compatible tool-call protocol (`openai.types.beta.function_tool.FunctionTool`).

### Architecture patterns (from `letta/agent.py`)

**MemGPT-style memory blocks** â from the README example:
```python
memory_blocks=[
  { "label": "human", "value": "Name: Timber. Status: dog..." },
  { "label": "persona", "value": "I am a self-improving superintelligence..." },
]
```
These are **in-context, always-present blocks** the agent can read AND edit via tools. Unlike mem0's retrieval-based model, Letta keeps core memory in the context window.

**Core concepts** (from code):
- `BaseAgent` ABC â `LettaAgent` / `LettaAgentV2` / `LettaAgentV3` â progressive refactors coexist
- **`ToolRulesSolver`** + `TerminalToolRule` â declarative tool-call constraints (e.g., "after tool X, must call send_message" or "tool Y is terminal")
- **`ContextWindowOverview`** + `summarize_messages` + `calculate_summarizer_cutoff` â automatic context-window management; when near limit, summarizes oldest messages
- `is_context_overflow_error` + `ContextWindowExceededError` â graceful recovery pattern
- `Block` / `BlockUpdate` / `BlockManager` â memory blocks as first-class entities with RBAC (`READ_ONLY_BLOCK_EDIT_ERROR`)
- **Services split**: `AgentManager`, `BlockManager`, `MessageManager`, `PassageManager` (archival memory), `StepManager`, `JobManager`, `ProviderManager`, `ToolManager`, `TelemetryManager`
- **`ToolExecutionSandbox`** â tools run in isolated subprocess with env scoping
- **OTel tracing** baked in (`otel/tracing.py`, `@trace_method`, `log_event`)
- Heartbeat pattern: `REQ_HEARTBEAT_MESSAGE`, `FUNC_FAILED_HEARTBEAT_MESSAGE`, `get_heartbeat` â agent can schedule itself to wake up
- **Composio integration** (`composio_helpers.py`) â 250+ external tool providers
- **Voice agents** + "sleeptime" pattern (agent wakes periodically to consolidate)
- `agents/agent_loop.py` is the main turn loop; `letta_agent_v3.py` is the current recommended class

### Patterns to adopt
1. **Memory blocks in context (`human`, `persona`, `system`)** â complement retrieval-based memory with always-loaded core blocks. Phantom's `persona.md` + `user-profile.md` play this role. Letta formalizes it as structured blocks with per-block RBAC.
2. **`ToolRulesSolver` + `TerminalToolRule`** â declarative "after X must call Y" and "Y ends turn" â cleaner than prompt-engineering the order
3. **Automatic context-window summarization** when near limit, with `ContextWindowExceededError` graceful recovery â implement at Jarvis session level
4. **Heartbeat / self-scheduling** â agent can schedule its own future execution (maps to phantom's `phantom_schedule` but from within agent memory)
5. **Sleeptime agent pattern** â periodic consolidation wake-up that processes recent episodes into long-term memory. Runs during idle periods. Maps to phantom's session-end reflection but continuous.
6. **Services split** (AgentManager/BlockManager/MessageManager/PassageManager/StepManager/JobManager/ToolManager/TelemetryManager) as microservice boundaries â adopt this taxonomy for our Jarvis backend services layer
7. **ToolExecutionSandbox** â subprocess isolation for tool execution, env-scoped
8. **Multiple agent classes coexisting** (`v1`, `v2`, `v3`) with shared `BaseAgent` â enables progressive evolution without forced migration
9. **OTel tracing at method level** via `@trace_method` decorator â bake in from day 1

### Integration with Managed Agents
Letta is a *competitor* runtime to Managed Agents. But the **service split taxonomy** is reusable. Memory blocks can be implemented as Managed Agents environment files (mounted at `/agent/memory/human.md`, `/agent/memory/persona.md`) that the agent edits with Read/Write/Edit tools â same UX as Letta blocks, runs on Managed Agents.

### Key files
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/agent.py` â BaseAgent + LettaAgent
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/agents/letta_agent_v3.py` â current recommended class
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/agents/agent_loop.py` â turn loop
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/agents/voice_sleeptime_agent.py` â periodic consolidation
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/helpers/` (ToolRulesSolver, message_helper, datetime_helpers)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/services/` (AgentManager, BlockManager, MessageManager, PassageManager, StepManager, JobManager, ToolManager, tool_executor/tool_execution_sandbox.py)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/schemas/` (agent.py, block.py, memory.py, tool_rule.py)
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/letta/prompts/prompt_generator.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/alembic/versions/` â DB migration pattern
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/letta/compose.yaml` â Postgres/pgvector Docker deploy

---

## 7. fastmcp/

**Repo root:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/`

### What it does
Pythonic MCP framework, v3.x. Downloaded 1M/day, powers 70% of MCP servers across all languages. FastMCP v1 was upstreamed into the official MCP Python SDK. Three pillars: **Servers** (expose tools/resources/prompts), **Apps** (interactive UIs in-conversation), **Clients** (connect to any MCP server).

### Architecture patterns (from `src/fastmcp/server/server.py` + CLAUDE.md)

**Core MCP objects** (`src/fastmcp/{tools,resources,prompts}/`):
- Tools, Resources, ResourceTemplates, Prompts â all inherit from **`FastMCPComponent`** (`src/fastmcp/utilities/components.py`)
- Shared fields: `name`, `version`, `tags`, `meta`, and canonical `key` property (encodes type + identifier + version). Always use `item.key` for dedup/lookup/identity â not ad-hoc name fallbacks.

**Server (`FastMCP` class in `server.py`)**:
```python
mcp = FastMCP("Demo ð")
@mcp.tool
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b
mcp.run()
```
Schema + validation + docs generated from type hints + docstrings automatically.

**Key components** (`src/fastmcp/server/`):
- `auth/` â `AuthProvider`, `AuthCheck`, `AuthContext`, `run_auth_checks` â pluggable auth
- `middleware/` â error handling, logging, rate limiting, tracing
- `lifespan.py` â startup/shutdown lifecycle with `AsyncIterator[LifespanResultT]`
- `providers/` â `LocalProvider`, `AggregateProvider`, `FastMCPProxy`, OpenAPI provider, ComponentFn/RouteMap for auto-generating MCP from OpenAPI specs
- `transforms/` â `ToolTransform`, `apply_session_transforms`, visibility gates (enable tools per-session based on auth context)
- `tasks/` â `TaskConfig`, `TaskMeta` â long-running tasks
- `apps/` â interactive UIs (cards rendered in conversation via `previewFormat: "html"`)
- `proxy.py` â proxy one MCP server through another (useful for auth injection, logging, aggregation)
- `elicitation.py` â MCP elicitation protocol (agent asks user for structured input)
- `sampling/` â agent sampling requests through the server
- `event_store.py` â MCP event persistence
- `telemetry.py` â `server_span` OTel integration
- `experimental/` â new features before stabilization

**Client (`src/fastmcp/client/`)** â full protocol support, multi-transport (stdio, SSE, streamable HTTP, in-process)

**Mcp Config**:
- `mcp_config.py` â `MCPConfig` parses standard `.mcp.json` format
- Connect to server by URL â transport negotiation + auth + protocol lifecycle automatic

### Patterns to adopt
1. **Use FastMCP for every in-process MCP server** we write â it gives us `@mcp.tool`/`@mcp.resource`/`@mcp.prompt` decorators, auto-schema from type hints, shared `FastMCPComponent.key` identity, middleware, auth, proxy, OpenAPI auto-gen for free. This is the standard â Anthropic's own SDK includes FastMCP v1.
2. **`FastMCPComponent.key` for identity** â never use `name or uri or name+version` ad-hoc; use `.key`. Resource/ResourceTemplate overrides handle URI-based identity, version suffix prevents false collisions.
3. **`AuthProvider` + `AuthCheck` + `run_auth_checks`** â build our ecosystem auth (Supabase JWT, owner token, scope-based) as FastMCP AuthProvider subclasses â plugs into every MCP server uniformly.
4. **Middleware stack** (logging/rate-limit/errors/tracing) â standardize across all our MCP servers.
5. **OpenAPI provider** (`providers/openapi/`) â auto-generate MCP tools from any OpenAPI spec. Use to expose Stripe, Supabase REST, Vercel, n8n, etc. as MCP without writing wrappers.
6. **`FastMCPProxy`** â wrap third-party MCP servers with auth injection + logging + rate limiting before exposing them to our agents.
7. **`ToolTransform` + `apply_session_transforms` + visibility gates** â per-session tool allowlists based on auth context. Huge for RBAC (Marcelo gets all tools, client gets read-only subset).
8. **`elicitation`** â standard protocol for agentâuser structured Q&A. Use for onboarding flows (instead of phantom's custom form pattern) when running over MCP.
9. **Prefect Horizon** â free hosting for FastMCP servers (per README) â alternative to Railway for MCP-specific workloads.
10. **`experimental/`** area â gate unstable features explicitly, don't mix with core API.

### Integration with Managed Agents
Managed Agents accept MCP servers as environment-level toolsets. **Every FastMCP server we build plugs into Managed Agents via stdio/streamable-HTTP transport with zero glue code**. This is the recommended pattern for exposing our ecosystem's custom tools (Jarvis skills, Supabase access, WhatsApp, real-estate calculators, etc.) to Managed Agents.

### Key files
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/CLAUDE.md` â dev guide + patterns
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/server/server.py` â FastMCP class
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/utilities/components.py` â `FastMCPComponent` + `.key`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/server/auth/` â AuthProvider pattern
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/server/middleware/`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/server/providers/openapi/` â OpenAPIâMCP auto-gen
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/server/proxy.py` â FastMCPProxy
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/server/transforms/` â per-session visibility
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/src/fastmcp/mcp_config.py`
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/examples/` â runnable demos
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/fastmcp/v3-notes/` â v3 design docs

---

## Cross-cutting "Steal These" Priority List for V9 Masterplan

**Top 10 to steal immediately for Jarvis:**

1. **Phantom's 9-layer prompt-assembler** with evolved-config MD files (constitution/persona/user-profile/domain-knowledge/strategies/*) â the gold standard for long-lived agent identity
2. **Phantom's Cardinal Rule** ("TypeScript/Python is plumbing, Agent SDK is the brain") as the first line of our CLAUDE.md
3. **Phantom's bidirectional `[SECURITY]` message wrapping** for all external channels
4. **Phantom's AES-256-GCM secret vault + magic-link form** â never accept credentials in chat
5. **Phantom's dangerous-command PreToolUse hook + file-tracker PostToolUse hook**
6. **Mem0 v3's single-pass ADD-only extraction** + multi-signal retrieval (semantic + BM25 + entity) + strict `filters={user_id, agent_id, run_id}` scoping
7. **Cookbook Managed Agents prompt versioning + `session.status_idled` webhook HITL** as the canonical evolution + approval pattern
8. **Cookbook Evaluator-Optimizer + Orchestrator-Workers** for content/research/sales skills
9. **FastMCP as THE framework for every MCP server we build** + `FastMCPComponent.key` identity + `AuthProvider` + OpenAPI auto-gen + `FastMCPProxy` for third-party wrapping
10. **Letta's memory blocks + ToolRulesSolver + sleeptime consolidation agent** + services split taxonomy

**Top 5 architectural decisions:**
1. **Managed Agents as runtime** (cookbooks are the playbook) + **FastMCP for tools** (v3 is standard) + **Mem0/OpenMemory for memory** (v3 benchmarks justify) + **Phantom's patterns for security/identity/evolution** (Apache-2.0, directly adoptable) + **Letta's services split + memory blocks in context**
2. **Monorepo structure per mem0's polyglot pattern** â separate workspaces for Python SDK, TS SDK, server (FastAPI on Railway), UI (Next.js)
3. **Supabase pgvector replaces Qdrant** in phantom's three-tier memory (preserve named vectors + sparse BM25 schema)
4. **Per-project DBs + ECOSYSTEM shared DB** aligns with mem0's `user_id/agent_id/run_id` triad â `agent_id` = project
5. **Jarvis 4-stage evolution** maps onto phantom's enqueueIfWorthy â queue â drain â reflection subprocess + cookbook's prompt-version rollback

