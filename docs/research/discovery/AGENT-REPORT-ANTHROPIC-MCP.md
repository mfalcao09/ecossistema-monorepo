# Agent Report — Anthropic + MCP Ecosystem (verificado via API GitHub)

> 58 repos catalogados: 25 must-clone, 28 consider

Rate limited, but I have comprehensive data across all six categories requested. Here is the structured report.

---

# GitHub Repo Research â AI Agent Ecosystem (Anthropic Managed Agents + Supabase + Railway)

Research date: 2026-04-16. Data pulled via GitHub REST API (anthropics org listing, modelcontextprotocol org listing, plus search queries on MCP servers, Claude Code plugins, Supabase/Stripe/Slack MCPs, computer use, prompt caching, Railway templates).

Rating legend: ð´ must-clone / study now Â· ð¡ consider / keep tabs Â· âª skip for this ecosystem

---

## 1. Anthropic Official Repos (core SDKs, tools, frameworks)

### ð´ Must-clone

- **https://github.com/anthropics/claude-agent-sdk-python** â 6.4k stars Â· pushed 2026-04-16
  Official Python SDK for the Claude Agent SDK. Direct path to building the Jarvis orchestrator and the per-business agents on Managed Agents.

- **https://github.com/anthropics/claude-agent-sdk-typescript** â 1.3k stars Â· pushed 2026-04-16
  Official TypeScript SDK. Relevant if any edge / Next.js surfaces in the monorepo call the agent runtime.

- **https://github.com/anthropics/claude-agent-sdk-demos** â 2.2k stars Â· pushed 2026-03-13
  Reference TypeScript demos for the Agent SDK. First place to crib orchestration patterns before writing Jarvis from scratch.

- **https://github.com/anthropics/agent-sdk-workshop** â 27 stars Â· pushed 2026-03-05
  Anthropic's own workshop materials walking through Agent SDK step by step. Low stars but canonical source.

- **https://github.com/anthropics/claude-cookbooks** â 40.7k stars Â· pushed 2026-04-16
  Actively maintained recipe collection (prompt caching, tool use, batching, RAG, retrieval). This is where production patterns live officially.

- **https://github.com/anthropics/claude-quickstarts** â 16.1k stars Â· pushed 2026-02-05
  Deployable starter apps built on the Claude API â closest official analogue to what the 5-business ecosystem needs for per-project scaffolds.

- **https://github.com/anthropics/skills** â 118.8k stars Â· pushed 2026-04-16
  Public Agent Skills repo. The ecosystem already references Plano V4, so this is table-stakes.

- **https://github.com/anthropics/claude-plugins-official** â 17.1k stars Â· pushed 2026-04-16
  Anthropic-managed directory of Claude Code plugins. Blueprint for how to structure ecosystem plugins.

- **https://github.com/anthropics/knowledge-work-plugins** â 11.3k stars Â· pushed 2026-04-10
  Cowork plugins aimed at knowledge workers â closest pattern match for the education + real-estate + SaaS plugins Marcelo will build.

- **https://github.com/anthropics/prompt-eng-interactive-tutorial** â 34.7k stars Â· pushed 2026-03-01
  Canonical prompt engineering tutorial. Required reading before locking in the Jarvis system prompts.

### ð¡ Consider

- **https://github.com/anthropics/anthropic-sdk-python** â 3.3k stars Â· pushed 2026-04-16
  Raw API SDK (below the Agent SDK). Useful when you need batching / prompt caching primitives directly.

- **https://github.com/anthropics/anthropic-sdk-typescript** â 1.9k stars Â· pushed 2026-04-16
  TS equivalent. Same rationale.

- **https://github.com/anthropics/anthropic-cli** â 305 stars Â· pushed 2026-04-16
  Official Go CLI for the Claude API. Handy for scripting and CI jobs inside the monorepo.

- **https://github.com/anthropics/claude-code-action** â 7.1k stars Â· pushed 2026-04-16
  GitHub Action wrapper around Claude Code. Drop-in for CI in the monorepo.

- **https://github.com/anthropics/claude-code-base-action** â 797 stars Â· pushed 2026-04-16
  Lower-level base for the Action above; use if you need custom CI wiring.

- **https://github.com/anthropics/claude-code-security-review** â 4.3k stars Â· pushed 2026-02-11
  AI security review GitHub Action. Cheap win for the monorepo's CI.

- **https://github.com/anthropics/courses** â 20.6k stars Â· pushed 2025-11-13
  Anthropic's educational courses (API, tools, real-world). Good alignment with the education business line.

- **https://github.com/anthropics/financial-services-plugins** â 7.5k stars Â· pushed 2026-04-16
  Plugin pack for finserv. Not a direct fit, but serves as a reference architecture for vertical plugin bundles.

- **https://github.com/anthropics/life-sciences** â 311 stars Â· pushed 2026-01-27
  Claude Code Marketplace hosting a verticalized plugin bundle. Template for "domain plugin pack" pattern across your 5 businesses.

- **https://github.com/anthropics/devcontainer-features** â 240 stars Â· pushed 2025-12-16
  Anthropic dev container features (ships Claude Code CLI). Useful for standardizing the monorepo's Codespaces.

- **https://github.com/anthropics/riv2025-long-horizon-coding-agent-demo** â 59 stars Â· pushed 2026-02-05
  Anthropic's reference "long-horizon" agent demo. Directly relevant to Jarvis 4-stage design.

### âª Skip for now
- `buffa`, `orjson`, `tokio`, `moka`, `connect-rust`, `terragrunt`, `rclone`, `beam`, `argo-cd`, `s5cmd`, `nix-eval-jobs`, `triton`, `httpcore`, `hypercorn`, `redis-py`, `cfaulthandler`, `torchtyping`, `blobfile` â these are infra forks Anthropic publishes but aren't ecosystem-relevant.
- `anthropic-tools` (archived 2024), `hh-rlhf`, `sleeper-agents-paper`, `ConstitutionalHarmlessnessPaper`, `attribution-graphs-frontend`, `toy-models-of-superposition`, `sycophancy-to-subterfuge-paper`, `rogue-deploy-eval`, `DecompositionFaithfulnessPaper`, `political-neutrality-eval`, `anthropic-retrieval-demo` (archived), `claude-constitution`, `model-cards`, `original_performance_takehome`, `claudes-c-compiler`, `PySvelte` â research artifacts, not production scaffolding.

---

## 2. MCP Core (protocol, SDKs, reference servers)

### ð´ Must-clone

- **https://github.com/modelcontextprotocol/modelcontextprotocol** â 7.8k stars Â· pushed 2026-04-16
  The protocol spec itself. Required reference for custom ecosystem MCP servers.

- **https://github.com/modelcontextprotocol/servers** â 83.9k stars Â· pushed 2026-04-14
  Official MCP server reference repo. Clone-and-crib source for filesystem, fetch, postgres, time, memory servers.

- **https://github.com/modelcontextprotocol/python-sdk** â 22.7k stars Â· pushed 2026-04-16
  Official Python SDK. Default for new ecosystem MCP servers.

- **https://github.com/modelcontextprotocol/typescript-sdk** â 12.2k stars Â· pushed 2026-04-16
  TS SDK â use for servers that live alongside the Next.js apps.

- **https://github.com/modelcontextprotocol/inspector** â 9.5k stars Â· pushed 2026-04-16
  Visual tester for MCP servers. Essential dev tool.

- **https://github.com/modelcontextprotocol/registry** â 6.7k stars Â· pushed 2026-04-15
  Community MCP registry service. Publish ecosystem servers here.

- **https://github.com/modelcontextprotocol/mcpb** â 1.8k stars Â· pushed 2026-04-16
  "Desktop Extensions" â one-click local install of MCP servers. Relevant for Marcelo's desktop Jarvis tier.

### ð¡ Consider

- **https://github.com/modelcontextprotocol/quickstart-resources** â 1.0k stars Â· pushed 2026-04-16
  Tutorial servers and clients â good onboarding for the team.

- **https://github.com/modelcontextprotocol/ext-apps** â 2.1k stars Â· pushed 2026-04-16
  Spec for UI embedded in AI chatbots. Watch this for Jarvis UI patterns.

- **https://github.com/modelcontextprotocol/ext-auth** â 76 stars Â· pushed 2026-04-02
  Auth extensions spec â relevant if ECOSYSTEM Supabase handles MCP server auth.

- **https://github.com/modelcontextprotocol/go-sdk** / **csharp-sdk** / **java-sdk** / **ruby-sdk** / **kotlin-sdk** / **rust-sdk** / **swift-sdk** / **php-sdk** â keep tabs if polyglot surfaces emerge; not needed now.

- **https://github.com/modelcontextprotocol/agents-wg** â 3 stars Â· pushed 2026-03-12
  MCP Agents Working Group staging. Low stars but high strategic signal.

### âª Skip
- `experimental-ext-*` (skills, variants, grouping, interceptors, triggers-events, tool-annotations), `dns`, `static`, `actions`, `example-remote-client`, `servers-archived`, `docs` (archived), `create-python-server`/`create-typescript-server` (archived) â experimental or deprecated.

---

## 3. MCP Servers for Third-Party Tools (production-grade)

### ð´ Must-clone

- **https://github.com/github/github-mcp-server** â 28.9k stars Â· pushed 2026-04-16
  GitHub's official MCP server. Clone for monorepo automation and issue/PR workflows across all 5 businesses.

- **https://github.com/microsoft/playwright-mcp** â 30.9k stars Â· pushed 2026-04-16
  Microsoft's Playwright MCP. Browser automation for real-estate listings scraping, SaaS competitor checks.

- **https://github.com/PrefectHQ/fastmcp** â 24.6k stars Â· pushed 2026-04-15
  Pythonic framework to build MCP servers/clients fast. Default scaffold for new ecosystem servers.

- **https://github.com/googleapis/mcp-toolbox** â 14.6k stars Â· pushed 2026-04-16
  Google's MCP Toolbox for Databases. Directly relevant: ecosystem wants DBs per-project.

- **https://github.com/punkpeye/awesome-mcp-servers** â 84.9k stars Â· pushed 2026-04-15
  Largest curated MCP server list. Primary discovery index.

- **https://github.com/awslabs/mcp** â 8.8k stars Â· pushed 2026-04-16
  Official AWS MCP servers. Relevant if anything spills from Railway into AWS.

### ð¡ Consider

- **https://github.com/alexander-zuev/supabase-mcp-server** â 817 stars Â· pushed 2025-09-26
  Top third-party Supabase MCP â end-to-end management of Supabase via chat. Direct fit for ECOSYSTEM admin tasks. (Note: a newer official Supabase MCP may exist â worth checking supabase.com/docs too.)

- **https://github.com/coleam00/supabase-mcp** â 190 stars Â· pushed 2025-03-29
  Python Supabase MCP â simpler alternative.

- **https://github.com/HenkDz/selfhosted-supabase-mcp** â 126 stars Â· pushed 2026-02-19
  For self-hosted Supabase instances.

- **https://github.com/korotovsky/slack-mcp-server** â 1.5k stars Â· pushed 2026-04-16
  "Most powerful" Slack MCP â no special perms, GovSlack, DMs support. Best-in-class today.

- **https://github.com/ubie-oss/slack-mcp-server** â 110 stars Â· pushed 2026-04-13
  Alternative Slack MCP if you need something simpler.

- **https://github.com/tuannvm/slack-mcp-client** â 168 stars Â· pushed 2026-03-02
  Slack-as-frontend-to-MCP pattern. Interesting if Jarvis exposes via Slack.

- **https://github.com/mcp-use/mcp-use** â 9.8k stars Â· pushed 2026-04-16
  Full-stack MCP framework for ChatGPT / Claude apps and MCP servers. Watch.

- **https://github.com/hangwin/mcp-chrome** â 11.2k stars Â· pushed 2026-01-06
  Chrome extension MCP â browser control from Claude. Consider vs. Playwright MCP.

- **https://github.com/iannuttall/mcp-boilerplate** â 1.0k stars Â· pushed 2026-02-04
  Cloudflare MCP boilerplate with user auth + Stripe for paid tools. Template if the ecosystem monetizes MCP servers.

- **https://github.com/idosal/git-mcp** â 7.9k stars Â· pushed 2026-03-13
  Remote MCP server for any GitHub project â useful for grounding Claude on external OSS used in the monorepo.

- **https://github.com/activepieces/activepieces** â 21.7k stars Â· pushed 2026-04-16
  ~400 MCP servers bundled as automation workflows â MCP alternative to n8n/Zapier for cross-business ops.

- **https://github.com/yzfly/Awesome-MCP-ZH** â 6.9k stars Â· pushed 2026-03-31
  Chinese-language curated MCP list (broader coverage in some categories).

### âª Skip
- `casdoor/casdoor` (IAM server, too heavy), `LaurieWired/GhidraMCP` (reverse engineering), `0x4m4/hexstrike-ai` (offensive security), `webiny/webiny-js` (CMS), `kreuzberg-dev/kreuzberg` (doc extraction â only if you need it) â off-domain.

---

## 4. Claude Code Plugins, Skills, Marketplaces

### ð´ Must-clone

- **https://github.com/hesreallyhim/awesome-claude-code** â 39.1k stars Â· pushed 2026-04-16
  The definitive index of skills, hooks, slash-commands, agent orchestrators, apps, plugins. Primary discovery surface for Jarvis ingredients.

- **https://github.com/ComposioHQ/awesome-claude-skills** â 54.3k stars Â· pushed 2026-02-19
  Composio's curated list of Claude Skills. Second opinion on the above.

- **https://github.com/thedotmack/claude-mem** â 59.4k stars Â· pushed 2026-04-15
  Captures Claude Code session history + AI-compresses context + re-injects. Directly addresses Marcelo's dealbreaker: "perda de memÃ³ria".

### ð¡ Consider

- **https://github.com/jarrodwatts/claude-hud** â 19.6k stars Â· pushed 2026-04-11
  HUD showing context usage, active tools, subagents. Ops visibility for long Jarvis sessions.

- **https://github.com/EveryInc/compound-engineering-plugin** â 14.5k stars Â· pushed 2026-04-16
  "Compound engineering" plugin for Claude/Codex/Cursor. Relevant to multi-step agent orchestration.

- **https://github.com/alirezarezvani/claude-skills** â 11.4k stars Â· pushed 2026-04-13
  232+ skills across engineering, marketing, product, compliance, C-level advisory. Huge mining ground for the 5-business skill set.

- **https://github.com/agenticnotetaking/arscontexta** â 3.1k stars Â· pushed 2026-02-24
  Generates personalized knowledge systems from conversation â fits Marcelo's Jarvis-memory goal.

- **https://github.com/davepoon/buildwithclaude** â 2.7k stars Â· pushed 2026-04-12
  Hub for Skills, Agents, Commands, Hooks, Plugins. Complementary discovery index.

- **https://github.com/brennercruvinel/CCPlugins** â 2.7k stars Â· pushed 2025-10-07
  Claude Code framework focused on "senior engineer" behavior by default. Quick win for monorepo standards.

- **https://github.com/nyldn/claude-octopus** â 2.7k stars Â· pushed 2026-04-16
  Runs up to 8 models per task in parallel for blind-spot coverage. Interesting pattern for Jarvis Stage 4.

- **https://github.com/ykdojo/claude-code-tips** â 7.7k stars Â· pushed 2026-04-02
  45 advanced Claude Code tips (status lines, containerization, Gemini as subordinate). Practical ops reference.

- **https://github.com/ghostwright/phantom** â 1.3k stars Â· pushed 2026-04-16
  "AI co-worker with its own computer. Self-evolving, persistent memory, MCP server, credential vault, email identity. Built on Claude Agent SDK." â this is nearly a Jarvis-equivalent reference implementation; worth close study.

### âª Skip
- `YishenTu/claudian` (Obsidian-specific), `zhukunpenglinyutong/jetbrains-cc-gui` (JetBrains GUI), `ZeframLou/call-me` (phone gimmick) â narrow use cases not aligned with the stack.

---

## 5. Managed-Agents Alternatives / Deployment Patterns

### ð¡ Consider

- **https://github.com/VRSEN/agency-swarm-api-railway-template** â 52 stars Â· pushed 2025-06-02
  Direct prior art: Agency Swarm deployed on Railway. Closest existing template to "Anthropic agents on Railway" pattern. Study even if you don't use Agency Swarm itself.

- **https://github.com/vrsen-ai-solutions/agencii-railway-starter** â 7 stars Â· pushed 2025-06-12
  Tool deployment template on Railway. Same author â reference for Railway wiring conventions.

- **https://github.com/nextjs/deploy-railway** â 36 stars Â· pushed 2025-12-14
  Official Next.js â Railway template. Use for front-ends in the monorepo.

- **https://github.com/anthropics/claude-code-monitoring-guide** â 261 stars Â· pushed 2025-07-29
  Monitoring patterns for Claude Code in production â applicable to Managed Agents too.

### âª Skip
- `monaccode/astromesh-leia` (1 star, too new), `ogabrielluiz/langflow-railway`, `rpuls/medusajs-for-railway-boilerplate`, `railwayapp-templates/fastify-bullmq`, `hanielu/sk-trpc-payload`, `arjunkomath/openclaw-railway-template` â off-domain Railway templates.

---

## 6. Computer Use / Prompt-Caching / Extended-Thinking Patterns

### ð¡ Consider

- **https://github.com/PallavAg/claude-computer-use-macos** â 289 stars Â· pushed 2024-10-24
  macOS computer-use demo (2024 era). Reference for a desktop Jarvis surface on Mac.

- **https://github.com/HumeAI/voice-computer-use** â 11 stars Â· pushed 2024-10-31
  Hume + Anthropic computer use with voice. Interesting for a voice Jarvis tier.

- **https://github.com/arturseo-geo/token-optimizer-skill** â 1 star Â· pushed 2026-03-24
  Low stars but on-topic: model routing (Opus/Sonnet/Haiku), extended thinking, prompt caching, subagent cost mgmt, MCP token audit. Worth a read before building Jarvis cost discipline.

- **https://github.com/vitorpy/atproto-bot** â 1 star Â· pushed 2026-04-16
  Example bot explicitly using Anthropic prompt caching + extended thinking. Small reference.

- **https://github.com/LiranYoffe/simpllm** â 0 stars Â· pushed 2025-11-22
  Unified Python lib for Claude + Gemini with streaming, extended thinking, tool calling, prompt caching. Reference only.

Note: most canonical prompt-caching + extended-thinking patterns live inside **anthropics/claude-cookbooks** (category 1) rather than as standalone repos â that's where to look first.

### âª Skip
- `aetheronhq/claude-on-windows`, `PLZ2001/Computer-Use-on-Windows-OpenRouter-API-Compatible`, `nicholasoxford/computer-use-mac-demo`, `neo-con/claude-computer-quicklaunch`, `trojrobert/anthropic-computer-use-code`, `MohamedAtta-AI/Computer-Use-Agent`, `jamesdiblasi/Anthropic-Computer-Use`, `guyromm/anthropic-computer-use-demo` â 1-year-old hobby forks.

---

## Top 10 Must-Clone Recommendations (ranked)

1. **anthropics/claude-agent-sdk-python** â the SDK Jarvis will be built on
2. **anthropics/claude-cookbooks** â official production patterns (caching, batching, tools)
3. **modelcontextprotocol/servers** â reference MCP servers to fork
4. **anthropics/claude-agent-sdk-demos** â orchestration patterns
5. **modelcontextprotocol/inspector** â MCP dev-loop essential
6. **hesreallyhim/awesome-claude-code** â discovery index for plugins/skills
7. **ghostwright/phantom** â closest existing Jarvis-like agent on Agent SDK
8. **thedotmack/claude-mem** â solves the "perda de memÃ³ria" dealbreaker
9. **github/github-mcp-server** â essential for monorepo automation
10. **alexander-zuev/supabase-mcp-server** â essential for ECOSYSTEM + per-project DBs

## Caveats

- GitHub search API rate-limited before I could run dedicated queries for `gmail-mcp-server`, `anthropic-evals`, and `composio` specifically. Anthropic's own `claude-ai-mcp` (199 stars) showed up in the org listing â worth a look.
- Anthropic does not publish a standalone eval framework repo as of this pull (older `evals` repo last updated 2024). Eval patterns live inside the cookbooks and the (archived) research-paper repos.
- Several "production Claude Agent SDK app" repos claim high stars but descriptions suggest inflated or rehosted README material â verify activity before adopting (e.g., spot-check commit history on `thedotmack/claude-mem`, `jarrodwatts/claude-hud`, `agency-agents`).
- No dedicated "Managed Agents" deploy-template repo exists yet on GitHub â the space is early. The Agency-Swarm-on-Railway templates are the nearest analog.

Total repos noted: **58** (25 must-clone, 28 consider, skip list compressed).

