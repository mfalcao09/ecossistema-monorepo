# Análise Profunda — Orchestration + Autonomous Agents (6 repos)

> n8n, Dify, AutoGPT, smolagents, LangChain, vibe-kanban
> Gerado por agente de pesquisa em 2026-04-15

Here is the full structured analysis report:

---

# Deep Analysis: Orchestration & Autonomous Agent Repos

## 1. n8n -- Workflow Automation Engine

### What it ACTUALLY does
n8n is a node-graph workflow automation platform. Users visually connect nodes (integrations) into DAGs. The engine resolves connections, executes nodes in topological order, passes data between them, and supports cron-based scheduling, webhooks, and manual triggers.

### Architecture

- **Workflow model** (`packages/workflow/src/Workflow.ts`): The `Workflow` class is a pure data structure holding `nodes: INodes` (map by name), `connectionsBySourceNode` and `connectionsByDestinationNode` (inverted connection maps), `staticData` (persistent per-workflow state), `settings` (timezone, etc.), and `pinData` (debugging). No execution logic lives here -- it is a serializable DAG definition.

- **Execution engine** (`packages/core/src/execution-engine/`): Separate from the workflow definition. Node execution contexts (`execute-context.ts`, `trigger-context.ts`, `webhook-context.ts`, `supply-data-context.ts`) provide the runtime environment for each node type. The engine walks the DAG via graph traversal utilities from `packages/workflow/src/common/` (`getParentNodes`, `getChildNodes`, `mapConnectionsByDestination`).

- **Scheduled tasks** (`scheduled-task-manager.ts`): Uses the `CronJob` library. Crons are registered per-workflow with `registerCron(ctx: CronContext, onTick)`, tracked in a `Map<workflowId, Map<CronKey, Cron>>`, and can be deregistered per-workflow.

- **Node types**: Plugin architecture via `INodeType` interface. Each node is resolved by `nodeTypes.getByNameAndVersion(node.type, node.typeVersion)`. The `packages/nodes-base/` package contains hundreds of built-in integrations.

- **Memory/Persistence**: Workflows persist via TypeORM (SQLite or PostgreSQL). Static data per workflow stored as JSON. No conversation/agent memory -- purely data pipeline oriented.

### Key files
- `/research-repos/n8n/packages/workflow/src/Workflow.ts` -- DAG definition
- `/research-repos/n8n/packages/core/src/execution-engine/scheduled-task-manager.ts` -- Cron scheduling
- `/research-repos/n8n/packages/core/src/execution-engine/node-execution-context/` -- Runtime contexts
- `/research-repos/n8n/packages/workflow/src/interfaces.ts` -- Core type definitions

### Applicable Patterns for the Ecosystem
- **Cron registration pattern**: The `ScheduledTaskManager` with its `Map<workflowId, Map<CronKey, Cron>>` structure is directly replicable with `pg_cron` on Supabase. Each managed agent's scheduled tasks map to cron entries.
- **DAG-as-data**: Workflows are fully serializable JSON. Store workflow definitions in Supabase tables, execute on Railway workers.
- **Node type plugin system**: The `INodeType` + version resolution pattern is excellent for tool registration. Each tool becomes a "node type" resolved by name+version.
- **Connection inversion**: The `mapConnectionsByDestination()` utility for bidirectional graph traversal is applicable to agent dependency graphs.

---

## 2. Dify -- LLM Application Platform with Agent Orchestration

### What it ACTUALLY does
Dify is a full LLM application platform that supports chatbots, agent-chat apps, and visual workflow builders. It has distinct agent runners (function-calling and chain-of-thought), a graph-based workflow engine (via its `graphon` library), tool/plugin management, and memory systems.

### Architecture

- **Agent runners** (`api/core/agent/`): `BaseAgentRunner` is the foundation, holding `tenant_id`, `conversation`, `model_instance`, `memory` (TokenBufferMemory), and a `queue_manager` (AppQueueManager for streaming events). Two concrete runners: `FunctionCallAgentRunner` (uses LLM tool-calling API) and `CotAgentRunner` (chain-of-thought with text parsing).

- **Agent loop** (`fc_agent_runner.py`): Classic ReAct loop -- `while function_call_state and iteration_step <= max_iteration_steps`. Each iteration: organize prompts, invoke LLM with tools, parse tool calls, execute tools via `ToolEngine`, publish `QueueAgentThoughtEvent` for streaming, accumulate token usage. Max iterations capped at 99.

- **Workflow engine** (`api/core/workflow/`): Built on `graphon`, a graph execution engine. `workflow_entry.py` creates `GraphEngine` with a `Graph`, `GraphRuntimeState` (containing `VariablePool`), `CommandChannel`, and configurable layers (`LLMQuotaLayer`, `ObservabilityLayer`, `DebugLoggingLayer`, `ExecutionLimitsLayer`). Supports child graph engines for sub-workflows.

- **Node types** (`api/core/workflow/nodes/`): Agent, datasource, knowledge_index, knowledge_retrieval, trigger_plugin, trigger_schedule, trigger_webhook. The `DifyNodeFactory` resolves node classes, creates runtime support objects.

- **Tools** (`api/core/tools/`): Abstract `Tool` base class with `invoke()` returning a generator of `ToolInvokeMessage`. Tool providers: builtin_tool, custom_tool, plugin_tool, mcp_tool, workflow_as_tool. Tools have `ToolEntity` (metadata) + `ToolRuntime` (credentials, context).

- **Memory** (`api/core/memory/token_buffer_memory.py`): `TokenBufferMemory` backed by database conversations. Loads message history from `Message` and `MessageFile` tables via SQLAlchemy, respects token limits per model.

- **Agent strategies** (`api/core/agent/strategy/`): `base.py` and `plugin.py` -- allows pluggable agent execution strategies.

### Key files
- `/research-repos/dify/api/core/agent/base_agent_runner.py` -- Agent runner base
- `/research-repos/dify/api/core/agent/fc_agent_runner.py` -- Function-calling agent loop
- `/research-repos/dify/api/core/workflow/workflow_entry.py` -- Workflow graph engine entry
- `/research-repos/dify/api/core/workflow/node_factory.py` -- Node resolution factory
- `/research-repos/dify/api/core/tools/__base/tool.py` -- Tool base class
- `/research-repos/dify/api/core/memory/token_buffer_memory.py` -- DB-backed memory

### Applicable Patterns for the Ecosystem
- **Queue-based streaming**: The `AppQueueManager` + `QueueAgentThoughtEvent` pattern is ideal for Supabase Realtime. Each agent thought step publishes to a Supabase channel, the UI subscribes.
- **Token buffer memory backed by DB**: Directly maps to Supabase tables. `Conversation`, `Message`, `MessageAgentThought` tables are the pattern to replicate.
- **Layered graph engine**: The layer pattern (`LLMQuotaLayer`, `ObservabilityLayer`) is composable middleware for graph execution -- applicable to Railway-hosted workflow runners.
- **Tool provider abstraction**: The `builtin_tool / plugin_tool / mcp_tool / workflow_as_tool` hierarchy is the exact pattern needed. "Workflow as tool" means one agent's workflow can be called as a tool by another agent.
- **Agent thought tracking**: `MessageAgentThought` table tracking every step of agent reasoning is essential for the Jarvis 4-stage architecture's observability.

---

## 3. AutoGPT Classic -- Autonomous Agent Framework

### What it ACTUALLY does
AutoGPT Classic (the Forge framework) is a component-based autonomous agent. It follows the Agent Protocol standard (task -> steps -> artifacts). The agent proposes actions, gets user approval (or auto-approves within a cycle budget), executes commands, and loops.

### Architecture

- **Component system** (`forge/agent/components.py`): `AgentComponent` is the base class with `_run_after` (dependency ordering), `_enabled` (dynamic enable/disable), and topological sorting via `AgentMeta.__call__`. `ConfigurableComponent` adds Pydantic config with env var loading.

- **Protocol interfaces** (`forge/agent/protocols.py`): Defines what components CAN do: `DirectiveProvider` (constraints, resources, best practices), `CommandProvider` (yields `Command` objects), `MessageProvider` (yields prompt messages), `AfterParse`, `AfterExecute`, `ExecutionFailure`. Pipeline execution via `run_pipeline()` iterates all matching components.

- **ForgeAgent** (`forge/agent/forge_agent.py`): Inherits both `ProtocolAgent` (REST API) and `BaseAgent` (component handling). Components are assigned as attributes (`self.system`, `self.todo`, `self.clipboard`, etc.). The agent loop: create task -> execute steps -> each step proposes action -> execute action -> return result.

- **Command system**: `@command` decorator transforms methods into `Command` objects with JSON Schema parameters. Components yield commands via `get_commands()`.

- **Persistence**: `AgentDB` (SQLite via Agent Protocol) for tasks/steps/artifacts. `FileStorage` abstraction (Local, S3, GCS) for workspace files. Agent state persists in `state.json`.

- **Permission system**: Layered allow/deny lists with glob patterns. Agent-level > Workspace-level > Session-level > Interactive prompt.

### Key files
- `/research-repos/AutoGPT/classic/forge/forge/agent/forge_agent.py` -- Reference agent
- `/research-repos/AutoGPT/classic/forge/forge/agent/components.py` -- Component system
- `/research-repos/AutoGPT/classic/forge/forge/agent/protocols.py` -- Protocol interfaces

### Applicable Patterns for the Ecosystem
- **Component system with topological sorting**: The `_run_after` dependency + topological sort is the right pattern for composable agent capabilities. Each managed agent can have different component sets.
- **@command decorator pattern**: Clean way to register tool functions with JSON schema. Replicable for Anthropic tool definitions.
- **Pipeline execution with retry**: `run_pipeline()` with `ComponentEndpointError` retry (3x) and `EndpointPipelineError` restart is production-grade error handling for agent loops.
- **Permission glob patterns**: `command_name(glob_pattern)` with first-match-wins evaluation is a good model for agent sandboxing in the ecosystem.
- **Agent Protocol REST API**: The task/step/artifact model is a good interface standard for Railway-hosted agents to expose.

---

## 4. smolagents (HuggingFace) -- Lightweight Agent Framework

### What it ACTUALLY does
smolagents is a minimal, production-quality agent framework from HuggingFace. It implements the ReAct pattern with support for code-execution agents, tool-calling agents, managed sub-agents, MCP tool integration, and planning intervals.

### Architecture

- **MultiStepAgent** (`agents.py`): The core abstract class. Key attributes: `tools` (dict by name), `managed_agents` (dict by name), `model`, `memory` (AgentMemory), `planning_interval`, `max_steps`, `step_callbacks` (CallbackRegistry). The `run()` method drives `_run_stream()` which loops `step_number <= max_steps`.

- **Managed agents**: Sub-agents registered by name with `task` and `report` prompt templates. They appear as callable tools to the parent agent. The parent passes a task description; the managed agent runs independently and returns a string result. Setup in `_setup_managed_agents()`: each gets `inputs = {"task": ..., "additional_args": ...}` and `output_type = "string"`.

- **Memory** (`memory.py`): `AgentMemory` holds a `system_prompt: SystemPromptStep` and `steps: list[TaskStep | ActionStep | PlanningStep]`. Each step type has `to_messages()` for converting to LLM chat format. `ActionStep` tracks `tool_calls`, `observations`, `error`, `token_usage`, `is_final_answer`. Memory is conversation history in message format.

- **Tools** (`tools.py`): `BaseTool` ABC with `name`, `description`, `inputs` (JSON schema), `output_type`. Tools are validated after init. `Tool` subclass adds `forward()` as the execution method. MCP tools via `MCPClient` which wraps `mcpadapt` for Stdio and HTTP transports.

- **Planning**: At `planning_interval` step intervals, the agent generates a plan using dedicated planning prompts (`initial_plan`, `update_plan_pre_messages`, `update_plan_post_messages`).

- **Step callbacks**: `CallbackRegistry` maps step types to callback functions. `ActionStep` callbacks fire after each agent action. This is the monitoring/logging hook.

- **Code execution**: `CodeAgent` uses `LocalPythonExecutor` (or Docker/E2B/Modal/Wasm remote executors) to run generated Python code directly rather than making tool calls.

### Key files
- `/research-repos/smolagents/src/smolagents/agents.py` -- MultiStepAgent, CodeAgent, ToolCallingAgent
- `/research-repos/smolagents/src/smolagents/memory.py` -- AgentMemory, ActionStep, PlanningStep
- `/research-repos/smolagents/src/smolagents/tools.py` -- BaseTool, Tool
- `/research-repos/smolagents/src/smolagents/mcp_client.py` -- MCP integration
- `/research-repos/smolagents/src/smolagents/models.py` -- Model abstraction

### Applicable Patterns for the Ecosystem
- **Managed agents pattern**: THIS IS THE CLOSEST TO ANTHROPIC MANAGED AGENTS. A parent agent registers sub-agents as callable tools with `{task, additional_args}` inputs. The sub-agent runs independently, returns a report. This is exactly the pattern for the Jarvis orchestrator calling specialized agents.
- **AgentMemory as step list**: The `steps: list[TaskStep | ActionStep | PlanningStep]` with `to_messages()` conversion is the cleanest memory model. Each step serializes to a dict. Store these in a Supabase `agent_steps` table.
- **Planning intervals**: Running planning at intervals (e.g., every 3 steps) prevents drift. Implementable as pg_cron triggering a planning review for long-running agents.
- **CallbackRegistry for step monitoring**: Register per-step-type callbacks. Map this to Supabase triggers -- when an `ActionStep` is inserted, fire a webhook to Railway for processing.
- **MCP client integration**: smolagents already has MCP support via `MCPClient`. This validates MCP as the interop standard for the ecosystem.
- **final_answer_checks**: Validation functions before accepting output -- critical for quality gates in autonomous agents.

---

## 5. LangChain -- Agent Abstractions

### What it ACTUALLY does
LangChain provides the most widely-used agent abstractions. The agents module defines how LLMs interact with tools through various strategies (ReAct, OpenAI functions, tool calling, structured chat, XML, etc.). It is primarily an abstraction layer, not an execution platform.

### Architecture

- **Agent types** (`agents/agent.py`): `BaseSingleActionAgent` has `plan(intermediate_steps, callbacks) -> AgentAction | AgentFinish`. `BaseMultiActionAgent` can return multiple actions. Both use the intermediate_steps pattern: `list[tuple[AgentAction, str]]` -- action + observation pairs as the agent's scratchpad.

- **AgentExecutor** (in the same file): The runtime loop. Takes an `agent` and `tools`, runs the plan-execute cycle. Handles `max_iterations`, `early_stopping_method`, `return_intermediate_steps`, and `handle_parsing_errors`.

- **Tool calling agent** (`agents/tool_calling_agent/base.py`): `create_tool_calling_agent(llm, tools, prompt)` returns a `Runnable` chain: prompt -> llm.bind_tools(tools) -> ToolsAgentOutputParser. The `agent_scratchpad` placeholder receives formatted tool messages.

- **Runnable paradigm**: Everything composes via LCEL (LangChain Expression Language). Agents are `Runnable` objects that can be piped, batched, streamed.

- **Tool system** (`langchain_core/tools/`): `BaseTool` with `name`, `description`, `args_schema` (Pydantic). `@tool` decorator for simple function tools. `StructuredTool` for complex inputs. `BaseToolkit` groups related tools.

- **Memory**: Handled separately via `langchain_classic/memory/` -- conversation buffer, token buffer, summary, entity memory. Memory is injected into prompts, not built into the agent loop.

### Key files
- `/research-repos/langchain/libs/langchain/langchain_classic/agents/agent.py` -- BaseSingleActionAgent, AgentExecutor
- `/research-repos/langchain/libs/langchain/langchain_classic/agents/tool_calling_agent/base.py` -- create_tool_calling_agent
- `/research-repos/langchain/libs/core/langchain_core/tools/__init__.py` -- Tool system exports

### Applicable Patterns for the Ecosystem
- **intermediate_steps as scratchpad**: The `list[tuple[AgentAction, str]]` pattern is the standard for agent reasoning history. Store in Supabase as JSONB.
- **AgentAction/AgentFinish discriminated union**: Clean decision model. The agent either returns an action to take or signals completion.
- **Runnable composition (LCEL)**: Prompt -> Model -> OutputParser as a composable chain. This is the pattern for building agent pipelines on Railway -- each stage is a chainable unit.
- **Tool binding**: `llm.bind_tools(tools)` is the Anthropic model pattern. Tools are bound to the model call, not handled externally.
- **Separation of memory from agent loop**: Memory is a prompt injection concern, not an execution concern. This keeps the agent runner clean.

---

## 6. vibe-kanban -- Autonomous Task Board

### What it ACTUALLY does
Vibe Kanban is a kanban board designed specifically for orchestrating AI coding agents. It creates workspaces where coding agents (Claude Code, Codex, Gemini CLI, etc.) execute tasks. Each workspace gets a branch, terminal, and dev server. It is NOT an agent framework -- it is an agent ORCHESTRATION UI.

### Architecture

- **Rust backend** (`crates/`): `server` (API + binaries), `db` (SQLx + migrations), `executors`, `services`, `worktree-manager`, `git-host`, `mcp` (MCP server), `relay-*` (real-time sync), `local-deployment`, `remote`.

- **MCP server** (`crates/mcp/`): Exposes task management via MCP protocol. `McpServer` has two modes: `Global` (project-wide tools) and `Orchestrator` (workspace-scoped tools). Uses `rmcp` crate with `ToolRouter<McpServer>`. Context includes `organization_id`, `project_id`, `issue_id`, `workspace_id`, `workspace_branch`, and per-repo branch info.

- **Worktree manager** (`crates/worktree-manager/`): Manages git worktrees for parallel agent execution. Each workspace/agent gets an isolated branch via git worktrees.

- **Agent integration**: No custom agent logic -- it spawns external agents (Claude Code, Codex, etc.) in isolated workspaces and communicates via MCP tools. The MCP tools let agents read issues, update status, create PRs.

- **Frontend**: React + TypeScript (Vite, Tailwind) with shared `web-core` library. Kanban board UI for managing issues and reviewing agent diffs inline.

- **Type sharing**: Rust structs derive `TS` (ts-rs) to generate TypeScript types. Shared types in `shared/types.ts`.

### Key files
- `/research-repos/vibe-kanban/crates/mcp/src/task_server/mod.rs` -- MCP server with Global/Orchestrator modes
- `/research-repos/vibe-kanban/crates/mcp/src/lib.rs` -- MCP module root
- `/research-repos/vibe-kanban/AGENTS.md` -- Full architecture overview

### Applicable Patterns for the Ecosystem
- **MCP as the agent communication protocol**: Vibe Kanban proves MCP works as the standard for agent-to-platform communication. Agents connect via MCP, get task context, report progress.
- **Global vs Orchestrator mode**: Two MCP modes with different tool sets is a clean pattern. Global mode for project-wide operations, Orchestrator mode for per-workspace/per-agent operations. Map this to the Jarvis architecture: Jarvis gets global tools, specialized agents get scoped tools.
- **Workspace isolation via git worktrees**: Each agent gets its own branch and workspace. The ecosystem equivalent: each managed agent on Railway gets its own Supabase schema or row-level isolation.
- **McpContext structure**: The `{organization_id, project_id, issue_id, workspace_id, workspace_branch, workspace_repos}` context object is a good template for agent execution context in Supabase.

---

## Cross-Cutting Synthesis: Patterns for pg_cron + Supabase + Railway + Anthropic Managed Agents

| Pattern | Source | Application |
|---|---|---|
| **Managed agents as callable tools** | smolagents | Parent Jarvis agent calls child agents via tool interface `{task, additional_args}` |
| **Step-based memory in DB** | smolagents + Dify | `agent_steps` table in Supabase: TaskStep, ActionStep, PlanningStep rows with JSONB payloads |
| **Token buffer memory from conversations** | Dify | `conversations` + `messages` tables, TokenBufferMemory class loads history up to token limit |
| **Cron registration map** | n8n | `pg_cron` entries mapped per-agent, tracked in a Supabase `agent_crons` table |
| **Component system with dependency ordering** | AutoGPT | Agent capabilities as composable components with topological sort |
| **Queue-based event streaming** | Dify | `agent_thought` events via Supabase Realtime for live UI updates |
| **MCP Global + Orchestrator modes** | vibe-kanban | Jarvis gets global MCP tools; each managed agent gets scoped MCP context |
| **Planning at intervals** | smolagents | pg_cron triggers planning review every N steps for long-running agents |
| **Workflow-as-tool** | Dify | One agent's workflow callable as a tool by another agent |
| **Runnable composition** | LangChain | Agent pipelines as composable chains: prompt -> model -> parser -> tool execution |
| **DAG-as-serializable-JSON** | n8n | Store workflow definitions in Supabase, execute on Railway workers |
| **Permission glob patterns** | AutoGPT | Agent sandboxing: `tool_name(glob_pattern)` with allow/deny lists in Supabase |
| **final_answer_checks** | smolagents | Quality gate validators before accepting agent output |
| **Layer middleware for execution** | Dify | Composable layers (quota, observability, limits) wrapping the execution engine |

### Priority Recommendations for Ecosystem Architecture

1. **Adopt smolagents' managed agent pattern** as the canonical model for Jarvis multi-agent orchestration. It is the lightest-weight, most Anthropic-compatible pattern.

2. **Use Dify's TokenBufferMemory + DB persistence** as the memory pattern. Conversation and message tables in Supabase with token-aware truncation.

3. **Use n8n's ScheduledTaskManager concept** but implement with `pg_cron`. Map workflow IDs to cron expressions in a Supabase table.

4. **Adopt vibe-kanban's MCP dual-mode pattern** for agent communication. Global mode for Jarvis orchestrator, scoped mode for specialized agents.

5. **Use AutoGPT's component system** for agent capability composition. Each agent type gets a different component set registered at init time.

6. **Use Dify's event queue pattern** with Supabase Realtime for streaming agent thoughts to the UI.

