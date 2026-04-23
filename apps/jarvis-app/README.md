# @ecossistema/jarvis-app

App Expo (iOS + Android + Web) do **Jarvis Estágio 3** — chat, push-to-talk e auth magic-link contra os agentes do ecossistema.

## Status

**PR 4/4 — auth magic-link Supabase + EAS build standalone.** 🏁 Fecha F1-S03.

- 🔐 Login via magic-link (Supabase Auth ECOSYSTEM) — sem token hardcoded
- 📲 Deep link `jarvis://auth/callback` volta pro app automaticamente
- 🔑 Sessão persistida no iOS Keychain / Android Keystore via `expo-secure-store`
- 👤 Backend filtra e-mails permitidos via `ALLOWED_EMAILS` (só o Marcelo entra)
- 📦 `eas.json` pronto para gerar build standalone (sem Expo Go)

**PRs anteriores:**

- [PR 1/4 — scaffold Expo](https://github.com/mfalcao09/ecossistema-monorepo/pull/56) ✅ merged
- [PR 2/4 — chat texto SSE](https://github.com/mfalcao09/ecossistema-monorepo/pull/67)
- [PR 3/4 — push-to-talk](https://github.com/mfalcao09/ecossistema-monorepo/pull/69)

## Como rodar

### 1. Subir o orchestrator localmente

Em outro terminal:

```bash
cd apps/orchestrator
uv venv --python 3.12 && source .venv/bin/activate && uv pip install -e .

# Obrigatórios
export ANTHROPIC_API_KEY=sk-ant-...
export OWNER_TOKEN_HASH=$(echo -n "owner_dev_local_seguro_1234" | shasum -a 256 | awk '{print $1}')

# Auth magic-link (PR 4 — obrigatório pra login do app; opcional pra dev local)
export SUPABASE_JWT_SECRET=...       # Supabase Dashboard → Settings → API → JWT
export ALLOWED_EMAILS=mrcelooo@gmail.com

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
EXPO_PUBLIC_AGENT_ID=claudinho

# Supabase ECOSYSTEM (obrigatório a partir do PR 4)
EXPO_PUBLIC_SUPABASE_URL=https://gqckbunsfjgerbuiyzvn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 2.1. Configurar Supabase Auth

No dashboard Supabase do projeto ECOSYSTEM:

1. **Authentication → URL Configuration → Redirect URLs** → adicionar:
   - `jarvis://auth/callback` (produção standalone)
   - `exp://<IP_LAN>:8081/--/auth/callback` (dev via Expo Go — opcional)
2. **Authentication → Email Templates → Magic Link** → confirmar que o link usa `{{ .RedirectTo }}`.

### 3. Rodar o app

Do **root do monorepo**:

```bash
pnpm --filter @ecossistema/jarvis-app start
```

Opções:

- `w` → abre no navegador (usa `localhost` funciona)
- `i` → abre no simulador iOS (precisa Xcode instalado)
- Escaneia o QR Code com **Expo Go** no iPhone → usa o IP LAN

## Build standalone via EAS (PR 4)

Quando o fluxo estiver sólido, Marcelo instala o Jarvis como app nativo no iPhone (sem Expo Go):

```bash
# Uma vez:
npm install -g eas-cli
eas login
eas init                       # preenche extra.eas.projectId no app.json
eas credentials                # configura Apple Developer keys

# Build dev com hot-reload:
eas build --profile development --platform ios

# Build de preview (distribuição interna TestFlight):
eas build --profile preview --platform ios
```

O link gerado pelo EAS instala direto no iPhone (precisa adicionar o device no Apple Developer Program antes). A partir daí, deep link `jarvis://auth/callback` funciona e o app vira ícone no springboard.

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
