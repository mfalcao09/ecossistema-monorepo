# Análise Profunda — Multi-Agent + Voice + Observability (8 repos, código real)

> crewAI, openai-agents-python, langgraph, a2a-python, langfuse, litellm, livekit/agents, pipecat

I have enough to produce the comprehensive analysis. Here's the deep-analysis report:

---

# Deep Research: Multi-Agent Orchestration + Voice + Observability Layer

## 1. crewAI

**What it actually does:** Role-based multi-agent orchestration framework. Agents have `role/goal/backstory` personas, execute discrete `Tasks` via a `Crew` that coordinates them in sequential or hierarchical `Process` modes. Emphasizes developer ergonomics and "autonomy + collaborative intelligence."

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/crewAI/lib/crewai/src/crewai/`

**Key architecture patterns:**
- `Crew` (Pydantic `BaseModel`, 2,276 lines in `crew.py`) holds `tasks: list[Task]`, `agents: list[BaseAgent]`, and a `process: Process` enum (`sequential | hierarchical`).
- `Process` is a trivial string-enum (`process.py`, 11 lines) â orchestration is hard-coded per enum value via `_run_sequential_process()` and `_run_hierarchical_process()` branches inside `Crew.kickoff()`.
- Hierarchical mode auto-creates a Manager Agent (`_create_manager_agent`) with `AgentTools(agents=self.agents).tools()` â manager gets sub-agents *as tools it can call*.
- `_execute_tasks()` supports async tasks via `concurrent.futures.Future`, with batching: it queues async tasks until a sync task forces a drain (`_process_async_tasks`).
- Event-driven internals: `crewai_event_bus` with typed events (`CrewKickoffCompletedEvent`, `TaskCompletedEvent`, etc.) â all observability/tracing goes through this bus.
- First-class concerns baked in: `Memory | MemoryScope | MemorySlice`, `Knowledge` (RAG), `SecurityConfig + Fingerprint`, `CheckpointConfig`, `Skill` activation, `Guardrail`, `RPMController`.
- Checkpointing: `_get_execution_start_index` scans tasks for `output is None` to resume from last completed task.
- **Flows** (separate `crewai/flow/`) is the "enterprise production architecture" â event-driven graph on top of Crews, positioned as competitor to LangGraph.

**Patterns worth adopting:**
- Role/goal/backstory persona pattern â concrete, readable, easy to serialize as YAML/DB rows.
- Event bus decoupling (no direct telemetry calls in core logic).
- Manager agent auto-synthesis where sub-agents become tools.
- Checkpoint-by-resume-from-first-unfinished-task â dead simple vs. graph checkpointers.

**Comparison note:** Out of the three orchestrators, crewAI is the most *opinionated* and *highest-level* â you don't compose graphs, you declare a crew and it runs.

---

## 2. openai-agents-python

**What it actually does:** Successor to OpenAI's Swarm. Minimal primitive set â `Agent`, `Handoff`, `Tool`, `Session`, `Runner` â centered on the OpenAI Responses API. Targets agent loops with tool calls + delegation, optional realtime (voice).

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/openai-agents-python/src/agents/`

**Key architecture patterns:**
- `Agent` is a `@dataclass` (not Pydantic) with generic `TContext` â context is a mutable user object passed to tools/handoffs/guardrails (`agent.py:156,222`).
- Clean separation `AgentBase` â `Agent` / `RealtimeAgent` â `realtime/agent.py` intentionally strips `model`, `model_settings`, `output_type`, `tool_use_behavior` because a single realtime model owns the session.
- **Handoffs** (`handoffs/__init__.py`) are first-class â `Handoff` is frozen dataclass with `input_history`, `pre_handoff_items`, `new_items`; includes `HandoffInputFilter` for transcript filtering on delegation.
- `tool_use_behavior` union: `"run_llm_again" | "stop_on_first_tool" | StopAtTools | Callable` â same agent class handles all termination strategies.
- **Session** (`memory/session.py`): `runtime_checkable` `Protocol` with `get_items / add_items / pop_item / clear_session` â the SESSION-AS-PROTOCOL pattern. Concrete impls: `SQLiteSession` (with per-file `threading.RLock` registry, WAL mode), `OpenAIConversationsSession`, `OpenAIResponsesCompactionSession` (server-side memory compaction).
- `MCPServer` list on every `AgentBase`; tools auto-fetched each run via `get_mcp_tools()`.
- Guardrails: `input_guardrail` runs only first turn on starting agent; `output_guardrail` runs on final output.
- **Run orchestration split**: `run.py` is the public faÃ§ade; real logic is in `run_internal/` (`run_loop.py`, `turn_resolution.py`, `tool_execution.py`, `session_persistence.py`). `RunState` is versioned (`CURRENT_SCHEMA_VERSION` + `SCHEMA_VERSION_SUMMARIES`) so sessions survive SDK upgrades.

**Patterns worth adopting:**
- `Session` as `Protocol` â lets each business unit in the ecosystem ship its own backend (Supabase, Postgres, Redis) without subclassing.
- Versioned `RunState` schema for durable session resume.
- `Handoff` with `input_history` + `HandoffInputFilter` â clean primitive for delegation with transcript rewriting.
- Keep the `run.py` faÃ§ade thin; push logic into `run_internal/`.

---

## 3. langgraph

**What it actually does:** Low-level graph/channel runtime for stateful multi-actor agents. Think "Pregel for LLM workflows" â nodes communicate via shared state channels with reducers; compiled graph supports checkpointing, interrupts, time-travel, streaming.

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/langgraph/libs/langgraph/langgraph/`

**Key architecture patterns:**
- `StateGraph` (`graph/state.py`) is a builder; you must `.compile()` â `CompiledStateGraph` (a `Pregel` instance).
- State is defined as a `TypedDict` or Pydantic model; each key may be `Annotated[type, reducer]` â reducers merge parallel writes (the Pregel BSP model).
- **Channels** (`channels/`): `LastValue`, `LastValueAfterFinish`, `BinaryOperatorAggregate`, `EphemeralValue`, `NamedBarrierValue`. Each channel has monotonic versions â `versions_seen` map per-node drives "which nodes run next."
- **Pregel runtime** (`pregel/_loop.py`, `_runner.py`, `_algo.py`): classic step/superstep BSP. Each step writes a `Checkpoint`.
- `Checkpoint` TypedDict: `v, id, ts, channel_values, channel_versions, versions_seen, updated_channels` â the ID is monotonic so you can sort/replay.
- `CheckpointMetadata.source â {"input","loop","update","fork"}` enables forking/time-travel.
- **Postgres checkpointer** (`checkpoint-postgres/postgres/__init__.py`): uses `psycopg3 ConnectionPool`, `dict_row`, optional `Pipeline` mode for batching, embedded `MIGRATIONS` list replayed on `setup()`, `JsonPlusSerializer` (custom encoder) with optional `EncryptedSerializer` wrapping.
- Both sync and async (`aio.py`) and a `ShallowPostgresSaver` that stores only the latest state (no history).
- **Prebuilt** (`libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py`): the famous `create_react_agent` uses `ToolNode` + `StateGraph` with `messages: Annotated[Sequence[BaseMessage], add_messages]`.

**Patterns worth adopting:**
- Typed state + channel reducers is the cleanest model for parallel sub-agents merging results.
- Monotonic checkpoint IDs + `source` enum = free time-travel and replay for free.
- MIGRATIONS list stored in the saver itself (no Alembic dependency for checkpoint tables).
- Encrypted serializer wrapper pattern â decouple wire format from encryption.

---

## Orchestrator comparison: crewAI vs openai-agents-python vs langgraph

| Axis | crewAI | openai-agents-python | langgraph |
|---|---|---|---|
| **Primary abstraction** | `Crew` of Agents + Tasks | `Agent` + `Handoff` + `Session` | `StateGraph` of nodes + channels |
| **Level** | High (declarative) | Mid (loop primitives) | Low (graph runtime) |
| **Agent definition** | Pydantic, role/goal/backstory | `@dataclass`, generic `TContext` | Just a callable node `State -> Partial<State>` |
| **Control flow** | Enum (`sequential`, `hierarchical`) hard-coded | `Runner` loop + `Handoff` + `tool_use_behavior` | Edges + conditional branches + `Command`/`Send` |
| **Memory** | `Memory | MemoryScope | MemorySlice` baked in | `Session` Protocol (SQLite, OpenAI Conversations) | `Checkpointer` Protocol + state channels |
| **Persistence** | `CheckpointConfig` (resume-at-task) | `RunState` serialization (versioned schema) | Full per-step checkpoints with fork/replay |
| **Tracing** | Internal event bus (`crewai_event_bus`) | Built-in tracing spans (`tracing/spans`) | `RunnableConfig` + LangSmith ecosystem |
| **DB backend** | AMP cloud (proprietary) | BYO Session impl | `PostgresSaver`, `SqliteSaver`, Redis (community) |
| **Parallelism** | `async_execution=True` on tasks (Future batching) | Run multiple agents; handoffs serialize | Native: channels merge parallel node writes via reducers |
| **Human-in-loop** | Ad-hoc callbacks | `ToolApprovalItem`, MCP approval | First-class: `interrupt()`, resume-from-checkpoint |
| **Best for ecosystem** | Fast vertical-specific crews (e.g. "research â draft â review" for a content business) | Voice/realtime + OpenAI-heavy, clean Protocol-based memory | Long-running stateful Jarvis with rewind/fork |

**Recommendation for V9 ecosystem:** crewAI for opinionated vertical crews (quick wins per business unit), langgraph for the Jarvis meta-layer (where you need checkpoint/replay/fork for long-running tasks), openai-agents `Session` protocol as reference for the Supabase-backed session interface.

---

## 4. a2a-python (Agent2Agent Protocol SDK)

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/a2a-python/src/a2a/`

**What it does:** Reference Python implementation of the A2A Protocol (v0.3 spec, v1.0-alpha in `1.0-dev` branch) â a transport-agnostic way to run agentic apps behind a standard interface (JSON-RPC, REST, gRPC all supported).

**Key architecture patterns:**
- `AgentExecutor` (ABC at `server/agent_execution/agent_executor.py`) is the whole developer contract â just two methods: `async execute(context, event_queue)` and `async cancel(context, event_queue)`. The agent pushes `Task` / `Message` / `TaskStatusUpdateEvent` / `TaskArtifactUpdateEvent` onto the queue.
- `RequestContext` carries the inbound message + task ID; `EventQueue` is the outbound stream â pure decoupling, no return values.
- `server/tasks/`: `TaskManager`, `TaskStore` (abstract) with `InMemoryTaskStore` + `DatabaseTaskStore`, `TaskUpdater`, `ResultAggregator`, `PushNotificationConfigStore` (in-memory + DB), `PushNotificationSender`.
- `server/apps/` has separate `jsonrpc` and `rest` sub-trees â the same `AgentExecutor` is exposed over three transports.
- Extras: `[postgresql]`, `[mysql]`, `[sqlite]` (via SQLAlchemy-style), `[grpc]`, `[telemetry]` (OpenTelemetry), `[encryption]`, `[vertex]` (Vertex AI task store).

**Patterns worth adopting for ecosystem:**
- **Inter-business agent communication:** if ColÃ©gio KlÃ©sis agent needs to call Intentus Real Estate agent, A2A gives you a neutral protocol â no framework lock-in.
- The `AgentExecutor(execute, cancel)` with `EventQueue` is a *great* shape for long-running tasks with SSE progress streaming.
- Pluggable `TaskStore` â map directly to the Supabase `tasks` table in the ecosystem.

---

## 5. langfuse

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/langfuse/`

**What it does:** Open-source LLM observability/evals platform. Captures traces, observations (spans/generations), scores, prompts, evaluations. Self-hostable.

**Architecture (from CLAUDE.md + dir inspection):**
- **Monorepo (pnpm + turborepo):** `web/` (Next.js app â UI + tRPC + public REST API), `worker/` (queue consumers), `packages/shared/` (domain, DB contracts, repos), `ee/` (enterprise), `fern/` (API defs â generated clients).
- **Dual DB:** Postgres (via Prisma, `packages/shared/prisma/schema.prisma`) for metadata + config; **ClickHouse** for high-volume trace/observation/score data (migrations under `packages/shared/clickhouse/migrations/{clustered,unclustered}`). Domain models live in `packages/shared/src/domain/{observations,traces,scores}.ts`.
- **Ingestion path:** HTTP â Next.js API route (`web/src/pages/api/public/...`) â enqueue on a Redis/BullMQ queue (`ingestionQueue`, `otelIngestionQueue`) â worker consumes (`worker/src/queues/ingestionQueue.ts` and processors) â writes to ClickHouse. This write-path split is the critical pattern for scale.
- **Worker queues** (`worker/src/queues/`): 20+ queues â `ingestionQueue`, `evalQueue`, `experimentQueue`, `traceDelete`, `batchExportQueue`, `dataRetentionQueue`, `eventPropagationQueue`, `webhooks`, plus integrations (`mixpanel`, `postHog`, `blobStorage`).
- Public API surface is defined in `fern/` (OpenAPI/proto) and regenerated into `generated/` â **never hand-edited**, which is the right discipline for SDK compatibility.

**Patterns worth adopting:**
- **Postgres for metadata, ClickHouse (or Timescale/DuckDB) for traces** â do NOT try to put LLM trace volume on regular Postgres.
- **Decouple ingestion from write** via BullMQ/Redis â request returns fast, background worker batches into analytical store.
- **Schema contract in one package** (`packages/shared`) with zero upward imports â identical pattern to your ECOSYSTEM shared DB.
- **Fern-driven APIs** â typed clients for free across TS/Python/Go/etc.
- **Compatibility symlink** (`CLAUDE.md` â `AGENTS.md`) so any agent tool finds the root docs.

**For V9 ecosystem:** This is the blueprint for your observability layer. You can self-host langfuse directly on Railway and have every Jarvis call, every crew kickoff, every litellm call traced into it via the Langfuse SDK.

---

## 6. litellm

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/litellm/`

**What it does:** Unified OpenAI-compatible interface over 100+ providers + a FastAPI proxy server with auth, budgets, rate limits, caching, guardrails, observability.

**Architecture:**
- **Core library** (`litellm/`): `main.py` = `completion()` entry. Provider adapters in `litellm/llms/<provider>/`. Type-safe transform in/out.
- **Router** (`router.py`, 10,211 lines â confirms production-grade). `class Router` init (line 216) takes `model_list` (list of `DeploymentTypedDict`) plus:
  - **Routing strategies** (enum literal at line 293): `"simple-shuffle" | "least-busy" | "usage-based-routing" | "latency-based-routing" | "cost-based-routing" | "usage-based-routing-v2"`.
  - **Fallbacks**: `fallbacks`, `default_fallbacks`, `context_window_fallbacks`, `content_policy_fallbacks`, `max_fallbacks`.
  - **Reliability**: `num_retries`, `retry_policy` (per-exception), `model_group_retry_policy`, `allowed_fails`, `cooldown_time`.
  - **Caching**: Redis-backed (`redis_url/host/port`), `caching_groups` (cache across deployments of same logical model), `client_ttl`.
  - **Budgets**: `provider_budget_config`.
  - **Health**: `enable_health_check_routing`, `health_check_staleness_threshold`.
  - The `async_function_with_fallbacks` at line 5573 is the core wrapper â every call goes through retryâfallback chain.
- **Proxy** (`litellm/proxy/`): FastAPI app (`proxy_server.py`) with Prisma ORM, teams/keys/budgets (`management_endpoints/`), guardrails (`guardrails/`), SSO (`custom_sso.py`), MCP credential storage (OAuth2 + BYOK in one `litellm_mcpusercredentials` table, distinguished by JSON `"type"` field).
- **Schema discipline** from CLAUDE.md: no raw SQL, no N+1, `update_many`/`create_many`, cursor-based pagination, `select` to limit columns, Prisma `@@index` extensions over new indexes.

**Patterns worth adopting:**
- **Everything through one `Router`** â your ecosystem should have a single LLM gateway (can be a LiteLLM proxy instance on Railway) so budgets + observability + fallbacks are centralized. All 5 businesses share one routing config.
- **Named fallback chains per model group** (e.g., `gpt-4o â claude-3.5 â llama-3.1-70b`) stored in config â product code never names a provider directly.
- **Cooldown + allowed_fails** pattern â deployment goes to cooldown after N failures, auto-re-tries on schedule. Production-grade resilience.
- Never store access tokens in `localStorage`; use `sessionStorage` â carry this into your apps.

---

## 7. livekit/agents

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/agents/` (examples-only in this snapshot; full SDK at `livekit-agents/livekit/agents/` per AGENTS.md)

**What it does:** Realtime voice-agent framework. WebRTC-native. Runs programmable "participants" on a server that join LiveKit rooms, processing audio/video, doing STTâLLMâTTS with interruption handling, telephony (SIP), avatars.

**Architecture:**
- **AgentServer** (was `Worker`): main process â receives job dispatch from LiveKit server, spawns agents into `proc_pool`. Each job gets a `JobContext` and an entrypoint.
- **AgentSession**: the long-lived container wrapping `Agent(instructions, tools)` + STT/TTS/LLM/VAD + turn detector. One per participant.
- **Plugin system**: 50+ `livekit-plugins-<provider>` packages (openai, deepgram, cartesia, elevenlabs, silero, anthropic, etc.). Base classes in `stt/stt.py`, `tts/tts.py`, `llm/llm.py`, `llm/realtime.py`.
- **Fallback adapters**: `STT / TTS / LLM FallbackAdapter` â if Deepgram fails, auto-switch to Azure STT mid-session. (Same spirit as litellm router but for voice services.)
- **Turn detection**: semantic transformer-based turn detector (`MultilingualModel` in drive-thru example) â reduces spurious interruptions from VAD-only systems.
- **Distribution**: `ipc/proc_pool.py` runs each session in its own process; telemetry (OTel + Prometheus) in `telemetry/`.
- **Realtime API support**: direct integration with OpenAI Realtime API (single-model audioâaudio, no explicit STT/TTS).
- **MCP native**: one-line MCP server integration.
- **Example (drive-thru/agent.py):** `DriveThruAgent(Agent)` gets `tools=[self.build_regular_order_tool(...)]`, uses `silero` VAD + `MultilingualModel` turn detector, has a typed `Userdata` dataclass injected â plus a `BackgroundAudioPlayer` for ambient drive-thru noise. Clean demonstration of tool-building per-session with database-loaded context.

**Patterns worth adopting:**
- **Per-process agent isolation** (`proc_pool`): crash-safe, GPU-allocation-safe.
- **Pluggable STT/TTS/LLM with automatic fallbacks** â same philosophy as litellm router.
- **Semantic turn detection** is a hard-to-fake competitive edge for voice UX.

---

## 8. pipecat

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/pipecat/src/pipecat/`

**What it does:** Real-time voice+multimodal framework from Daily. Frame-based pipeline of processors, transport-agnostic (Daily, LiveKit, WebSocket, Twilio/telephony, WhatsApp).

**Architecture (verified via `pipeline.py` + CLAUDE.md):**
- **Frame-based dataflow:** `Frame` objects (100+ types in `frames/frames.py`) flow through a chain of `FrameProcessor`s, either DOWNSTREAM (inputâoutput) or UPSTREAM (acks/errors).
- **`Pipeline`** (`pipeline/pipeline.py`): takes `list[FrameProcessor]`, wraps with auto-generated `PipelineSource` + `PipelineSink`, `_link_processors()` chains them with `.link()`. Each processor's `process_frame(frame, direction)` is called per frame.
- **ParallelPipeline** (`parallel_pipeline.py`): run multiple pipelines in parallel (used when you want STT and some diagnostic service to see the same audio).
- **PipelineTask** (`task.py`): runs/manages a pipeline. Sends initial `StartFrame`, manages heartbeat, pipeline-level events.
- **PipelineRunner** (`runner.py`): top-level, handles SIGINT/SIGTERM shutdown.
- **Services** (`services/`): 60+ providers (anthropic, openai, deepgram, cartesia, elevenlabs, fal, fireworks, groq, google, aws, mem0, etc.) â extend `AIService | LLMService | STTService | TTSService | VisionService`.
- **Turn management**: `LLMContextAggregatorPair` â `LLMUserAggregator` + `LLMAssistantAggregator`. User-turn-start strategies (e.g., `VADUserTurnStartStrategy`) push `UserStartedSpeakingFrame`/`UserStoppedSpeakingFrame`.
- **Interruption handling**: `InterruptionFrame` carries an `asyncio.Event` that's set when the frame reaches the sink. **Critical contract** â if a processor swallows an `InterruptionFrame`, it *must* call `frame.complete()` to avoid deadlocking `push_interruption_task_frame_and_wait()` callers. `EndFrame` / `StopFrame` are *uninterruptible* (survive queue flush).
- **Observers** (`observers/`): passed to `PipelineTask(observers=[...])`, implement `on_process_frame` / `on_push_frame` â monitoring without mutation.
- **RTVI** (`processors/frameworks/rtvi.py`): Real-Time Voice Interface protocol â `RTVIProcessor` handles clientâpipeline messages, `RTVIObserver` converts pipeline frames â client messages (speaking events, transcriptions, LLM/TTS lifecycle, function calls, metrics, audio levels).
- **Telephony serializers** (`serializers/`): per-provider wire-format (Twilio, Plivo, Vonage, Telnyx, Exotel, Genesys) â including Î¼-law audio encoding.
- **Transports** (`transports/`): `daily/`, `livekit/` (note: pipecat *has* a LiveKit transport â you can run pipecat-on-livekit-infrastructure), `websocket/`, `smallwebrtc/`, `whatsapp/`, `heygen/`, `tavus/` (avatars).
- **Async-task discipline**: always `self.create_task(coro, name)`, never raw `asyncio.create_task` â `TaskManager` auto-cleans on shutdown.

---

## Voice comparison: livekit/agents vs pipecat

| Axis | livekit/agents | pipecat |
|---|---|---|
| **Origin/owner** | LiveKit (media server vendor) | Daily (media server vendor) |
| **Primary abstraction** | `AgentSession` wrapping an `Agent` | `Pipeline` of `FrameProcessor`s |
| **Mental model** | Session-oriented, agent+tools | Dataflow/frame graph |
| **Transport** | LiveKit WebRTC (native), SIP via LiveKit | Daily WebRTC native, LiveKit WebRTC, WebSocket, Twilio/Plivo/Vonage/Telnyx/Exotel/Genesys, WhatsApp |
| **Interruption model** | Turn detector model + VAD | VAD/semantic strategies + `InterruptionFrame.complete()` contract |
| **Job dispatch** | Built-in: LiveKit server dispatches jobs, `proc_pool` isolates per participant | BYO (use `PipelineRunner` + your own scheduler, or deploy per-room) |
| **Service selection** | Typed STT/TTS/LLM with auto-fallback adapters | Each service is a `FrameProcessor`; swap via `llm_switcher.py` / `service_switcher.py` |
| **Parallelism** | One session per process | `ParallelPipeline` in-process |
| **Realtime API (audioâaudio)** | First-class (`llm/realtime.py`) | Supported via OpenAI realtime service |
| **MCP** | Native one-liner | Via `services/mcp_service.py` |
| **Observability** | OTel + Prometheus in `telemetry/` | `Observer` callbacks + `RTVIObserver` |
| **Avatars** | Broad (`examples/avatar_agents/` has 12+ providers) | Broad (tavus, heygen, lemonslice transports) |
| **Testing** | Built-in test framework + judges | `run_test()` helper, `SleepFrame` for timing |
| **Ideal for** | "Agent joins a call" UX (drive-thru, customer support, real employees in WebRTC rooms) | Maximum transport flexibility â esp. WhatsApp Voice Notes, telephony-first flows, multi-modal pipelines |

**For V9 ecosystem (Marcelo's BR context):**
- **Telephony/WhatsApp-first** â **pipecat** wins. `whatsapp` transport + Twilio/Telnyx serializers are first-class.
- **Real estate/college-in-room agent** â livekit (drive-thru example is literally the Intentus Real Estate "concierge" pattern).
- You can in fact pair them: pipecat pipeline running *over* LiveKit transport. This is the pragmatic combo.

---

## Integration patterns with Postgres/Supabase (cross-repo summary)

1. **Schema-in-shared-package** (langfuse, litellm): one `packages/shared` owns Prisma schema + domain models; `web`/`worker`/`ee` consume, shared never imports them. Your ECOSYSTEM monorepo pattern matches.
2. **Hot path on Postgres, analytical on ClickHouse** (langfuse): don't over-load Postgres. For ecosystem scale >100k trace events/day consider ClickHouse or Timescale.
3. **Session as Protocol** (openai-agents): makes Supabase session backend a one-file implementation.
4. **Checkpointer + migrations embedded** (langgraph PostgresSaver): `setup()` method runs migrations on first use â no external migration runner needed for agent-state tables.
5. **Encrypted serializer wrapper** (langgraph `EncryptedSerializer`): envelope encryption at storage layer, transparent to app code. Aligns with Jarvis memory privacy requirement.
6. **BullMQ/Redis between HTTP and DB** (langfuse): protects Postgres write latency from spiky LLM ingest.
7. **Write discipline** (litellm CLAUDE.md): no raw SQL, batch with `in`, `update_many`, cursor pagination, always check index coverage, keep multiple `schema.prisma` copies in sync. Worth enforcing via a shared package and lint rule in your monorepo.

---

## Final recommendations for V9 masterplan

**Orchestration layer:**
- Jarvis meta (stages 3-4, long-running) â **langgraph** with `PostgresSaver` on the shared ECOSYSTEM DB (namespace per business) + encrypted serializer for Marcelo-personal memory slices.
- Vertical per-business crews â **crewAI** or `openai-agents-python` for simpler flows.
- Cross-business agent calls â **A2A protocol** (`AgentExecutor` ABC) so you aren't coupling to one framework.

**LLM gateway:**
- One **LiteLLM proxy** on Railway, shared ECOSYSTEM-level, with per-business virtual keys + budgets. All 5 businesses' code calls this proxy, never a provider directly. Fallback chains in config.

**Observability:**
- Self-host **Langfuse** on Railway (Postgres metadata + ClickHouse traces). SDK calls from every Jarvis/crewAI/agents call. Langfuse evalQueue also replaces a DIY eval loop.

**Voice layer:**
- **pipecat** as the default (WhatsApp + telephony are critical for BR market).
- Upgrade to **livekit/agents** for browser/WebRTC-native UX where clients join a room.
- Keep STT/TTS behind a fallback adapter (Deepgram â Azure; ElevenLabs â Cartesia).

**Key files to revisit when implementing:**
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/openai-agents-python/src/agents/memory/session.py` â `Session` Protocol spec to clone for your Supabase session.
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/langgraph/libs/checkpoint-postgres/langgraph/checkpoint/postgres/__init__.py` â migration-inside-saver pattern.
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/langgraph/libs/langgraph/langgraph/graph/state.py` â typed state + reducers pattern.
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/a2a-python/src/a2a/server/agent_execution/agent_executor.py` â minimal cross-agent interface (45 lines).
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/litellm/litellm/router.py:216` â `Router` signature is effectively a spec sheet of every reliability feature you need.
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/pipecat/src/pipecat/pipeline/pipeline.py` â the 213-line canonical example of how frame-based pipelines should be structured.
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/agents/examples/drive-thru/agent.py` â voice agent with per-session tool construction + typed userdata injection.
- `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/langfuse/CLAUDE.md` + `packages/shared/` layout â monorepo dependency discipline to mirror in your ecosystem.

