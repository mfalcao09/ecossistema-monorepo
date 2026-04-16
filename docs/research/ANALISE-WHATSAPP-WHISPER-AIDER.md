# Análise Profunda — 5 Repos Estratégicos (WhatsApp, n8n-mcp, RAG, Whisper, Aider)

> Gerado por agente em 2026-04-15

I have comprehensive understanding. Let me deliver the structured analysis.

---

# Deep Analysis â 5 Research Repos for Ecossistema V9

All files reviewed are clean open-source code (not malware). Findings below are direct observations from source.

---

## 1. whatsapp-claude-gpt â Jarvis Stage 2 (WhatsApp)

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/whatsapp-claude-gpt/`

### What it actually does
A Node.js/TypeScript WhatsApp bot built on `whatsapp-web.js` (Puppeteer-driven WhatsApp Web automation). Supports multi-provider LLMs (OpenAI, Anthropic, DeepSeek, Qwen, Deepinfra, ElevenLabs), voice I/O (Whisper STT + TTS), image gen/edit, reminders with cron-like recurrence, and per-user/group memory persistence via Drizzle ORM + SQLite.

### Architecture
- **Entry** (`src/index.ts`): Puppeteer flags for headless Chromium, `LocalAuth` strategy persists session on disk. QR scan at first boot.
- **Orchestrator** (`src/bot/roboto.ts`): Singleton `RobotoClass` â `readWspMessage()` is the hot path. Uses a `busyChats: Set<string>` for per-chat mutex (serializes messages of the same chat, polls every 2s). Typing-state loop `sendStateTyping` runs while busy.
- **Message ingestion** (`src/bot/wsp-web.ts`): `generateMessageArray()` fetches recent messages (default 30 / 24h), supports `-reset` sentinel that truncates history, converts each message to `AiMessage` with normalized `{role, name, content[]}`. Media (images, audio, docs, stickers) routed by `MessageTypes`. Audio â Whisper transcription, cached in `NodeCache` keyed by `msg.id._serialized`.
- **Provider abstraction** (`src/services/*`): Each provider has `sendMessage`, `addMessageToCache`, `hasChatCache`, `deleteChatCache`. Anthropic service has explicit tool-use cycle loop (up to 5 cycles) with `tool_use` â execute â `tool_result` roundtrip via `Roboto.handleFunction`.
- **Tools registered** (`src/config/functions.ts`): `generate_image`, `generate_speech`, `reminder_manager`, `user_memory_manager`, `group_memory_manager`.
- **Reminders** (`src/services/reminder-service.ts`): `setInterval` every 59s polls `remindersTable` via Drizzle, fires reminders up to 60 min late, uses `date-fns-tz` for timezone-aware scheduling.

### Authentication
- **NOT an official WhatsApp Business API** â uses `whatsapp-web.js` which scrapes WhatsApp Web through Puppeteer. `LocalAuth` persists session cookies locally. No OAuth, no webhook architecture. This is a **dealbreaker for production ecosystem** (rate-limit/ban risk, single phone number per instance, fragile to WhatsApp internal API changes â see the "ExecutionContext error" workaround in README).
- Admin numbers whitelist in env (`adminNumbers`). Per-chat rate limiting is implicit via the `busyChats` serialization.

### Session isolation
- Isolation is **per-chat** using `chatId = chat.id._serialized`. All caches (`msgMediaCache`, `transcribedMessagesCache`, message history, chat config) keyed by chatId. Groups vs DMs handled by `chatData.isGroup`. No multi-tenant isolation beyond chatId.

### Media handling
- Images: base64 via `MessageMedia`, size-capped (`maxImageSizeMB`). Stickers supported.
- Audio: WhatsApp voice (`VOICE`/`AUDIO`) â buffer â stream â Whisper (OpenAI `whisper-1`). Cached for `NODE_CACHE_TIME` seconds (default 3 days).
- TTS: OpenAI `tts-1` or ElevenLabs (`eleven_multilingual_v2`). Reply with `sendAudioAsVoice: true`.

### Rate limiting
- None explicit. Only the busy-chat mutex. No per-user quota. A determined attacker could flood the bot.

### Applicable to ecosystem â Jarvis Stage 2
- **Message-loop pattern is reusable** â the shape of `readWspMessage` â dedupe â fetch context â inject memory â call LLM â handle tool_use cycle â reply is directly applicable.
- **DO NOT REUSE** the `whatsapp-web.js` transport. For V9 ecosystem you need either WhatsApp Cloud API (Meta official, webhook-based) or Baileys (if multi-device unofficial is acceptable). The README even has a flag that `whatsapp-web.js` was renamed to `whatsapp-library.js` â suggests the upstream is unstable.
- **Reusable patterns**: tool-use cycle loop, per-chat mutex, `-reset` sentinel for context truncation, NodeCache for transcript cache, per-chat config override table, separation of Memory/Reminder as tool-callable services.
- **Memory schema is worth stealing** (`memory-service.ts`): real_name, age, profession, location, interests, likes, dislikes, running_jokes, nicknames, notes + group-level equivalents. Maps cleanly to Supabase table.

### Key files
- `src/bot/roboto.ts` â orchestrator/message loop
- `src/bot/wsp-web.ts` â transport abstraction, media conversion
- `src/services/anthropic-service.ts` â tool-use cycle loop (Claude-specific)
- `src/services/reminder-service.ts` â scheduler pattern
- `src/services/memory-service.ts` â memory schema
- `src/config/functions.ts` â tool definitions (didn't open but referenced)
- `src/db/schema.ts` â Drizzle schema

### Reality check
- Voice I/O: works, battle-tested with Whisper.
- Reminders/memory: working, simple, useful.
- **WhatsApp transport: aspirational for production.** The repo openly documents version-breaking bugs in `whatsapp-web.js`. For V9's 5 businesses, you'll face ban risk and rate limits. Use Meta Cloud API + webhooks.

---

## 2. n8n-mcp â MCP wrapper for n8n

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/n8n-mcp/`

### What it actually does
**Critical clarification:** n8n-mcp does **NOT expose your n8n workflows as MCP tools to an LLM**. It exposes **knowledge of n8n nodes** (documentation, schemas, validation) so an LLM can build workflows. It's a "how to n8n" knowledge server, not a "run my workflows" proxy.

Contains:
- SQLite DB of 1,505 n8n nodes (812 core + 693 community) with 99% property coverage
- 2,709 workflow templates
- Validation engine (4 levels: minimal / runtime / full / post-deploy)
- Optional n8n API integration (tools named `n8n_create_workflow`, `n8n_validate_workflow`, `n8n_update_partial_workflow`, `n8n_test_workflow`) â these DO talk to a live n8n instance if `N8N_API_URL`/`N8N_API_KEY` provided.

### Architecture
Mature TypeScript project (~150 source files, 3,336 tests). Clean layering:
- **Loaders â Parsers â Mappers â Database** (one-time rebuild indexes all n8n packages into SQLite with FTS5)
- **Service layer**: `property-filter`, `config-validator`, `enhanced-config-validator`, `expression-validator`, `workflow-validator`, `type-structure-service`
- **Repository pattern**: `node-repository.ts` is sole DB access.
- **MCP server** (`src/mcp/server.ts` + `tools.ts`): tool definitions are just JSONSchema + handlers. Three transport modes: stdio (Claude Desktop), Streamable HTTP, legacy SSE.
- **Multi-tenant**: HTTP mode accepts `x-n8n-url`, `x-n8n-key`, `x-instance-id`, `x-session-id` headers. `SessionState` persists across connections (v2.24.1).
- **Workflow diff engine** (v2.7.0): `n8n_update_partial_workflow` saves 80-90% tokens by sending only deltas.

### Auth
- HTTP mode: Bearer token via `AUTH_TOKEN` env or `AUTH_TOKEN_FILE`. Min 32 chars enforced, default-token detection refuses to start in production. `AuthManager.timingSafeCompare` for the check.
- `express-rate-limit` on auth endpoints.
- Prototype-pollution hardened (`Object.create(null)` for session maps â explicit CodeQL fix).

### Error handling
- Multi-level validation prevents bad workflows reaching n8n.
- `validate_node({mode: 'minimal'})` <100ms for required-field check.
- `validate_workflow` checks connections, expressions, AI tools.
- Pre-handshake error capture via `EarlyErrorLogger` singleton, `STARTUP_CHECKPOINTS` for failure diagnosis.

### Applicable to ecosystem
- **Directly usable as-is** for any agent in the ecosystem that needs to build n8n workflows. Connect Claude to n8n-mcp via stdio or HTTP.
- **Jarvis Stage 1 (CLI)**: Plug n8n-mcp into Claude Code's MCP config. This is how the README itself recommends setup (`./docs/CLAUDE_CODE_SETUP.md`).
- **Jarvis Stages 2â4**: Use `mcp-engine.ts` (Clean API for service integration) to embed directly â or deploy the HTTP server on Railway (they ship `Dockerfile.railway` and `railway.json`).
- **Pattern to steal**: the 4-level validation ladder is excellent. Mimic for Supabase schema validation, for Intentus/Nexvy API wrappers.
- **Patterns to steal**: `ConsoleManager` for stdio MCP output isolation; `console-manager.ts` prevents log pollution of MCP protocol.
- The "Claude Project Setup" prompt (CLAUDE.md principles: Silent Execution, Parallel Execution, Templates First, Never Trust Defaults) is a ready-made system prompt for workflow-building agents.

### Key files
- `src/mcp/tools.ts` â 40+ tool definitions, JSONSchema + annotations
- `src/mcp/server.ts` â MCP server (not read but referenced)
- `src/http-server-single-session.ts` â HTTP transport with auth, rate limit, multi-tenant headers
- `src/mcp-engine.ts` â embeddable API
- `src/services/workflow-validator.ts`, `expression-validator.ts`, `enhanced-config-validator.ts`
- `CLAUDE.md` â system prompt template
- `railway.json`, `Dockerfile.railway` â ready-to-deploy on Railway (matches V9 decision)

### Reality check
- **Real and production-grade.** npm-published, Docker image on ghcr, dashboard.n8n-mcp.com hosted version (100 tool calls/day free tier). 3336 passing tests. Actively maintained.
- **Caveat**: Knowledge base is as fresh as the rebuild; requires periodic `npm run update:n8n`.
- **Useful for V9 immediately** â deploy on Railway, connect to Managed Agents, and any agent building automations gets full n8n knowledge.

---

## 3. RAG_chatabot_with_Langchain â RAG tutorial-grade implementation

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/RAG_chatabot_with_Langchain/`

### What it actually does
A single-file (972 LOC) Streamlit app demonstrating a classical LangChain RAG pipeline. Supports OpenAI/Google/HuggingFace providers, Chroma vectorstore, 3 retriever strategies, 2 memory types. Educational, not production.

### Architecture
Linear flow in `RAG_app.py`:
- **Document loading** (`langchain_community.document_loaders`): PDF (`PyPDFLoader`), TXT (`TextLoader`), CSV (`CSVLoader`), DOCX (`Docx2txtLoader`), via `DirectoryLoader`.
- **Chunking** (`split_documents_to_chunks` @ line 417): `RecursiveCharacterTextSplitter(chunk_size=1600, chunk_overlap=200)` â single-pass, no semantic chunking, no parent-document pattern.
- **Embedding** (`select_embeddings_model` @ 425): provider-switched. OpenAI, `models/embedding-001` (Google), `thenlper/gte-large` (HF).
- **Vectorstore**: Chroma, persisted to `data/vector_stores/{name}`.
- **Retriever** (`create_retriever` @ 443): 3 strategies, all stackable on a base `Vectorstore_backed_retriever`:
  1. Raw vectorstore (`base_retriever_k=16`)
  2. Contextual compression pipeline: `CharacterTextSplitter(500, separator=". ")` â `EmbeddingsRedundantFilter` â `EmbeddingsFilter(k=16)` â `LongContextReorder`
  3. Cohere reranker (`rerank-multilingual-v2.0`, top_n=10)
- **Memory**: `ConversationBufferMemory` or `ConversationSummaryBufferMemory` â attaches conversation history to the retrieval chain.
- **Chain**: `ConversationalRetrievalChain` orchestrates: condense question â retrieve â stuff docs into prompt â LLM.

### Applicable to ecosystem
- **Reference implementation, NOT production code.** Streamlit UI makes it useless as a backend. Single-user. No auth, no rate limiting, API keys stored in Streamlit session state (client-side).
- **Ideas to steal:**
  - Chunk size `1600/200` is a reasonable default for Portuguese-language educational/legal docs (your EDU/real-estate domain)
  - `LongContextReorder` â simple but effective for reducing "lost in the middle" failures
  - Two-stage retrieve (vector k=16 â rerank top_n=10) is a sensible pipeline shape
- **For V9**: build your own RAG layer on Supabase pgvector (single DB, RLS-friendly per-business) + Cohere rerank API. Don't use LangChain for production â it's over-abstracted; the `ConversationalRetrievalChain` adds latency and hides prompt-engineering you'll want to control. Use Claude's native tool calling + direct pgvector + Cohere rerank.
- **Applies to Jarvis Stage 1+**: Every stage benefits from RAG over your memory/docs â but implement it natively, not via this codebase.

### Key files
- `RAG_app.py` lines 417â422 (chunking), 443â599 (retriever strategies), 602+ (chain assembly â not read past 629)

### Reality check
- **Aspirational for production.** It's a good blog-post companion. Treat as "this is the shape of a LangChain RAG pipeline" â use the ideas, discard the code.
- Portuguese welcome message is hardcoded; i18n is shallow.
- No evaluation harness, no RAGAS, no observability.

---

## 4. whisper â OpenAI speech-to-text (reference implementation)

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/whisper/`

### What it actually does
OpenAI's official Whisper research repo. Transformer encoder-decoder, log-Mel spectrogram â text, 99 languages. CLI + Python library.

### Model sizes & tradeoffs (from README + `__init__.py`)
| Size | Params | VRAM | Relative speed | English-only variant |
|---|---|---|---|---|
| tiny | 39M | ~1GB | ~10x | tiny.en |
| base | 74M | ~1GB | ~7x | base.en |
| small | 244M | ~2GB | ~4x | small.en |
| medium | 769M | ~5GB | ~2x | medium.en |
| large (v1/v2/v3) | 1550M | ~10GB | 1x | no |
| turbo (= large-v3-turbo) | 809M | ~6GB | ~8x | no |

- `turbo` is the sweet spot for transcription in 2025: near-large-v3 accuracy at ~8x speed. **Cannot translate** (README explicitly notes â use `medium`/`large` for translation).
- `.en` variants outperform multilingual on English, especially at tiny/base. Less meaningful at small/medium.
- Portuguese performance: mid-tier (see language WER chart); `large-v3` strongly recommended for PT-BR. Expect higher WER than Spanish/English.

### Latency & architecture
- Not streaming by design: `transcribe()` reads entire file, chunks into 30-second windows, runs autoregressive decode per window (`transcribe.py` line 38+).
- Fallback temperature schedule: `(0.0, 0.2, 0.4, 0.6, 0.8, 1.0)` â retries on `compression_ratio_threshold` or `logprob_threshold` failure.
- `condition_on_previous_text=True` â previous window's output feeds next window's prompt. Can cause repetition loops; disable for long/noisy audio.
- `no_speech_threshold=0.6` + `logprob_threshold=-1.0` for silence detection.
- `word_timestamps=True` uses cross-attention DTW for per-word alignment (adds ~20% latency).
- `initial_prompt` â critical for domain vocab. Inject "ColÃ©gio KlÃ©sis, FIC, CassilÃ¢ndia, Intentus, Nexvy, Marcelo" as priming for your use case.

### Deployment options for V9
- **OpenAI API (`whisper-1` endpoint)**: batch-only, 25MB file limit, cents per minute. Easiest for Jarvis Stage 2/3 first pass. This is what whatsapp-claude-gpt already uses.
- **Self-hosted on Railway/Fly/RunPod with GPU**: `turbo` on A10/A100 handles real-time. Can't do true streaming out of box â use `whisper.cpp` or `faster-whisper` (CTranslate2-based, 4x faster, int8).
- **Streaming**: this repo doesn't support it. For true streaming you need:
  - `whisper-streaming` (Ufal) â VAD-based incremental
  - `faster-whisper` + custom VAD + 1â2s chunking
  - OR switch to Deepgram/AssemblyAI/Groq (Groq hosts Whisper at 200x real-time)

### Applicable to ecosystem â Jarvis Stage 3 (Voice)
- **For Stage 2 (WhatsApp voice notes)**: OpenAI `whisper-1` API is fine â voice notes are short, batch transcription latency (1â3s) is acceptable. Already proven in whatsapp-claude-gpt.
- **For Stage 3 (Voice conversation)**: you need <500ms TTFB. Plain Whisper won't deliver. Options in descending latency:
  - **Groq Whisper** (fastest cloud, ~200x real-time, penny-level cost) â **recommended for Stage 3**
  - **faster-whisper** self-hosted on Railway GPU instance with VAD chunking
  - **OpenAI Realtime API** â bundles STT+LLM+TTS, <300ms, but price premium
- For Portuguese quality, use `large-v3` or `turbo`, not `base`/`small`.
- **Pattern to steal**: `initial_prompt` for domain priming. Build per-business prompt dictionaries (EDU, real estate, etc.).
- **Reality check on "Always-on Stage 4"**: sustained listening is NOT what Whisper provides. You need a wake-word engine (Picovoice Porcupine, OpenWakeWord) + VAD + Whisper. This repo is one piece of a bigger puzzle.

### Key files
- `whisper/__init__.py` lines 17â31 (model registry URLs)
- `whisper/transcribe.py` lines 38â120 (transcribe signature; see temperature fallback, thresholds, initial_prompt)
- `whisper/model.py` (Whisper class; not read in depth)
- `model-card.md` (official limitations)

### Reality check
- Production-grade for batch. Not for streaming without wrappers.
- Hallucinations on silence are real (documented `hallucination_silence_threshold` parameter). Always add VAD upstream.

---

## 5. aider â AI pair-programmer (compare to Claude Code)

**Location:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/aider/`

### What it actually does
Terminal-based AI coding assistant. Maps your repo, sends a context slice to an LLM, parses structured edits back, applies them, commits to git. Advertises 88% "singularity" (last release written by itself). 5.7M installs.

### Architecture
- **RepoMap** (`aider/repomap.py`, 867 LOC): the signature feature. Uses **tree-sitter** (`grep_ast`) to extract *definitions + references* per file, scores their PageRank-like importance based on which identifiers appear in the current chat, and compresses to a token budget (`max_map_tokens=1024` default). Caches tags in SQLite (`.aider.tags.cache.v4`). Unlike Claude Code which reads full files, aider presents a compressed symbol graph.
- **Coder abstraction** (`aider/coders/`): a coder is one edit-format strategy. Major variants:
  - `editblock_coder.py` â SEARCH/REPLACE blocks (default, robust against drift)
  - `editblock_fenced_coder.py` â same but fenced
  - `editblock_func_coder.py` â tool-calling variant
  - `patch_coder.py` â unified diff format
  - `single_wholefile_func_coder.py` â whole-file rewrite
  - `architect_coder.py` â plan mode (2 LLMs: architect + editor)
  - `ask_coder.py`, `help_coder.py`, `context_coder.py` â non-editing conversational modes
- **Edit parsing** (`editblock_coder.py`): `find_original_update_blocks()` extracts `<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE` blocks. `do_replace()` uses `SequenceMatcher` for fuzzy matching when exact match fails â critical for reliability when LLM slightly misquotes the original.
- **Git integration** (`aider/repo.py`, 622 LOC): `GitRepo` class wraps GitPython, auto-commits each LLM edit with a generated commit message, supports `--attribute-author`, `--attribute-committer`, `--attribute-co-authored-by`, respects `.aiderignore`. Undo == `git revert`. Supports `--subtree-only` for monorepos.
- **IO layer** (`aider/io.py`): interactive terminal with prompt_toolkit.
- **Watch mode** (`aider/watch.py`): monitor files for AI comments (`# aider: do X`) and act.
- **Voice** (`aider/voice.py`): push-to-talk Whisper for voice-to-code.

### vs Claude Code
| Dimension | aider | Claude Code |
|---|---|---|
| Context strategy | Compressed RepoMap (tree-sitter symbols + PageRank) | Full-file Reads + Grep/Glob tool use |
| Edit format | SEARCH/REPLACE blocks, fuzzy match | Edit tool (exact old_stringânew_string, replace_all) |
| Git | Auto-commit per edit, auto commit messages | Opt-in; user requests commit |
| Model | Any (OpenRouter, local) | Anthropic Claude only |
| Architecture mode | `/architect` 2-LLM split | Opus/Sonnet/Haiku single thread with skills/subagents |
| Voice | Yes (Whisper) | No |
| Chat UI | Terminal prompt_toolkit | Terminal + IDE integrations |
| Extensibility | Coder subclasses, edit-format plugins | MCP tools, skills, hooks, subagents |

**Aider's RepoMap is its key insight.** It addresses the "codebase is larger than context window" problem more elegantly than Claude Code's grep-and-read approach for large repos. For a monorepo with 5 businesses, a PageRank-scored symbol map lets the LLM know *that* `IntentusLeadService.qualify()` exists without reading the whole file. Claude Code relies on grepping on demand â works well interactively, worse for autonomous agents.

### Applicable to ecosystem
- **Not a direct fit for Jarvis stages** (those are about WhatsApp/voice/always-on, not coding). But:
- **Stage 1 CLI**: You're already on Claude Code. Aider is the main competitor; steal concepts, don't switch.
- **Patterns to steal for any V9 coding agent:**
  1. **RepoMap-style compressed symbol context** â useful for your monorepo. Consider exposing a `get_repo_map` MCP tool that returns tree-sitter symbols + PageRank scores.
  2. **SEARCH/REPLACE block format** â more tolerant to LLM drift than exact-match replace. If you build custom agents that edit code outside Claude Code, use this format.
  3. **Auto-commit per LLM turn** â reversibility via git is a superpower. Managed Agents should commit each autonomous change with a structured message.
  4. **`--subtree-only`** â essential for your monorepo; restricts blast radius to one business's package.
  5. **Architect/Editor 2-model split** â expensive model plans, cheap model edits. Matches V9's cost-per-task goals.
  6. **`.aiderignore`** â sane default for "don't include my .env, secrets, node_modules".

### Key files
- `aider/repomap.py` (867 LOC) â the crown jewel, tree-sitter + PageRank context compression
- `aider/coders/base_coder.py` (2485 LOC) â Coder ABC
- `aider/coders/editblock_coder.py` â SEARCH/REPLACE parsing with fuzzy fallback
- `aider/coders/architect_coder.py` â 2-model pattern
- `aider/repo.py` â git integration patterns
- `aider/watch.py` + `aider/watch_prompts.py` â comment-trigger mode

### Reality check
- **Production-grade and battle-tested.** 5.7M installs, 15B tokens/week, used against every major LLM.
- RepoMap has real limitations: tree-sitter grammar per language, so coverage gaps (YAML, config files); PageRank skews toward popular symbols. But it's real, it works, and it's been refined for 2+ years.
- Voice-to-code works but is a novelty feature; most users use the terminal.
- For V9: **don't rebuild aider**, but adopt its RepoMap idea as an MCP tool feeding Claude Code / Managed Agents for monorepo navigation.

---

# Cross-Cutting Recommendations for V9

1. **Stage 2 (WhatsApp)**: Discard `whatsapp-web.js` transport. Build on **Meta Cloud API + webhook on Railway**. Keep the ORCHESTRATION shape from `roboto.ts` (per-chat mutex, tool-use cycle loop, memory/reminder tools). Reuse the memory schema verbatim in Supabase.

2. **Stage 3 (Voice)**: Use **Groq Whisper** for STT (cheapest <500ms path). Add VAD (`webrtcvad` or Silero) upstream to avoid hallucinations. For TTS, ElevenLabs `eleven_multilingual_v2` is the quality leader for PT-BR; OpenAI `tts-1` is cheaper.

3. **n8n-mcp**: Deploy as-is on Railway (Dockerfile.railway provided). Connect to Managed Agents via HTTP+Bearer. This is ready-to-ship.

4. **RAG**: Don't use LangChain. Use **Supabase pgvector + Cohere rerank v3** directly. Steal the `chunk=1600/overlap=200` + `LongContextReorder` ideas. Build evaluation harness (RAGAS or custom) from day one.

5. **Monorepo navigation (aider idea)**: Build an MCP tool `get_repo_map(package)` exposing tree-sitter symbol maps per business package. Gives Claude Code and Managed Agents context without grepping.

6. **Shared pattern across all 5**: every repo has some form of **tool-calling cycle loop with cycle limit**. Anthropic's native tool use in Claude handles this, but you'll want a consistent `maxCycles=5` cap and telemetry on cycle count across all your agents.

