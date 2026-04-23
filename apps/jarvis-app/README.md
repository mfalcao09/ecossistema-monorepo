# @ecossistema/jarvis-app

App Expo (iOS + Android + Web) do **Jarvis Estágio 3** — chat (PR 2) e push-to-talk (PR 3) com os agentes do ecossistema.

## Status

**PR 3/4 — push-to-talk (STT + TTS).**

- 🎙 Segura o mic → grava → solta → Groq Whisper transcreve → injeta no chat
- 🔊 Quando o stream do assistant termina, ElevenLabs sintetiza e toca automaticamente
- Graceful degradation: se `GROQ_API_KEY` / `ELEVENLABS_API_KEY` não estiverem setadas, mic desabilita + resposta não toca (texto continua funcionando)

**PRs anteriores:**

- [PR 1/4 — scaffold Expo](https://github.com/mfalcao09/ecossistema-monorepo/pull/56) ✅ merged
- [PR 2/4 — chat texto SSE](https://github.com/mfalcao09/ecossistema-monorepo/pull/67) ✅ merged

**Próximos:**

- **PR 4/4** — auth magic-link + EAS build no celular do Marcelo

## Como rodar

### 1. Subir o orchestrator localmente

Em outro terminal:

```bash
cd apps/orchestrator
uv venv --python 3.12 && source .venv/bin/activate && uv pip install -e .

# Obrigatórios
export ANTHROPIC_API_KEY=sk-ant-...
export OWNER_TOKEN_HASH=$(echo -n "owner_dev_local_seguro_1234" | shasum -a 256 | awk '{print $1}')

# Voz (opcionais — sem eles, PR 3 degrada graciosamente pra chat-só)
export GROQ_API_KEY=gsk_...          # https://console.groq.com
export ELEVENLABS_API_KEY=sk_...     # https://elevenlabs.io

uvicorn orchestrator.main:app --host 0.0.0.0 --port 8000 --reload
```

A flag `--host 0.0.0.0` é crítica — sem ela o celular não consegue acessar via IP LAN.

Check rápido: `curl http://localhost:8000/voice/health` deve retornar `{"stt_available": true, "tts_available": true, ...}`.

### 2. Configurar o jarvis-app

```bash
cp apps/jarvis-app/.env.example apps/jarvis-app/.env.local
```

Edite `.env.local`:

```env
# Descubra o IP do Mac: ipconfig getifaddr en0 (Wi-Fi) ou en1 (ethernet)
EXPO_PUBLIC_ORCHESTRATOR_URL=http://192.168.0.X:8000
EXPO_PUBLIC_ORCHESTRATOR_TOKEN=owner_dev_local_seguro_1234
EXPO_PUBLIC_AGENT_ID=claudinho
```

### 3. Rodar o app

Do **root do monorepo**:

```bash
pnpm --filter @ecossistema/jarvis-app start
```

Opções:

- `w` → abre no navegador (usa `localhost` funciona)
- `i` → abre no simulador iOS (precisa Xcode instalado)
- Escaneia o QR Code com **Expo Go** no iPhone → usa o IP LAN

## Arquitetura

```
iPhone (Expo Go)
      │
      ▼ HTTPS (wifi LAN)
App.tsx
   useChat (state + SSE streaming)
   useVoice (expo-audio: record + playback)
      │           │                │
      │           ▼ POST /voice/transcribe (multipart m4a)
      │        Groq Whisper → { text }
      │           │
      │           ▼ text vira input pro useChat
      ▼
src/services/orchestrator.ts (react-native-sse, POST body)
      │
      ▼ Authorization: Bearer owner_...
apps/orchestrator (FastAPI)
   POST /agents/claudinho/run → EventSourceResponse
   POST /voice/transcribe     → Groq Whisper large-v3 turbo
   POST /voice/synthesize     → ElevenLabs multilingual v2
      │
      ▼ text do assistant final
ElevenLabs → data:audio/mpeg;base64 → expo-audio toca
```

## Eventos SSE recebidos

O `useChat` processa:

| Evento              | Ação                                                   |
| ------------------- | ------------------------------------------------------ |
| `init`              | grava `session_id`                                     |
| `assistant_message` | concatena `data.text` na mensagem assistant streamando |
| `end`               | marca mensagem como `streaming: false`                 |
| `error`             | mostra banner vermelho                                 |

Eventos `thinking`, `tool_use`, `tool_result` são ignorados por enquanto — PR 3+ vai tratar.

## Por que `react-native-sse` (e não `EventSource` nativo)

React Native **não** tem `EventSource` nativo. O `fetch` com `ReadableStream` existe no RN 0.72+ mas é instável no iOS. `react-native-sse` é Apache-2.0, testado e — crítico — aceita `method: POST` com `body`, que o `EventSource` do browser não aceita.

## Referência arquitetural

- [ADR-011](../../docs/adr/011-jarvis-4-stages-pipecat-livekit.md) — os 4 estágios do Jarvis (revisado Electron/Swift → Expo)
- [PLANO-EXECUCAO-V4.md §D3](../../docs/masterplans/PLANO-EXECUCAO-V4.md) — evolução CLI → WA → Voz → Jarvis
- [apps/orchestrator/src/orchestrator/routes/agents.py](../orchestrator/src/orchestrator/routes/agents.py) — contract dos endpoints SSE
