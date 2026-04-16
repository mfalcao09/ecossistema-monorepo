# Análise Profunda — Autonomous Agents (6 repos)

> AutoGPT, smolagents, LangChain, awesome-llm-apps, system-prompts, agents-course
> Gerado por agente de pesquisa em 2026-04-15

I now have substantial source code from all 6 repos. Let me compile the structured report.

---

# Deep Analysis Report: Agent Frameworks & Patterns from 6 Open-Source Repos

## 1. AutoGPT (Autonomous Agent Framework)

### 1.1 Agent Lifecycle

**Creation**: Agents are created via `AgentManager` which generates unique IDs (`{name}-{uuid8}`), stores state as `state.json` files in a file-storage-backed `agents/` directory. The `Agent` class inherits from `BaseAgent` and is initialized with settings (Pydantic), an LLM provider, file storage, app config, and an optional `ExecutionContext`.

**Run Loop**: The agent uses a component-based architecture. Core components are attached in the constructor: `SystemComponent`, `ActionHistoryComponent`, `FileManagerComponent`, `CodeExecutorComponent`, `WebSearchComponent`, `WebPlaywrightComponent`, etc. The agent runs in a cycle producing `ActionProposal` objects that are parsed and executed.

**Termination**: Via `AgentTerminated` exception or max-steps. The agent state is persisted to JSON for resumption.

**Key pattern**: Agent state is fully serializable (Pydantic models), enabling stop/resume across process boundaries.

### 1.2 Memory System

- **Episodic Action History** (`EpisodicActionHistory`): Records all actions taken, results observed. Token-counted to fit within context windows.
- **Agent Context** (`AgentContext`): Working memory that the agent accumulates during execution.
- **Reflexion Memory** (`ReflexionMemory`): Stores structured `Reflection` objects with `what_went_wrong`, `what_to_do_differently`, success/failure status, and evaluation scores. Supports both structured and verbal (free-form) reflection formats. Capped at N most recent reflections.
- No persistent long-term memory beyond file-system state.

### 1.3 Planning & Execution

AutoGPT implements **7 prompt strategies** as a union type, each producing a typed `ActionProposal`:

| Strategy | Key Idea |
|---|---|
| **OneShotAgent** | Single LLM call per step (ReAct-style) |
| **PlanExecute** | Separate PLAN phase (generates `PlannedStep` list), EXECUTE phase per step, REPLAN on failure. Includes PS+ (Plan-and-Solve Plus) with variable extraction and calculation verification. |
| **ReWOO** | Planner generates full plan with variable dependencies (`#E1`, `#E2`), Worker executes steps, Solver combines results |
| **Reflexion** | Execute, evaluate, reflect (verbal or structured), retry with reflections in context |
| **TreeOfThoughts** | Branch-and-evaluate reasoning tree with scored `Thought` nodes and backtracking |
| **LATS** | Language Agent Tree Search -- sub-agent based tree search |
| **MultiAgentDebate** | Multiple sub-agents debate to reach consensus |

Each strategy extends `BaseMultiStepPromptStrategy` which has configurable sub-agent support (`enable_sub_agents`, `max_sub_agents`, `sub_agent_timeout_seconds`).

### 1.4 Multi-Agent Coordination

The `ExecutionContext` is the core coordination mechanism:

- **Hierarchical spawning**: Parent agents create child contexts with `create_child_context()`. Each child gets:
  - Shared LLM provider
  - Write-restricted file storage (writes only to `.sub_agents/{child_agent_id}/`)
  - Reduced resource budget (depth decremented)
- **ResourceBudget**: Controls `max_depth` (5), `max_sub_agents` (25), `max_cycles_per_agent` (50), inherited deny rules, explicit allow rules.
- **SubAgentHandle**: Async tracking with status enum (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED), result, error, summary.
- **AgentFactory protocol**: Decouples agent creation from concrete implementation.
- `wait_for_sub_agents(timeout)` for synchronization.
- `cancel()` cascades cancellation through the hierarchy.

### 1.5 Tool/Plugin System

Component-based architecture where each component (`CommandProvider`) exposes `Command` objects. Components include: FileManager, CodeExecutor, GitOperations, HTTPClient, ImageGenerator, WebSearch, WebPlaywright, Todo, Skills, DataProcessor, etc. Tools are registered as functions with JSON Schema parameter specs via `function_specs_from_commands()`.

### 1.6 Applicable Patterns for Anthropic Managed Agents

- **Serializable agent state** (Pydantic) for stop/resume across process boundaries
- **ExecutionContext with ResourceBudget** for hierarchical sub-agent management
- **Write-restricted file storage** for sub-agents (read parent, write only to own directory)
- **Multiple prompt strategies** as pluggable modules (not hardcoded ReAct)
- **Reflexion with episodic memory** for learning from failures within a task

---

## 2. smolagents (HuggingFace Lightweight Agent Framework)

### 2.1 Agent Lifecycle

**Creation**: `MultiStepAgent` (abstract base) takes `tools`, `model`, `prompt_templates`, `instructions`, `max_steps`, `managed_agents`, `planning_interval`, `name`, `description`. Two concrete implementations:

- **`ToolCallingAgent`**: Uses native tool-calling API (function calling)
- **`CodeAgent`**: LLM writes Python code that calls tools as functions. Supports multiple executor backends: local, Docker, E2B, Blaxel, Modal, WASM.

**Run**: `agent.run(task, stream=False, reset=True, images=None, additional_args=None)` returns final answer or `RunResult`. The run loop iterates steps up to `max_steps`, each step being Thought + Action + Observation (ReAct). Supports streaming via generators.

**Termination**: `FinalAnswerTool` signals completion. `max_steps` triggers forced final answer. `interrupt()` method for external interruption.

**Key pattern**: `CodeAgent` uses context managers (`__enter__`/`__exit__`) for resource cleanup of remote executors.

### 2.2 Memory System

`AgentMemory` is a simple, effective design:

- **System prompt** stored as `SystemPromptStep`
- **Steps list** containing: `TaskStep`, `ActionStep`, `PlanningStep`, `FinalAnswerStep`
- Each `ActionStep` records: step_number, timing, model_input_messages, tool_calls, error, observations, action_output, token_usage
- **`write_memory_to_messages(summary_mode)`**: Converts memory to LLM-consumable message format. Summary mode strips system prompt and planning messages for conciseness.
- **`return_full_code()`**: Concatenates all code actions into a single script
- **`CallbackRegistry`**: Event-driven callbacks registered per step type
- No persistent long-term memory -- all within a single run.

### 2.3 Planning & Execution

- **Planning interval**: Configurable via `planning_interval`. Every N steps, the agent generates or updates a plan.
- **Initial plan**: Generated from task + available tools + managed agents
- **Plan updates**: Uses summary mode memory (strips old plans) + remaining steps count
- Plans are stored as `PlanningStep` objects and converted to assistant/user message pairs to guide subsequent action steps.

### 2.4 Multi-Agent Coordination (Managed Agents)

This is smolagents' most distinctive pattern:

- **Managed agents ARE tools**: Each managed agent gets `inputs` (task: string, additional_args: object) and `output_type: string`. The parent agent calls them exactly like tools.
- **Setup**: `_setup_managed_agents()` converts agents into tool-like interfaces.
- **Prompt integration**: Managed agents appear in the system prompt alongside tools, so the LLM naturally decides when to delegate.
- **Name uniqueness**: All tool names + agent names must be unique.
- **`provide_run_summary`**: When True, managed agent provides a summary of its run instead of just the raw output.

The `ManagedAgentPromptTemplate` has `task` (how to phrase the delegation) and `report` (how to format the result).

### 2.5 Tool/Plugin System

Multi-layered tool creation:

| Method | Use Case |
|---|---|
| `class MyTool(Tool)` | Subclass with `name`, `description`, `inputs`, `output_type`, `forward()` |
| `@tool` decorator | Convert any function to a Tool |
| `Tool.from_hub(repo_id)` | Load from HuggingFace Hub |
| `Tool.from_space(space_id)` | Wrap a Gradio Space |
| `Tool.from_langchain(lc_tool)` | Adapt LangChain tools |
| `Tool.from_gradio(gradio_tool)` | Adapt Gradio tools |
| `Tool.from_code(tool_code)` | Create from source code string |
| `ToolCollection.from_mcp(server_params)` | Load tools from MCP server |
| `ToolCollection.from_hub(collection_slug)` | Load tool collections |

**MCP Integration**: `MCPClient` wraps `mcpadapt` to connect to MCP servers (Stdio or HTTP transport), with context manager support and structured output support. Tools are auto-converted to smolagents `Tool` format.

### 2.6 Applicable Patterns for Anthropic Managed Agents

- **Agents-as-tools** pattern: Sub-agents have the same interface as tools (name, description, inputs, output_type, forward). The parent LLM naturally chooses when to delegate.
- **CodeAgent**: LLM writes Python that calls tools as functions -- more expressive than JSON tool calls
- **Configurable planning interval**: Not every step needs a plan; plan every N steps
- **Summary mode memory**: Strip verbose history for planning while keeping full history for action
- **MCP-native tool loading**: First-class MCP client integration
- **`CallbackRegistry`**: Typed event system for step monitoring, metrics, external integrations

---

## 3. LangChain (LLM Application Framework -- Agents Focus)

### 3.1 Agent Lifecycle

LangChain separates the agent (decision-maker) from the executor:

- **`BaseSingleActionAgent`**: Abstract class with `plan(intermediate_steps) -> AgentAction | AgentFinish`. This is pure decision logic.
- **`BaseMultiActionAgent`**: Can return multiple actions per step.
- **`AgentExecutor`**: The runtime that loops the agent, executing tools and collecting observations. It handles max_iterations, time_limit, error handling, and early stopping.
- **`AgentExecutorIterator`**: Enables step-by-step iteration with `yield_actions` for streaming.

**Creation pattern** (modern): `create_tool_calling_agent(llm, tools, prompt)` returns a `Runnable` chain: `RunnablePassthrough.assign(agent_scratchpad=...) | prompt | llm_with_tools | ToolsAgentOutputParser()`.

### 3.2 Memory System

LangChain's memory is external to the agent loop:
- Agent scratchpad (`intermediate_steps`) is the working memory within a run
- Chat history is passed as a prompt variable (`{chat_history}`)
- Memory modules (ConversationBufferMemory, ConversationSummaryMemory, etc.) are separate chain components
- No built-in episodic or reflective memory

### 3.3 Planning & Execution

- **ReAct** (primary): Reason + Act loop via scratchpad
- **Plan-and-Execute**: Separate planner chain + executor chain
- **Self-Ask with Search**: Agent asks sub-questions
- **Structured Chat**: JSON-based action specification

The core abstraction is `AgentAction(tool, tool_input, log)` and `AgentFinish(return_values, log)`.

### 3.4 Multi-Agent Coordination

LangChain has an `openai_functions_multi_agent` directory but the actual multi-agent patterns are in LangGraph (separate library). Within LangChain classic:
- Agents can call other agents as tools
- No built-in hierarchical coordination

### 3.5 Tool/Plugin System

- **`BaseTool`** with `_run()` and `_arun()` methods
- **`@tool` decorator** for function-to-tool conversion
- **`InvalidTool`**: Graceful handling when agent calls nonexistent tool -- suggests valid names
- **`llm.bind_tools(tools)`**: Native integration with model tool-calling APIs
- Tools have names, descriptions, and Pydantic-validated argument schemas

### 3.6 Applicable Patterns for Anthropic Managed Agents

- **Agent/Executor separation**: Decision logic (agent) decoupled from execution runtime (executor). Enables different execution strategies for the same agent logic.
- **Runnable composition**: `| prompt | llm | parser` chain pattern
- **InvalidTool pattern**: When agent halluccinates a tool name, return helpful error with valid names instead of crashing
- **`AgentExecutorIterator`**: Step-by-step streaming with state tracking

---

## 4. HuggingFace Agents Course (Educational)

### Key Architectural Lessons

1. **Agency Spectrum** (from Unit 1):
   - Level 0: Simple processor (no impact on flow)
   - Level 1: Router (basic if/else)
   - Level 2: Tool caller (function execution)
   - Level 3: Multi-step agent (loop control)
   - Level 4: Multi-agent (agents spawning agents)

2. **Agent = Brain + Body**: Brain is the LLM (reasoning, planning). Body is tools and capabilities.

3. **Multi-Agent Architecture Pattern** (from Unit 2):
   - **Manager/Orchestrator Agent**: Coordinates task delegation
   - **Specialist Agents**: Code Interpreter, Web Search, Retriever, Image Generator
   - Agents are connected as managed agents with `name` and `description`
   - The orchestrator decides which specialist to invoke based on the task

4. **Tool Creation Pattern**: `@tool` decorator on functions with typed parameters and docstrings. The framework auto-generates the tool schema from type hints and docstrings.

5. **Agentic RAG**: Agents that dynamically decide when to retrieve, what to retrieve, and how to combine information -- not just static retrieval pipelines.

### Applicable Patterns

- **Agency levels as a design framework**: Design your system to operate at the right level for each task
- **Manager + specialist agent topology** is the recommended multi-agent pattern
- **Tools are the primary abstraction for capabilities** -- including other agents

---

## 5. awesome-llm-apps (MCP & Multi-Agent Patterns)

### 5.1 Multi-MCP Agent Pattern

The `multi_mcp_agent` example shows the "single agent, multiple MCP servers" pattern:
- One agent connects to multiple MCP servers simultaneously (GitHub, Perplexity, Calendar, Gmail)
- Uses `MultiMCPTools` from the `agno` library as a context manager
- SQLite database for session memory/persistence
- Single system prompt enumerates all capabilities across platforms

### 5.2 MCP Agent Router Pattern (Agent Forge)

The `multi_mcp_agent_router` demonstrates **specialized agent routing**:

- **Agent definitions**: Each agent has `name`, `description`, `system_prompt`, `icon`, and its own `mcp_servers` list
- **Keyword-based routing**: `classify_query()` maps user queries to the best specialist agent using keyword matching
- **Each agent connects only to its relevant MCP servers**: Code Reviewer gets GitHub + Filesystem; Security Auditor gets GitHub + Fetch; Researcher gets Fetch + Filesystem
- **MCP tool conversion**: `mcp_tool_to_anthropic()` adapts MCP tool schemas to Anthropic's format

Defined agents: Code Reviewer, Security Auditor, Researcher, BIM Engineer.

### 5.3 Other Patterns

- **Agent Teams**: Multiple agents with defined roles collaborating on tasks
- **Self-Evolving Agent**: Agent that modifies its own behavior based on outcomes
- **Multi-Agent Trust Layer**: Agents with trust/verification mechanisms

### Applicable Patterns for Anthropic Managed Agents

- **MCP server per domain**: Each specialist agent connects to domain-specific MCP servers, not all servers
- **Keyword routing**: Simple, fast classification for query routing before invoking the full agent
- **Session persistence via SQLite**: Lightweight memory across conversations
- **Agent-as-dataclass pattern**: Simple `@dataclass` with name, description, system_prompt, mcp_servers -- easy to serialize and configure

---

## 6. System Prompts from Production AI Tools

### 6.1 Manus Agent (Most Relevant for Ecosystem Design)

**Agent Loop Architecture**:
1. Analyze Events (understand user needs from event stream)
2. Select Tools (one tool call per iteration)
3. Wait for Execution (sandbox runs tool)
4. Iterate (repeat until done)
5. Submit Results (via message tools with attachments)
6. Enter Standby (idle until next task)

**Module System** (key architectural pattern):
- **Planner Module**: Provides numbered pseudocode execution plans as events in the event stream. Plans update when objectives change.
- **Knowledge Module**: Provides task-relevant knowledge and best practices as events. Each item has scope conditions.
- **Datasource Module**: Provides data API documentation as events. APIs are called via Python code, pre-authorized.

**`todo.md` Pattern**: The agent maintains a checklist file based on the Planner module's output. Updated in real-time as items complete. Rebuilt when plans change significantly.

**Message Rules**: Separate `notify` (non-blocking) and `ask` (blocking) message tools. Minimize blocking asks to avoid disrupting workflow.

### 6.2 Devin AI

**Dual-Mode Operation**:
- **Planning mode**: Gather information, search codebase, understand context, ask clarifying questions. Ends with `suggest_plan` command.
- **Standard mode**: Execute plan steps with awareness of current and next steps.

**`<think>` Tool**: Explicit scratchpad for reasoning before critical decisions (git operations, transitioning from exploration to editing, before reporting completion). 10 specific situations listed where thinking is mandatory or recommended.

**Key constraints**: Never modify tests (unless task requires it), never assume library availability, mimic existing code conventions, test locally before submitting.

### 6.3 Applicable Patterns for Anthropic Managed Agents

- **Event stream architecture** (Manus): All context (user messages, actions, observations, plans, knowledge, data sources) flows through a single chronological event stream
- **Planner as a separate module** (Manus): Plan generation is decoupled from execution, provided as system events
- **Knowledge module** (Manus): Best practices injected contextually with scope conditions
- **`todo.md` as execution state** (Manus): Persistent, human-readable task tracking
- **Planning/Standard mode split** (Devin): Explicit phase separation prevents premature action
- **Mandatory think-before-act** (Devin): Structured reasoning before critical operations
- **`notify` vs `ask` messaging** (Manus): Non-blocking progress updates vs blocking questions

---

## Synthesis: Concrete Patterns to Adopt for Anthropic Managed Agents Ecosystem

### A. Agent Lifecycle

1. **Serializable agent state** (AutoGPT): Use Pydantic models for agent settings, enabling stop/resume across process boundaries and Railway deployments.
2. **Agent-as-tool interface** (smolagents): Every managed agent exposes `(name, description, inputs, output_type)` -- identical interface to tools. Parent agents naturally delegate.
3. **Agent/Executor separation** (LangChain): Decouple decision logic from runtime execution for testability and flexibility.
4. **Context manager lifecycle** (smolagents CodeAgent): `__enter__`/`__exit__` for resource cleanup of remote executors.

### B. Memory Architecture

1. **Three-tier memory** from the combined patterns:
   - **Working memory**: Current step's context (smolagents `ActionStep`)
   - **Episodic memory**: Run history with token-counted context window management (AutoGPT `EpisodicActionHistory`)
   - **Reflexion memory**: Structured failure analysis with lessons learned (AutoGPT `ReflexionMemory`)
2. **Summary mode** (smolagents): Strip verbose history for planning calls, keep full history for action calls.
3. **Persistent todo.md** (Manus): Human-readable execution state that survives process restarts.
4. **SQLite session memory** (awesome-llm-apps): Lightweight cross-conversation persistence.

### C. Planning & Execution

1. **Planning interval** (smolagents): Plan every N steps, not every step. Reduces overhead while maintaining course.
2. **Plan-Execute-Replan** (AutoGPT): Separate planning phase, execute each step, replan on failure.
3. **Planning/Standard mode** (Devin): Explicit phase gate -- gather all context before acting.
4. **Mandatory reasoning before critical actions** (Devin `<think>`): Force structured thinking before git operations, code changes, completion reports.

### D. Multi-Agent Coordination

1. **Hierarchical ExecutionContext with ResourceBudget** (AutoGPT): `max_depth`, `max_sub_agents`, `max_cycles_per_agent`, inherited deny rules. Child contexts have write-restricted file storage.
2. **Manager + Specialist topology** (agents-course, awesome-llm-apps): One orchestrator routes to domain specialists. Each specialist has its own MCP servers.
3. **Agents-as-tools** (smolagents): The simplest and most elegant multi-agent pattern -- managed agents have the same interface as tools.
4. **Keyword routing** (awesome-llm-apps Agent Forge): Fast, deterministic classification before expensive LLM routing.

### E. Tool/Plugin System

1. **MCP-first tool integration** (smolagents `MCPClient`, awesome-llm-apps): Tools loaded from MCP servers at runtime with context manager lifecycle.
2. **Multi-source tool loading** (smolagents): From code, Hub, MCP, LangChain, Gradio -- maximum interoperability.
3. **Domain-scoped MCP servers** (awesome-llm-apps Agent Forge): Each agent connects only to its relevant MCP servers, not all servers.
4. **InvalidTool pattern** (LangChain): Graceful handling of hallucinated tool names with suggestions.

### F. System Prompt Architecture

1. **Event stream architecture** (Manus): Chronological stream of messages, actions, observations, plans, knowledge.
2. **Module injection** (Manus): Planner, Knowledge, and Datasource modules inject contextual information as events.
3. **Dual messaging** (Manus): `notify` (non-blocking status updates) vs `ask` (blocking questions). Minimize blocking.
4. **Agency level design** (agents-course): Match the agency level to the task -- not everything needs a multi-agent system.

The report above covers all 6 repos with source-code-level analysis. Here is a summary of the key files examined:

**AutoGPT**:
- `/tmp/research-repos-5/AutoGPT/classic/original_autogpt/autogpt/agents/agent.py` -- Core Agent class with component-based architecture
- `/tmp/research-repos-5/AutoGPT/classic/original_autogpt/autogpt/agents/agent_manager.py` -- Agent persistence and lifecycle management
- `/tmp/research-repos-5/AutoGPT/classic/original_autogpt/autogpt/agents/prompt_strategies/base.py` -- 7 prompt strategies, Reflexion memory, PlannedStep, Thought trees
- `/tmp/research-repos-5/AutoGPT/classic/original_autogpt/autogpt/agents/prompt_strategies/plan_execute.py` -- Plan-and-Execute with PS+ variable extraction
- `/tmp/research-repos-5/AutoGPT/classic/forge/forge/agent/execution_context.py` -- Hierarchical sub-agent coordination with ResourceBudget

**smolagents**:
- `/tmp/research-repos-5/smolagents/src/smolagents/agents.py` -- MultiStepAgent, CodeAgent, ToolCallingAgent, managed agents as tools
- `/tmp/research-repos-5/smolagents/src/smolagents/memory.py` -- AgentMemory, ActionStep, PlanningStep, CallbackRegistry
- `/tmp/research-repos-5/smolagents/src/smolagents/tools.py` -- Tool base class with 8+ creation methods including MCP
- `/tmp/research-repos-5/smolagents/src/smolagents/mcp_client.py` -- MCP server integration

**LangChain**:
- `/tmp/research-repos-5/langchain/libs/langchain/langchain_classic/agents/agent.py` -- BaseSingleActionAgent, AgentExecutor
- `/tmp/research-repos-5/langchain/libs/langchain/langchain_classic/agents/tool_calling_agent/base.py` -- Modern Runnable-based agent creation

**awesome-llm-apps**:
- `/tmp/research-repos-5/awesome-llm-apps/mcp_ai_agents/multi_mcp_agent/multi_mcp_agent.py` -- Single agent with multiple MCP servers
- `/tmp/research-repos-5/awesome-llm-apps/mcp_ai_agents/multi_mcp_agent_router/agent_forge.py` -- Specialized agent routing with domain-scoped MCP servers

**System Prompts**:
- Manus Agent Loop, Modules, and Prompt -- Event stream architecture with Planner/Knowledge/Datasource modules
- Devin AI -- Planning/Standard dual-mode with mandatory `<think>` tool

**Agents Course**:
- Unit 1 what-are-agents -- Agency spectrum framework
- Unit 2 multi_agent_systems -- Manager + Specialist topology with smolagents

