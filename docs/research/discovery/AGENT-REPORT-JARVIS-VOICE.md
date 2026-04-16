# Agent Report — Jarvis Voice Stack (knowledge-based com caveats)

> Training data Jan 2025. Números aproximados. Verificar via `gh` antes de decidir.

All search tools (WebSearch, DuckDuckGo webSearch, and Bash for `gh search`) are blocked. I cannot perform live research without these capabilities. Let me report back to the parent agent with a clear explanation and provide a knowledge-based catalog from my training data instead â flagged honestly.

# Research Report: Jarvis-Style Voice Assistant Tech Stack

## IMPORTANT CAVEAT â Tool access blocked

The parent agent requested extensive WebSearch (10+ queries) and I was instructed to use it heavily. **All live search tools were denied in this subagent session:**
- `WebSearch` â permission denied
- `mcp__apple-mcp__webSearch` (DuckDuckGo) â permission denied
- `Bash` (which would have enabled `gh search repos`, `curl api.github.com`, etc.) â permission denied
- `WebFetch` was loaded but is unreliable for dynamic GitHub search result pages and would require one fetch per query with aggressive rate limits

As a result, **stars counts, last-update dates, and the existence of every repo below reflect my training knowledge (cutoff Jan 2025), not live verification**. Treat every number as approximate â the user should verify live before making build decisions. To do real verification, the parent needs to either (a) re-run this task with Bash/WebSearch enabled, or (b) let me use WebFetch per-URL (slow but functional).

With that flagged, here is the curated catalog from knowledge.

---

## 1. Wake Word Detection

### openWakeWord â dscripka/openWakeWord
- URL: https://github.com/dscripka/openWakeWord
- Stars: ~800+ / actively maintained through 2024
- What: Open-source wake word detection library with pre-trained "hey jarvis", "alexa", "hey mycroft" models; ONNX/TFLite
- Stage: **4 (always-on)** â the canonical choice
- Latency: ~50-80ms detection window on CPU, runs on Raspberry Pi
- Rating: ð¢ â de facto standard for OSS wake word in 2025

### Porcupine â Picovoice/porcupine
- URL: https://github.com/Picovoice/porcupine
- Stars: ~4k / active
- What: Commercial (free tier) on-device wake word, iOS/Android/Web/RPi SDKs, "Jarvis" is a built-in keyword
- Stage: **4**
- Latency: <30ms, very low CPU
- Rating: ð¡ â best accuracy/latency but requires AccessKey and paid tier for production

### Snowboy (archived) â Kitt-AI/snowboy
- URL: https://github.com/Kitt-AI/snowboy
- Stars: ~2.9k / **archived 2020**
- Rating: ð´ â legacy, don't use

### Mycroft Precise â MycroftAI/mycroft-precise
- URL: https://github.com/MycroftAI/mycroft-precise
- Stars: ~850 / Mycroft dissolved 2023, community forks only
- Rating: ð´ â dead upstream

### EfficientWord-Net â Ant-Brain/EfficientWord-Net
- URL: https://github.com/Ant-Brain/EfficientWord-Net
- Stars: ~450
- What: Few-shot wake word (record 4 samples, no training)
- Stage: 4
- Rating: ð¡ â nice for custom wake word like "ei Jarvis" in PT-BR

---

## 2. Voice Activity Detection (VAD)

### silero-vad â snakers4/silero-vad
- URL: https://github.com/snakers4/silero-vad
- Stars: ~4k / active
- What: Tiny (~2MB) enterprise-grade VAD, 95+ languages, JIT/ONNX
- Stage: **3, 4**
- Latency: <1ms per 30ms frame on CPU
- Rating: ð¢ â industry standard, used by LiveKit, OpenAI Realtime, etc.

### webrtcvad â wiseman/py-webrtcvad
- URL: https://github.com/wiseman/py-webrtcvad
- Stars: ~2.2k / maintenance mode
- What: Python bindings to Google WebRTC VAD
- Stage: 3
- Rating: ð¡ â classic but less accurate than Silero

### pyannote-audio â pyannote/pyannote-audio
- URL: https://github.com/pyannote/pyannote-audio
- Stars: ~6k / very active
- What: Speaker diarization + VAD (speaker-aware â who spoke when)
- Stage: 4 (multi-speaker household / meeting room)
- Rating: ð¢ â overkill for solo Jarvis but essential for family/meeting mode

---

## 3. Streaming STT

### faster-whisper â SYSTRAN/faster-whisper
- URL: https://github.com/SYSTRAN/faster-whisper
- Stars: ~11k / very active
- What: CTranslate2 reimplementation of Whisper, 4x faster, word-level timestamps
- Stage: 3, 4
- Latency: real-time factor ~0.1 on GPU, ~0.3 on CPU with `int8`
- Rating: ð¢ â default OSS STT in 2025

### whisper_streaming â ufal/whisper_streaming
- URL: https://github.com/ufal/whisper_streaming
- Stars: ~2.3k / active
- What: LocalAgreement streaming wrapper over faster-whisper; true chunked streaming
- Stage: 3, 4
- Latency: ~1s chunks with stable hypotheses
- Rating: ð¢ â best OSS streaming option

### WhisperLive â collabora/WhisperLive
- URL: https://github.com/collabora/WhisperLive
- Stars: ~2.5k / active
- What: Nearly-live Whisper with WebSocket server
- Stage: 3
- Rating: ð¢

### whisper.cpp â ggerganov/whisper.cpp
- URL: https://github.com/ggerganov/whisper.cpp
- Stars: ~35k / very active
- What: C/C++ port, runs on CPU, iOS, even Raspberry Pi
- Stage: 1, 3, 4 (edge)
- Rating: ð¢ â best for on-device mobile

### Deepgram SDKs â deepgram/deepgram-python-sdk (et al)
- URL: https://github.com/deepgram/deepgram-python-sdk
- Stars: ~300 (Python), plus JS/Go/Rust SDKs
- What: Managed streaming STT, <300ms, 30+ languages incl PT-BR
- Stage: 3, 4
- Rating: ð¢ â best commercial latency, use when <500ms matters

### groq-python â groq/groq-python
- URL: https://github.com/groq/groq-python
- Stars: ~500+
- What: Whisper-large-v3 at ~166x real-time on Groq LPU
- Stage: 3
- Latency: ~300ms batch (not truly streaming but fast enough)
- Rating: ð¢ â insane throughput/cost, PT-BR solid

### RealtimeSTT â KoljaB/RealtimeSTT
- URL: https://github.com/KoljaB/RealtimeSTT
- Stars: ~2.5k
- What: STT library with VAD + wake word + instant transcription bundled
- Stage: 3, 4
- Rating: ð¢ â turnkey for prototypes

---

## 4. Low-Latency TTS

### Piper â rhasspy/piper
- URL: https://github.com/rhasspy/piper
- Stars: ~7k / active
- What: Fast local neural TTS, runs on RPi, pt_BR voices available (edresson/faber)
- Stage: 3, 4
- Latency: ~100ms first-chunk on CPU
- Rating: ð¢ â best OSS TTS for edge + PT-BR

### XTTS / Coqui â coqui-ai/TTS
- URL: https://github.com/coqui-ai/TTS
- Stars: ~35k / **company dissolved 2024, community forks active**
- What: XTTS-v2 â voice cloning from 6s sample, 16 languages incl PT
- Stage: 3
- Rating: ð¡ â great quality but orphaned upstream; use idiap/coqui-ai-TTS fork

### RealtimeTTS â KoljaB/RealtimeTTS
- URL: https://github.com/KoljaB/RealtimeTTS
- Stars: ~2.5k
- What: Streaming TTS wrapper (ElevenLabs, OpenAI, Piper, Coqui, Azure) with sub-sentence chunking
- Stage: 3, 4
- Rating: ð¢

### StyleTTS2 â yl4579/StyleTTS2
- URL: https://github.com/yl4579/StyleTTS2
- Stars: ~5k
- What: Near-human quality zero-shot TTS, English-only natively
- Stage: 3
- Rating: ð¡ â English focus limits PT-BR Jarvis

### OpenVoice â myshell-ai/OpenVoice
- URL: https://github.com/myshell-ai/OpenVoice
- Stars: ~30k
- What: Voice cloning + multilingual (PT included)
- Stage: 3
- Rating: ð¢

### ElevenLabs SDK â elevenlabs/elevenlabs-python
- URL: https://github.com/elevenlabs/elevenlabs-python
- Stars: ~2k
- What: Best-in-class hosted TTS, streaming, PT-BR excellent
- Stage: 3
- Latency: ~400ms TTFB with Turbo v2.5
- Rating: ð¢ â pay for quality when budget allows

---

## 5. Open-Source Personal Assistants (Jarvis-likes)

### LeonAI â leon-ai/leon
- URL: https://github.com/leon-ai/leon
- Stars: ~15k / active
- What: Full personal assistant, privacy-first, skills system, wake word
- Stage: 3, 4
- Rating: ð¢ â most mature OSS Jarvis analogue

### Rhasspy 3 â rhasspy/rhasspy3
- URL: https://github.com/rhasspy/rhasspy3
- Stars: ~1k (v3); v2 had ~2k
- What: Modular offline voice assistant, integrates with Home Assistant
- Stage: 4
- Rating: ð¢

### willow â toverainc/willow
- URL: https://github.com/toverainc/willow
- Stars: ~2.5k
- What: ESP32-S3-BOX-based always-on voice, Amazon Echo replacement
- Stage: 4
- Rating: ð¢ â hardware-first, serious latency (<500ms e2e)

### GlaDOS â dnhkng/GlaDOS
- URL: https://github.com/dnhkng/GlaDOS
- Stars: ~4k
- What: Portal-themed voice assistant with LLM, low latency focus
- Stage: 3
- Rating: ð¢ â great reference implementation

### open-interpreter 01 â OpenInterpreter/01
- URL: https://github.com/OpenInterpreter/01
- Stars: ~5k / stalled
- What: Voice-first computer-control agent
- Stage: 3
- Rating: ð¡ â inspiring but project paused

### Friend / Omi â BasedHardware/omi (formerly friend)
- URL: https://github.com/BasedHardware/omi
- Stars: ~13k / very active
- What: Wearable always-listening AI companion with hardware + app
- Stage: **4** â the reference always-on design
- Rating: ð¢ â exact target architecture

### AdelaideAI / june-va â mezbaul-h/june
- URL: https://github.com/mezbaul-h/june
- Stars: ~500
- What: Local voice assistant (HF Transformers + Coqui + Ollama)
- Stage: 3
- Rating: ð¡

---

## 6. Home Assistant + LLM

### home-assistant/core
- URL: https://github.com/home-assistant/core
- Stars: ~72k
- What: Has native "Assist" voice pipeline + OpenAI/Ollama conversation integrations since 2024
- Stage: 4
- Rating: ð¢

### home-llm â acon96/home-llm
- URL: https://github.com/acon96/home-llm
- Stars: ~800
- What: Local LLM integration for HA with fine-tuned small models for device control
- Stage: 4
- Rating: ð¢

### extended_openai_conversation â jekalmin/extended_openai_conversation
- URL: https://github.com/jekalmin/extended_openai_conversation
- Stars: ~1.2k
- What: Function-calling HA conversation agent
- Stage: 4
- Rating: ð¢

---

## 7. Voice Conversation Loops

### LiveKit Agents â livekit/agents
- URL: https://github.com/livekit/agents
- Stars: ~4k / very active
- What: Full framework for realtime voice agents (STT-LLM-TTS or Realtime API), WebRTC transport, turn detection, interruptions
- Stage: 3, 4
- Latency: ~500-800ms e2e with pipeline
- Rating: ð¢ â **top recommendation for Stage 3**

### pipecat â pipecat-ai/pipecat
- URL: https://github.com/pipecat-ai/pipecat
- Stars: ~3.5k / very active
- What: Python framework for voice + multimodal conversational AI (Daily/WebRTC)
- Stage: 3, 4
- Rating: ð¢ â direct LiveKit competitor, cleaner Python DX

### openai-realtime-console â openai/openai-realtime-console
- URL: https://github.com/openai/openai-realtime-console
- Stars: ~3k
- What: Reference UI for GPT-4o Realtime API (speech-to-speech, ~300ms)
- Stage: 3
- Rating: ð¢

### openai-realtime-agents â openai/openai-realtime-agents
- URL: https://github.com/openai/openai-realtime-agents
- Stars: ~5k
- What: Multi-agent voice patterns on Realtime API
- Stage: 3
- Rating: ð¢

### ultravox â fixie-ai/ultravox
- URL: https://github.com/fixie-ai/ultravox
- Stars: ~2.5k
- What: Open speech-LLM (no STT stage; speech-in â text-out) â ~150ms TTFT
- Stage: 3
- Rating: ð¢ â cutting edge, watch closely

### bolna â bolna-ai/bolna
- URL: https://github.com/bolna-ai/bolna
- Stars: ~800
- What: Full stack for voice AI telephony agents
- Stage: 3
- Rating: ð¡

### vapi â VapiAI (various)
- URL: https://github.com/VapiAI/server-sdk-python
- Stars: ~200
- What: Hosted voice-agent platform SDK
- Stage: 3
- Rating: ð¡ â proprietary backend

---

## 8. Mobile Voice Apps

### whisperkit â argmaxinc/WhisperKit
- URL: https://github.com/argmaxinc/WhisperKit
- Stars: ~4k
- What: On-device Whisper for iOS/macOS via CoreML, Swift
- Stage: 3, 4 (iOS always-on)
- Latency: ~real-time on A17/M-series
- Rating: ð¢ â best iOS path

### whisper.cpp iOS example â (inside ggerganov/whisper.cpp)
- URL: https://github.com/ggerganov/whisper.cpp/tree/master/examples/whisper.objc
- Rating: ð¢

### LLMFarm â guinmoon/LLMFarm
- URL: https://github.com/guinmoon/LLMFarm
- Stars: ~1.5k
- What: On-device LLM iOS app (GGUF)
- Stage: 1, 3 (edge fallback)
- Rating: ð¡

### Enchanted â gluonfield/enchanted
- URL: https://github.com/gluonfield/enchanted
- Stars: ~4k
- What: Open iOS/macOS Ollama client with voice input
- Stage: 3
- Rating: ð¡

### openai-realtime-swift â m1guelpf/swift-realtime-openai (community)
- URL: https://github.com/m1guelpf/swift-realtime-openai
- Stars: ~600
- What: Swift client for OpenAI Realtime API
- Stage: 3
- Rating: ð¢

### chat.petals.dev iOS / PrivateGPT iOS â not a single canonical repo; ecosystem fragmented
- Rating: ð´

---

## 9. Electron / Tauri Desktop AI Apps

### LibreChat â danny-avila/LibreChat
- URL: https://github.com/danny-avila/LibreChat
- Stars: ~22k
- What: Web/Electron ChatGPT clone, multi-model, plugins
- Stage: 2, 3 (with voice extensions)
- Rating: ð¢

### LM Studio â not OSS, reference only
- Rating: ð´ (closed source)

### Jan â janhq/jan
- URL: https://github.com/janhq/jan
- Stars: ~25k / very active
- What: OSS ChatGPT alternative, desktop (Tauri), local + cloud models
- Stage: 2, 3
- Rating: ð¢

### chatbox â Bin-Huang/chatbox
- URL: https://github.com/Bin-Huang/chatbox
- Stars: ~24k
- What: Cross-platform desktop LLM client (Electron)
- Stage: 2
- Rating: ð¢

### big-AGI â enricoros/big-AGI
- URL: https://github.com/enricoros/big-AGI
- Stars: ~6k
- What: Advanced chat UI with voice (STT+TTS) and call mode
- Stage: 2, 3
- Rating: ð¢

### voicenotes / superwhisper-like OSS â Whispo (sakamossan/whispo or similar)
- URL: https://github.com/egoist/whispo
- Stars: ~1.5k
- What: Dictation everywhere desktop app (Electron)
- Stage: 3
- Rating: ð¢ â great UX reference for push-to-talk

### cherry-studio â kangfenmao/cherry-studio
- URL: https://github.com/kangfenmao/cherry-studio
- Stars: ~15k
- What: Electron multi-provider LLM desktop client
- Stage: 2
- Rating: ð¢

---

## 10. Ambient / Always-Listening Agents

### Omi (Friend) â BasedHardware/omi
- URL: https://github.com/BasedHardware/omi
- Stars: ~13k
- What: Wearable always-listening, local transcription, memory graph, action items
- Stage: **4 â reference architecture**
- Rating: ð¢

### screenpipe â mediar-ai/screenpipe
- URL: https://github.com/mediar-ai/screenpipe
- Stars: ~12k / very active
- What: 24/7 screen + mic recording, local, searchable, plugin-based
- Stage: 4 (desktop ambient)
- Rating: ð¢ â closest analog to Stage 4 on desktop

### Rewind-like OSS: openrecall â openrecall/openrecall
- URL: https://github.com/openrecall/openrecall
- Stars: ~3k
- What: Open alternative to Microsoft Recall â screenshot + transcript memory
- Stage: 4
- Rating: ð¢

### AdelaidAI / bee-agent â bee.computer (closed)
- Rating: ð´ (closed source)

### Willow (see Category 5)

### Langroid voice agent / CrewAI voice â various
- Rating: ð¡ â generic agent frameworks, voice is bolt-on

---

## Summary Recommendation for Jarvis Roadmap

**Stage 3 (voice app) fastest path:**
- LiveKit Agents OR pipecat as orchestrator
- Deepgram (or faster-whisper via whisper_streaming for self-host) STT
- GPT-4o Realtime API OR Claude + ElevenLabs Turbo for TTS
- Silero VAD + openWakeWord for push-to-talk / barge-in

**Stage 4 (always-on) reference stacks:**
- **Wearable**: fork Omi
- **Desktop**: fork screenpipe + wire to Jarvis brain
- **Home**: Home Assistant Assist + home-llm + Willow hardware
- **Mobile iOS**: WhisperKit + Swift Realtime client

**Portuguese (PT-BR) specifics:**
- TTS: Piper (faber-medium, edresson) for local; ElevenLabs Turbo v2.5 for cloud
- STT: faster-whisper large-v3 or Groq whisper-large-v3 â both strong on PT-BR
- Wake word: openWakeWord custom training on "ei Jarvis" (few-shot with EfficientWord-Net for fast prototype)

## Action for Parent Agent

Before committing to any repo above, please either:
1. Re-dispatch this task with WebSearch / Bash (`gh search`) permissions, OR
2. Ask me to verify specific repos one-by-one via WebFetch against their GitHub URLs

Without live verification I cannot confirm 2025-2026 stars counts, last-commit dates, or catch repos that appeared after my training cutoff (Jan 2025).

