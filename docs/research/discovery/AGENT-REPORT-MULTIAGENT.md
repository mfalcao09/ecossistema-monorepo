# Agent Report — Multi-Agent Orchestration (35+ frameworks via API)

I now have enough to produce a comprehensive report. Let me compile the findings.

---

# Multi-Agent Orchestration Frameworks â GitHub Research Report

**Research date:** 2026-04-16
**Context:** ECOSSISTEMA-2026-04-15 (Managed Agents + Railway, ECOSYSTEM shared Supabase + per-project DBs, Jarvis 4-stage plan)
**Rating legend:** ð¢ strong fit / directly usable Â· ð¡ partial fit / reference only Â· ð´ out of scope / noisy

---

## 1. Major Multi-Agent Frameworks (Tier 1)

### CrewAI â https://github.com/crewAIInc/crewAI  ð¢
- **49,027 stars** Â· updated 2026-04-16
- Framework for orchestrating role-playing, autonomous AI agents with collaborative intelligence.
- **Relevant:** The canonical "crew of specialists" metaphor maps cleanly to Jarvis orchestrating 5 business-specific agent teams. Python, independent of LangChain, supports hierarchical + sequential processes.
- **Arch:** Shared memory (crew-level) + direct role delegation; process-based (sequential/hierarchical/consensus).

### Microsoft AutoGen â https://github.com/microsoft/autogen  ð¢
- **57,147 stars** Â· updated 2026-04-16
- Programming framework for agentic AI with async event-driven architecture (v0.4+).
- **Relevant:** Most mature conversation-driven multi-agent paradigm; GroupChat + Swarm patterns. v0.4 rewrote core as distributed actor model â relevant if Jarvis needs cross-process agents on Railway.
- **Arch:** Message bus (distributed actor runtime in v0.4); group-chat manager routes speaker selection.

### LangGraph â https://github.com/langchain-ai/langgraph  ð¢
- **29,453 stars** Â· updated 2026-04-16
- Build resilient language agents as graphs (stateful, durable, with HITL).
- **Relevant:** Production-proven durable execution (checkpointing to Postgres/Supabase natively). Graph model is the most explicit for complex orchestration â good fit for Jarvis state machine across stages.
- **Arch:** Shared state object (typed graph state); direct node calls; checkpointer persists to Postgres/Redis/Supabase.

### LangChain â https://github.com/langchain-ai/langchain  ð¡
- **133,783 stars** Â· updated 2026-04-16
- The agent engineering platform. LangChain is the integration/tooling layer; LangGraph is the orchestration layer.
- **Relevant:** Use only as LLM/tool abstraction if needed; full LangChain stack is heavy for your Managed-Agents plan.

### OpenAI Swarm â https://github.com/openai/swarm  ð¡
- **21,320 stars** Â· updated 2026-04-16 (still in educational/POC status)
- Educational framework exploring ergonomic, lightweight multi-agent orchestration via handoffs.
- **Relevant:** The `handoff` pattern (agent returns another agent as next speaker) is elegant and influential. Not production-ready â OpenAI moved it to `openai-agents-python`.
- **Arch:** Direct function-call handoffs; stateless between turns; no message bus.

### OpenAI Agents SDK (Python) â https://github.com/openai/openai-agents-python  ð¢
- **21,142 stars** Â· updated 2026-04-16
- Lightweight production-oriented multi-agent workflow framework (Swarm's successor).
- **Relevant:** Closest OpenAI analog to Anthropic Managed Agents â direct architectural comparison for Decision #1. Handoffs + guardrails + tracing built in.
- **Arch:** Handoff-based; tools-as-functions; runs as a tight loop.

### Agno (ex-Phidata) â https://github.com/agno-agi/agno  ð¢
- **39,477 stars** Â· updated 2026-04-16
- "Build, run, manage agentic software at scale" â full-stack framework with AgentOS runtime.
- **Relevant:** Agno positions itself as a production runtime (multi-tenant, monitoring, built-in UI) â overlaps heavily with what Managed Agents + Railway is trying to do. Worth studying for multi-tenant patterns per business.
- **Arch:** Teams of agents (route/coordinate/collaborate modes); shared session state; built-in vector-DB and memory.

### Mastra â https://github.com/mastra-ai/mastra  ð¢
- **23,062 stars** Â· updated 2026-04-16
- TypeScript-first framework for AI-powered apps and agents, from the Gatsby team.
- **Relevant:** If any of the 5 business frontends are Next.js/Vercel, Mastra is the best TS-native option. Ships workflows + A2A support + MCP UI.
- **Arch:** Workflow graph (similar to LangGraph) + direct agent calls; shared TS runtime.

---

## 2. Alternative / Specialized Frameworks

### MetaGPT â https://github.com/FoundationAgents/MetaGPT  ð¡
- **67,147 stars** Â· updated 2026-04-16
- "The Multi-Agent Framework: First AI Software Company, Towards Natural Language Programming."
- **Relevant:** Models an entire software company (PM + Eng + QA). Interesting reference for Jarvis-as-CEO metaphor, but opinionated for software dev.
- **Arch:** Hierarchical role SOPs; shared message pool ("Environment"); publish-subscribe message bus.

### CAMEL-AI â https://github.com/camel-ai/camel  ð¡
- **16,709 stars** Â· updated 2026-04-16
- First multi-agent framework; research-oriented, finding the scaling law of agents.
- **Relevant:** Good academic reference on role-playing dialogue; less production-ready.
- **Arch:** Role-playing pairs; shared conversation history.

### Swarms (kyegomez) â https://github.com/kyegomez/swarms  ð¡
- **6,243 stars** Â· updated 2026-04-16
- "Enterprise-grade production-ready multi-agent orchestration framework."
- **Relevant:** Many topologies (hierarchical, swarm-of-swarms, concurrent). Quality is uneven but useful for pattern library.
- **Arch:** Multiple â hierarchical, mixture-of-agents, swarm router.

### Pydantic AI â https://github.com/pydantic/pydantic-ai  ð¢
- **16,413 stars** Â· updated 2026-04-16
- Agent framework "the Pydantic way" â typed, model-agnostic, production focus.
- **Relevant:** If you value type-safety + Python, this pairs extremely well with FastAPI on Railway. Lightweight alternative to LangGraph.
- **Arch:** Direct agent calls; structured outputs via Pydantic; delegation via tool calls.

### Hugging Face smolagents â https://github.com/huggingface/smolagents  ð¡
- **26,652 stars** Â· updated 2026-04-16
- Barebones library for agents that "think in code."
- **Relevant:** Code-agents paradigm (agent writes Python, executes in sandbox). Complementary to Anthropic Computer Use / Managed Agents â useful as a sandboxed executor.
- **Arch:** Single agent loop; code-execution via E2B or local sandbox.

### Google ADK (Python) â https://github.com/google/adk-python  ð¢
- **19,019 stars** Â· updated 2026-04-16
- Google's official code-first Python toolkit for building/evaluating/deploying agents.
- **Relevant:** Anthropic Managed Agents has a direct Google-side competitor in ADK; compare feature parity if you ever need Gemini for vertical agents.
- **Arch:** Agent-team primitives; native A2A integration; works with Vertex AI + A2A protocol.

### Microsoft Semantic Kernel â https://github.com/microsoft/semantic-kernel  ð¡
- **27,719 stars** Â· updated 2026-04-16
- Integrate LLM tech into apps (C#/Python/Java).
- **Relevant:** Only relevant if .NET/Azure enters the stack. Microsoft is converging AutoGen + SK.

### Haystack â https://github.com/deepset-ai/haystack  ð¡
- **24,857 stars** Â· updated 2026-04-16
- Open-source AI orchestration framework (RAG + agents, pipelines + graphs).
- **Relevant:** Strong for RAG-heavy businesses (e.g. the legal/education projects). More pipeline-oriented than agent-oriented.

### BeeAI Framework (IBM) â https://github.com/i-am-bee/beeai-framework  ð¡
- **3,219 stars** Â· updated 2026-04-16
- Build production-ready agents in Python and TypeScript.
- **Relevant:** IBM's push, ships with the ACP protocol. Worth watching if you adopt ACP.

### AG2 (formerly AutoGen) â https://github.com/ag2ai/ag2  ð¡
- **4,406 stars** Â· updated 2026-04-16
- Community fork of AutoGen after the Microsoft split.
- **Relevant:** Reference only; use microsoft/autogen for upstream.

---

## 3. Orchestration / Runtime / Gateway Layer

### AWS Multi-Agent Orchestrator (agent-squad) â https://github.com/2FastLabs/agent-squad  ð¢
- **7,573 stars** Â· updated 2026-04-16 (originally awslabs/multi-agent-orchestrator)
- Flexible framework for managing multiple agents and complex conversations; classifier routes to agent.
- **Relevant:** Very close conceptually to Jarvis â a supervisor LLM that classifies user intent and routes across a fleet of domain agents. Ideal reference architecture.
- **Arch:** Classifier â supervisor â agent router; shared conversation memory (DynamoDB or plug-ins).

### LangGraph Swarm â https://github.com/langchain-ai/langgraph-swarm-py  ð¢
- **1,468 stars** Â· updated 2026-04-16
- Official LangGraph-based swarm pattern (handoffs + durable state).
- **Relevant:** If you choose LangGraph, this gives you Swarm-style handoffs on top of durable execution. Best-of-both-worlds.

### mcp-agent (lastmile-ai) â https://github.com/lastmile-ai/mcp-agent  ð¢
- **8,271 stars** Â· updated 2026-04-16
- Build effective agents using MCP + simple workflow patterns (augmented-LLM, router, orchestrator, swarm, evaluator-optimizer).
- **Relevant:** Implements Anthropic's "Building Effective Agents" patterns literally. Very close to the house style of your Managed Agents plan.
- **Arch:** MCP-first; patterns include router/parallel/swarm/orchestrator.

### Inngest AgentKit â https://github.com/inngest/agent-kit  ð¢
- **843 stars** Â· updated 2026-04-16
- Multi-agent networks in TypeScript with deterministic routing + MCP tooling.
- **Relevant:** Inngest gives you durable execution / queues for free â natural pairing if you want TS on Vercel + Railway background jobs.

### Trigger.dev â https://github.com/triggerdotdev/trigger.dev  ð¢
- **14,566 stars** Â· updated 2026-04-16
- Build and deploy fully-managed AI agents and workflows (durable runtime).
- **Relevant:** Strong candidate for the "background jobs" slot next to Railway â handles long-running agent tasks. Already have a Trigger.dev skill configured in your environment.

### Temporal â https://github.com/temporalio/temporal  ð¡
- **19,642 stars** Â· updated 2026-04-16
- General-purpose durable execution engine.
- **Relevant:** Heavy, but the gold standard for production long-running agent workflows. Overkill unless you exceed Railway/Trigger limits.

### Portkey AI Gateway â https://github.com/Portkey-AI/gateway  ð¡
- **11,340 stars** Â· updated 2026-04-16
- AI gateway (200+ LLMs, guardrails, routing).
- **Relevant:** Provider abstraction if you need model fallback across Claude/GPT/Gemini.

### LiteLLM â https://github.com/BerriAI/litellm  ð¡
- **43,557 stars** Â· updated 2026-04-16
- 100+ LLM APIs in OpenAI format + proxy.
- **Relevant:** Same role as Portkey; more popular. Useful if Managed Agents need fallback.

### Vercel AI SDK â https://github.com/vercel/ai  ð¢
- **23,551 stars** Â· updated 2026-04-16
- TypeScript AI toolkit; supports tools, agent loops, streaming, generative UI.
- **Relevant:** If any frontend in the 5 businesses is Next.js, this is the obvious agent-runtime for the edge.

### DSPy â https://github.com/stanfordnlp/dspy  ð¡
- **33,751 stars** Â· updated 2026-04-16
- "Programming, not prompting" â declarative programs + optimizers.
- **Relevant:** Orthogonal to orchestration; valuable for optimizing individual agent prompts over time (Stage 3/4 of Jarvis).

---

## 4. Protocols (A2A / ACP / MCP)

### Google A2A Protocol (Python SDK) â https://github.com/a2aproject/a2a-python  ð¢
- **1,833 stars** Â· updated 2026-04-16
- Official Python SDK for the Agent-to-Agent protocol.
- **Relevant:** A2A is becoming the cross-vendor standard for agent interop â Google pushing it, ADK + Mastra already support. Plan for A2A-compatible endpoints if Jarvis ever needs to talk to external agents.

### IBM/BeeAI ACP â https://github.com/i-am-bee/acp  ð¡
- **985 stars** Â· updated 2026-04-16
- Open protocol for communication between AI agents, applications, and humans.
- **Relevant:** Alternative to A2A from the Linux Foundation / IBM camp. Currently smaller, watch for consolidation.

### Python A2A â https://github.com/themanojdesai/python-a2a  ð¡
- **986 stars** Â· updated 2026-04-09
- Third-party Python implementation of the A2A protocol.

### Model Context Protocol â https://github.com/modelcontextprotocol/modelcontextprotocol  ð¢
- **7,838 stars** Â· updated 2026-04-16
- Specification for MCP (tools/resources/prompts).
- **Relevant:** Core of your environment already. Anthropic Managed Agents are MCP-native â stay on-spec for tool servers.

---

## 5. Memory / State / Supporting Infra

### Mem0 â https://github.com/mem0ai/mem0  ð¢
- **53,235 stars** Â· updated 2026-04-16
- Universal memory layer for AI agents.
- **Relevant:** Drop-in multi-tenant agent memory (supports Postgres/Supabase backends). Plug into ECOSYSTEM shared DB per-business.

### Letta (ex-MemGPT) â https://github.com/letta-ai/letta  ð¢
- **22,100 stars** Â· updated 2026-04-16
- Platform for stateful agents with advanced memory that learns/self-improves.
- **Relevant:** If Jarvis needs durable, evolving memory per user/business, Letta is the reference implementation.

### E2B â https://github.com/e2b-dev/E2B  ð¢
- **11,745 stars** Â· updated 2026-04-16
- Secure sandboxed environments for enterprise agents.
- **Relevant:** If vertical agents need to execute arbitrary code (data analysis, scrapers), E2B is the safe execution substrate.

---

## 6. Flow-Builder / Low-Code (reference / competitor tier)

### Langflow â https://github.com/langflow-ai/langflow  ð¡
- **147,015 stars** Â· updated 2026-04-16 â Visual builder for LangChain/agents.
### Dify â https://github.com/langgenius/dify  ð¡
- **138,015 stars** Â· updated 2026-04-16 â Production agentic workflow platform.
### Flowise â https://github.com/FlowiseAI/Flowise  ð¡
- **51,980 stars** Â· updated 2026-04-16 â Visual agent builder (Node).
### n8n â https://github.com/n8n-io/n8n  ð¢
- **184,342 stars** Â· updated 2026-04-16 â Workflow automation with AI nodes; you already have an n8n skill installed. Great for non-Jarvis business automations.
### Botpress â https://github.com/botpress/botpress  ð¡
- **14,639 stars** Â· updated 2026-04-16 â Hub to build/deploy GPT/LLM agents; customer-support heritage.

---

## 7. Vertical / Notable Specialized

### Bytedance deer-flow â https://github.com/bytedance/deer-flow  ð¢
- **62,024 stars** Â· updated 2026-04-16
- Open-source long-horizon SuperAgent harness (research/code/create) with sandboxes + memories + tools + subagents + message gateway.
- **Relevant:** One of the rare production-battle-tested multi-agent harnesses open-sourced by a major tech co. Great architectural study.
- **Arch:** Message gateway + subagents + tool-use â similar pattern to what Jarvis needs.

### SuperAGI â https://github.com/TransformerOptimus/SuperAGI  ð¡
- **17,447 stars** Â· updated 2026-04-16 â Dev-first autonomous agent framework.

### AutoGPT â https://github.com/Significant-Gravitas/AutoGPT  ð¡
- **183,480 stars** Â· updated 2026-04-16 â Original autonomous-agent fever dream; now a platform.

### Open Interpreter â https://github.com/openinterpreter/open-interpreter  ð¡
- **63,161 stars** Â· updated 2026-04-16 â Natural language interface for computers (single-agent).

### UI-TARS (Bytedance) â https://github.com/bytedance/UI-TARS  ð¡
- **10,096 stars** Â· updated 2026-04-16 â GUI-automation agent (browser/desktop).

### PAKTON (legal) â https://github.com/petrosrapto/PAKTON  ð¡
- **36 stars** Â· EMNLP 2025 paper code â multi-agent QA for long legal agreements. Reference for your legal skill.

### SAFe Agentic Workflow â https://github.com/bybren-llc/safe-agentic-workflow  ð¡
- **53 stars** Â· Multi-agent team workflow harness modelled on Scaled Agile. Relevant as a "team-of-agents-per-business" blueprint.

---

## 8. Supporting / Honorable Mentions

- **Claude Agent SDK (Python)** â https://github.com/anthropics/claude-agent-sdk-python â 6,364 â­ â the substrate Anthropic Managed Agents is built on; you're already in this stack. ð¢
- **Agentops** â https://github.com/AgentOps-AI/agentops â 5,475 â­ â observability across most agent frameworks. ð¢
- **Orloj** â https://github.com/OrlojHQ/orloj â 77 â­ â YAML-declared multi-agent orchestration runtime. ð¡ (emerging)
- **OrchStr8 / Routa** â https://github.com/phodal/routa â 681 â­ â workspace-first multi-agent coordination with MCP/ACP/A2A support. ð¡

---

## Architecture Comparison â Coordination Style

| Framework | Coordination | State/Memory | Best for |
|---|---|---|---|
| **CrewAI** | Role delegation + hierarchical/sequential process | Crew-level shared memory | Role-based business squads |
| **AutoGen (v0.4)** | Message bus (distributed actor) | Per-agent local + message log | Async distributed agents |
| **LangGraph** | Graph edges (explicit transitions) | Typed shared state + checkpointer (Postgres/Supabase) | Durable complex orchestration |
| **OpenAI Swarm / Agents SDK** | Handoffs (function returns next agent) | Context vars passed; mostly stateless | Lightweight routing |
| **Agno** | Team modes (route/coordinate/collaborate) | Built-in session + vector + tenant memory | Multi-tenant production |
| **Mastra** | Workflow graph + direct calls | TS runtime state + memory plug-ins | TS / Vercel frontends |
| **MetaGPT** | Publish-subscribe ("Environment") | Shared message pool + SOP documents | Simulated org structures |
| **AWS agent-squad** | Classifier â supervisor â agent | Shared conversation (DynamoDB) | Jarvis-style supervisor pattern |
| **mcp-agent** | Anthropic "effective agents" patterns (router/orchestrator/swarm/evaluator) | MCP session state | MCP-native builds |
| **Temporal / Trigger.dev / Inngest** | Durable workflow engine (below the agent layer) | Engine-owned state | Long-running reliability |
| **A2A / ACP** | Protocol only (HTTP + JSON-RPC / event) | Delegated to agents | Cross-vendor interop |

**Broad patterns:**
- **Message bus / pub-sub:** AutoGen v0.4, MetaGPT, deer-flow (message gateway)
- **Direct handoff (function-return):** OpenAI Swarm/Agents SDK, CrewAI delegation, Mastra
- **Shared typed state + graph:** LangGraph, Mastra workflows, Haystack pipelines
- **Supervisor/router classifier:** AWS agent-squad, Agno (route mode), mcp-agent router pattern
- **Durable engine underneath any of the above:** Temporal, Trigger.dev, Inngest

---

## Recommendations for ECOSSISTEMA (Jarvis + 5 businesses)

1. **Primary candidates to study vs. Anthropic Managed Agents:** `openai/openai-agents-python`, `agno-agi/agno`, `langchain-ai/langgraph` (+ `langgraph-swarm-py`), `awslabs/agent-squad`, `lastmile-ai/mcp-agent`. These five cover every architectural axis Managed Agents has.
2. **Direct-reuse candidates (complement, not compete):** `mem0` (memory on Supabase), `e2b-dev/E2B` (sandboxed execution), `triggerdotdev/trigger.dev` (durable runtime on Railway), `agentops` (observability), `mcp-agent` (Anthropic-style patterns).
3. **Interop future-proofing:** Keep the door open for A2A (`a2aproject/a2a-python`) â your vertical agents should be exposable as A2A endpoints if you want other ecosystems to call them.
4. **Closest conceptual twin to your Jarvis plan:** `awslabs/agent-squad` (classifier â supervisor â specialist fleet) and `bytedance/deer-flow` (message gateway + subagents + tools). Read their architectures in depth before finalizing Stage 2.
5. **Skip / deprioritize:** Heavy flow-builders (Langflow/Dify/Flowise) â they duplicate what your monorepo + Managed Agents already provide. Visual tooling can be a later layer for non-dev stakeholders per business.

Total repos surveyed and rated: **35+**.

