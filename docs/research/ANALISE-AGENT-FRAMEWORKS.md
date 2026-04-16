# Análise Profunda — Agent Frameworks (7 repos)

> SuperClaude, Continuous-Claude-v3, superpowers, awesome-claude-code, everything-claude-code, anthropics/skills, opencode
> Gerado por agente de pesquisa em 2026-04-15

I now have comprehensive data on all 7 repos. Here is the structured analysis report.

---

# Deep Analysis Report: 7 Agent Framework Repos

## 1. SuperClaude_Framework

**What it ACTUALLY does:** A meta-programming configuration framework that injects 30 slash commands, 20 specialized agents, and 7 behavioral modes into Claude Code. It is a Python package (pip-installable) that copies markdown files into `~/.claude/commands/sc/`, `~/.claude/agents/`, and `~/.claude/skills/`. Includes a pytest plugin with confidence-checking, self-check, and reflexion patterns. Optional MCP server integration (Tavily, Context7, Sequential-Thinking, Serena, Playwright, etc.) via an AIRIS gateway.

**Architecture:**
- Python CLI (`superclaude install`) copies `.md` command/agent/mode definitions to user home `~/.claude/`
- Core patterns: ConfidenceChecker (pre-exec gate at 90%), SelfCheckProtocol (post-impl validation), ReflexionPattern (error learning)
- Wave-Checkpoint-Wave parallel execution pattern (3.5x speedup)
- Token budget system: simple=200, medium=1000, complex=2500
- MCP gateway (airis-mcp-gateway) unifies 60+ tools behind single SSE endpoint
- v5.0 planned: TypeScript plugin system for marketplace distribution

**Applicable to our ecosystem:**
- The confidence-checking pattern (>=90% proceed, 70-89% present alternatives, <70% ask questions) is directly applicable to Managed Agents making autonomous decisions
- Behavioral modes (Brainstorming, Deep Research, Orchestration, Token Efficiency) are a good model for how Jarvis should shift behavior by context
- The MCP gateway pattern (single endpoint wrapping multiple tools) fits the Railway deployment model
- Wave-Checkpoint-Wave parallelism maps well to subagent orchestration

**Key files:**
- `/research-repos/SuperClaude_Framework/src/superclaude/pm_agent/confidence.py` -- confidence gate logic
- `/research-repos/SuperClaude_Framework/src/superclaude/execution/parallel.py` -- parallel execution
- `/research-repos/SuperClaude_Framework/src/superclaude/commands/` -- 30 command definitions
- `/research-repos/SuperClaude_Framework/src/superclaude/agents/` -- 20 agent definitions

---

## 2. Continuous-Claude-v3

**What it ACTUALLY does:** A persistent, learning, multi-agent development environment that solves Claude Code's compaction problem. Uses PostgreSQL+pgvector for cross-session memory, YAML handoffs for session transfers, a 5-layer TLDR code analysis tool (AST, Call Graph, CFG, DFG, PDG) that achieves 95% token savings, and a daemon that auto-extracts learnings from thinking blocks after sessions end. 109 skills, 32 agents, 30 hooks.

**Architecture:**
- PostgreSQL + pgvector with 4 tables: `sessions` (heartbeat), `file_claims` (cross-terminal locking), `archival_memory` (BGE embeddings 1024-dim), `handoffs` (session transfers)
- TLDR 5-layer code analysis: L1 AST (~500 tok) -> L2 Call Graph (+440) -> L3 CFG (+110) -> L4 DFG (+130) -> L5 PDG (+150) = ~1200 tokens vs 23000 raw
- Continuity loop: SessionStart loads context -> Working tracks changes -> PreCompact auto-handoff -> SessionEnd daemon extracts learnings -> /clear starts fresh
- Daemon: detects stale heartbeat (>5min) -> spawns headless Claude (Sonnet) -> analyzes thinking blocks -> stores to archival_memory
- Meta-skill workflows: /fix (sleuth->premortem->kraken->test->commit), /build (discovery->plan->validate->implement->commit)
- Hook system: 30 hooks across SessionStart, PreToolUse, PostToolUse, PreCompact, UserPromptSubmit, SubagentStop, SessionEnd
- TLDR semantic index with BGE-large-en-v1.5 and FAISS for natural language code search

**Applicable to our ecosystem:**
- **The entire memory architecture is directly adoptable for Jarvis.** PostgreSQL + pgvector for archival memory maps perfectly to Supabase (which has pgvector). The 4-table schema is a clean model for cross-session state.
- YAML handoff format for session continuity solves exactly our "dealbreaker" of memory loss
- The daemon pattern (auto-extract learnings from thinking blocks) is a key innovation for building compound learning into Managed Agents
- TLDR code analysis tool demonstrates how to dramatically reduce token usage -- applicable to any agent doing code work
- Hook architecture (30 hooks across 7 lifecycle events) shows how to instrument agents for observability
- Cross-terminal coordination via DB (sessions + file_claims) is a pattern for multi-agent concurrency on shared repos

**Key files:**
- `/research-repos/Continuous-Claude-v3/.claude/hooks/` -- 30 hook definitions
- `/research-repos/Continuous-Claude-v3/.claude/skills/` -- 109 skills
- `/research-repos/Continuous-Claude-v3/.claude/agents/` -- 32 agent definitions
- `/research-repos/Continuous-Claude-v3/opc/packages/tldr-code/` -- 5-layer code analysis
- `/research-repos/Continuous-Claude-v3/.claude/rules/` -- System policies (claim-verification, dynamic-recall, etc.)

---

## 3. Superpowers (obra/superpowers)

**What it ACTUALLY does:** A composable skills framework for coding agents that enforces a spec-before-code discipline. 14 skills covering the full SDLC: brainstorming -> writing-plans -> subagent-driven-development -> test-driven-development -> code-review -> finishing. Zero dependencies. Works across Claude Code, Cursor, Codex, OpenCode, Gemini CLI. The key innovation is "subagent-driven-development" -- dispatching fresh subagents per task with two-stage review (spec compliance, then code quality).

**Architecture:**
- Pure markdown SKILL.md files with YAML frontmatter -- no code, no runtime, no dependencies
- Skills auto-trigger based on context (agent checks for relevant skills before any task)
- Core workflow: brainstorming -> using-git-worktrees -> writing-plans -> subagent-driven-development -> test-driven-development -> requesting-code-review -> finishing-a-development-branch
- Subagent-driven-development pattern: fresh subagent per task -> implementer -> spec reviewer subagent -> code quality reviewer subagent -> mark complete
- Hard gates: HARD-GATE tags in skills that BLOCK implementation until design is approved
- Anti-complexity philosophy: zero dependencies, no MCP servers, skills are just instructions
- Cross-harness: plugin marketplace for Claude Code, manual setup for Codex/OpenCode/Gemini

**Applicable to our ecosystem:**
- **The subagent-driven-development pattern is THE key pattern for Managed Agents.** Dispatch fresh agent per task with isolated context, two-stage review. Directly maps to Anthropic's Task tool.
- The brainstorming skill's HARD-GATE pattern (block implementation until design approved) is a governance pattern for Jarvis
- Writing-plans skill produces plans that "an enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing" can follow -- this is exactly the prompt clarity needed for subagents
- Zero-dependency philosophy aligns with keeping our ecosystem simple
- Git worktree pattern for parallel agent branches is directly applicable

**Key files:**
- `/research-repos/superpowers/skills/subagent-driven-development/SKILL.md` -- THE core pattern
- `/research-repos/superpowers/skills/brainstorming/SKILL.md` -- spec-before-code with HARD-GATE
- `/research-repos/superpowers/skills/writing-plans/SKILL.md` -- plan formatting for agents
- `/research-repos/superpowers/skills/test-driven-development/SKILL.md` -- TDD enforcement

---

## 4. awesome-claude-code

**What it ACTUALLY does:** A curated catalog of Claude Code extensions, organized by category: Agent Skills, Workflows/Knowledge Guides, Tooling, Status Lines, Hooks, Slash Commands, CLAUDE.md files, and Alternative Clients. Not a framework itself -- it is an index of the ecosystem. Key referenced projects include Superpowers, SuperClaude, Everything Claude Code, Claude Squad (multi-agent tmux), Container Use (Docker sandboxes for agents), Compound Engineering Plugin, Ralph Wiggum (autonomous loop pattern), and many more.

**Architecture:** N/A (curated list)

**Applicable to our ecosystem:**
- **Discovery resource** for patterns we should adopt. Key finds:
  - **Claude Squad** (smtg-ai): multi-agent tmux management -- model for running multiple Managed Agents in parallel
  - **Container Use** (dagger): Docker sandboxes for agents -- model for safe agent execution
  - **Compound Engineering Plugin** (EveryInc): turns past mistakes into lessons -- compound learning pattern
  - **Ralph Wiggum pattern**: autonomous loop until completion -- applicable to long-running Managed Agent tasks
  - **Claude Hub**: webhook connecting Claude Code to GitHub PRs/issues -- model for Jarvis GitHub integration
  - **cc-tools**: Go-based hooks with minimal overhead -- performance pattern
  - **AgentSys**: deterministic detection (regex, AST) with LLM judgment

**Key files:**
- `/research-repos/awesome-claude-code/README.md` -- the entire catalog

---

## 5. everything-claude-code (ECC)

**What it ACTUALLY does:** A cross-harness agent performance system. Works across Claude Code, Codex, Cursor, OpenCode, and Gemini. Provides 48 agents, 183 skills, 79 legacy command shims, hooks, and rules organized by language (TypeScript, Python, Go, Swift, PHP, Perl, Java, Kotlin, C++, Rust). Includes AgentShield security scanner (1282 tests, 102 rules), continuous-learning-v2 with instinct-based learning and confidence scoring, and a Rust control-plane prototype (ECC 2.0 alpha). Anthropic hackathon winner.

**Architecture:**
- Plugin-based distribution via Claude Code marketplace + npm (`ecc-universal`)
- Cross-harness adapter: DRY adapter pattern transforms Cursor's 15 hook events to match Claude Code's 8 hooks -- reuses same `scripts/hooks/*.js`
- AGENTS.md at project root is the universal cross-tool context file (read by all 4 harnesses)
- Continuous learning v2: instinct-based system with confidence scoring, import/export, evolution (cluster instincts into skills)
- AgentShield: red-team/blue-team/auditor pipeline using 3 Opus agents for adversarial security analysis
- Hook runtime controls: `ECC_HOOK_PROFILE=minimal|standard|strict` and `ECC_DISABLED_HOOKS=...`
- SQLite state store for tracking installed components
- Session adapters for structured recording
- Operator workflows: brand-voice, social-graph, billing-ops, cost-audit

**Applicable to our ecosystem:**
- **Cross-harness compatibility pattern** is valuable if we ever need agents that work beyond Claude Code
- The AGENTS.md universal file convention is a good standard for agent context
- Continuous learning v2 (instincts with confidence scoring) is a sophisticated evolution model -- agents learn from sessions and "evolve" instincts into skills automatically
- AgentShield adversarial security pattern (red-team + blue-team + auditor) is applicable to securing our Managed Agents
- Hook runtime controls (profiles + disabling) provide operational flexibility
- The `rules/common/` + `rules/{language}/` directory structure is a clean model for language-specific agent guidance
- Token optimization settings are directly usable: `model: sonnet`, `MAX_THINKING_TOKENS: 10000`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: 50`

**Key files:**
- `/research-repos/everything-claude-code/agents/` -- 48 agent definitions
- `/research-repos/everything-claude-code/skills/continuous-learning-v2/` -- instinct-based learning
- `/research-repos/everything-claude-code/hooks/hooks.json` -- hook configuration
- `/research-repos/everything-claude-code/rules/` -- multi-language rule system
- `/research-repos/everything-claude-code/mcp-configs/mcp-servers.json` -- MCP configs

---

## 6. skills (Anthropic Official)

**What it ACTUALLY does:** Anthropic's official reference implementation of the Agent Skills standard. Contains 17 example skills spanning creative (algorithmic-art, canvas-design, slack-gif-creator), technical (mcp-builder, webapp-testing, claude-api), enterprise (brand-guidelines, internal-comms), and document skills (docx, pdf, pptx, xlsx -- the actual skills powering Claude's document capabilities). Also includes the skill-creator meta-skill for building and evaluating new skills. Spec lives at agentskills.io.

**Architecture:**
- Each skill is a folder with `SKILL.md` (YAML frontmatter: name + description) + optional bundled resources
- YAML frontmatter triggers: `name` (identifier) + `description` (what it does AND when to trigger -- this is the PRIMARY triggering mechanism)
- Skills are "pushy" in descriptions to combat Claude's tendency to "undertrigger"
- Skill-creator has a full eval loop: write draft -> create test prompts -> run eval -> review qualitative + quantitative results -> iterate
- Document skills (docx, pdf, pptx, xlsx) are source-available reference for production skills
- Plugin marketplace distribution: `/plugin marketplace add anthropics/skills`
- Works on Claude Code, Claude.ai, and the API

**Applicable to our ecosystem:**
- **This IS the canonical skill format.** Our ecosystem skills should follow this exact structure: `SKILL.md` with YAML frontmatter
- The skill-creator meta-skill pattern (eval loop with quantitative benchmarks) is the model for how we build and iterate skills for Jarvis
- "Pushy" description pattern (include all trigger contexts) solves the undertriggering problem
- Document skills (pdf, xlsx, docx, pptx) are reference implementations for complex skills with bundled resources
- The mcp-builder skill shows how to create skills that build MCP servers
- Spec at agentskills.io is the standard we should track

**Key files:**
- `/research-repos/skills/template/SKILL.md` -- canonical skill template
- `/research-repos/skills/skills/skill-creator/SKILL.md` -- meta-skill for creating/evaluating skills
- `/research-repos/skills/skills/claude-api/` -- API integration patterns
- `/research-repos/skills/skills/mcp-builder/` -- MCP server creation skill

---

## 7. opencode

**What it ACTUALLY does:** A fully open-source AI coding agent (alternative to Claude Code) built by the creators of terminal.shop. Provider-agnostic -- supports Anthropic, OpenAI, Google, xAI, Mistral, Groq, DeepInfra, Cerebras, Cohere, Perplexity, Alibaba, GitLab, and local models. Has a client/server architecture, built-in LSP support, and a TUI focus (by neovim users). Available as CLI and desktop app (Electron). Uses the Vercel AI SDK for multi-provider abstraction. Written in TypeScript with Effect library for type-safe error handling.

**Architecture:**
- Monorepo: `packages/opencode` (core), `packages/console` (TUI), `packages/desktop` (Electron), `packages/server`, `packages/sdk`, `packages/plugin`, `packages/enterprise`
- Provider abstraction via Vercel AI SDK (`@ai-sdk/*`): 20+ providers bundled (Anthropic, OpenAI, Google, Azure, Bedrock, xAI, etc.)
- Agent system: `build` (full-access default), `plan` (read-only analysis), `general` (complex subagent tasks)
- Agent schema with `mode: "subagent" | "primary" | "all"`, permission rulesets, optional model override
- Effect library (effect-ts) for dependency injection and type-safe service composition
- Plugin system with MCP integration
- Skill system with `SKILL.md` format (compatible with Claude Code's)
- OpenTelemetry tracing via `@effect/opentelemetry`
- Client/server split enables remote driving (e.g., mobile app driving desktop agent)

**Applicable to our ecosystem:**
- **Provider abstraction pattern is critical.** If we ever need to run agents against non-Anthropic models (cost optimization, fallback), OpenCode's multi-provider architecture via Vercel AI SDK is the reference implementation
- The client/server architecture (drive agent remotely) maps to Jarvis's architecture -- API server on Railway, multiple clients
- Agent schema with `mode: "subagent" | "primary" | "all"` and permission rulesets is a clean model for agent definition
- Plugin system architecture is relevant if we build reusable ecosystem components
- Effect library usage for DI and error handling is a sophisticated pattern for TypeScript services
- The enterprise package suggests patterns for multi-tenant agent deployments

**Key files:**
- `/research-repos/opencode/packages/opencode/src/agent/agent.ts` -- agent schema and service
- `/research-repos/opencode/packages/opencode/src/provider/provider.ts` -- multi-provider abstraction
- `/research-repos/opencode/packages/opencode/src/mcp/` -- MCP integration
- `/research-repos/opencode/packages/opencode/src/plugin/` -- plugin system

---

## Cross-Repo Synthesis: What To Adopt for Anthropic Managed Agents + Supabase

### Tier 1 -- Adopt Immediately

| Pattern | Source | Application |
|---------|--------|-------------|
| **Subagent-driven-development** (fresh agent per task + two-stage review) | superpowers | Core Managed Agent dispatch pattern |
| **PostgreSQL + pgvector memory** (4-table schema: sessions, file_claims, archival_memory, handoffs) | Continuous-Claude-v3 | Supabase memory layer for Jarvis |
| **YAML handoff format** for session continuity | Continuous-Claude-v3 | Cross-session state preservation |
| **SKILL.md with YAML frontmatter** as canonical skill format | skills (Anthropic) | Standard for all ecosystem skills |
| **Confidence gate** (>=90% proceed, 70-89% alternatives, <70% ask) | SuperClaude | Autonomous decision governance |
| **HARD-GATE** pattern (block implementation until design approved) | superpowers | Governance for autonomous agents |

### Tier 2 -- Adopt Next

| Pattern | Source | Application |
|---------|--------|-------------|
| **TLDR 5-layer code analysis** (95% token savings) | Continuous-Claude-v3 | Token optimization for code-focused agents |
| **Daemon auto-extract learnings** from thinking blocks | Continuous-Claude-v3 | Compound learning for Jarvis |
| **Continuous learning v2** (instinct-based with confidence scoring) | everything-claude-code | Agent self-improvement over time |
| **Hook lifecycle system** (7 events, 30 hooks) | Continuous-Claude-v3 | Agent observability and instrumentation |
| **Multi-language rules** (common/ + per-language/) | everything-claude-code | Rule organization per project type |
| **Wave-Checkpoint-Wave** parallel execution | SuperClaude | Subagent orchestration pattern |

### Tier 3 -- Evaluate for Later

| Pattern | Source | Application |
|---------|--------|-------------|
| **Provider abstraction** via AI SDK | opencode | Multi-model support / cost optimization |
| **AgentShield adversarial security** (red/blue/auditor) | everything-claude-code | Agent security auditing |
| **Ralph Wiggum loop** (autonomous until completion) | awesome-claude-code refs | Long-running Managed Agent tasks |
| **Cross-harness adapter** (DRY pattern) | everything-claude-code | Future multi-IDE support |
| **Client/server agent architecture** | opencode | Remote agent driving |
| **Skill-creator eval loop** | skills (Anthropic) | Systematic skill quality improvement |

