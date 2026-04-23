# @ecossistema/jarvis-app

App Expo (iOS + Android + Web) do **Jarvis Estágio 3** — chat (PR 2) e push-to-talk (PR 3) com os agentes do ecossistema.

## Status

**PR 2/4 — chat texto via SSE.** Conectado ao `apps/orchestrator` (FastAPI). Mensagens vão via `POST /agents/{agentId}/run` com stream SSE. Sessão persistida via `session_id` para follow-ups usarem `/resume`.

**PRs anteriores:**
- [PR 1/4 — scaffold Expo](https://github.com/mfalcao09/ecossistema-monorepo/pull/56) ✅ merged

**Próximos:**
- **PR 3/4** — push-to-talk real (pipecat + Groq Whisper + ElevenLabs)
- **PR 4/4** — auth magic-link + EAS build no celular do Marcelo

## Como rodar

### 1. Subir o orchestrator localmente

Em outro terminal:

```bash
cd apps/orchestrator
# primeira vez: pip install -e . (ou uv sync)
uvicorn orchestrator.main:app --host 0.0.0.0 --port 8000 --reload
```

A flag `--host 0.0.0.0` é crítica — sem ela o celular não consegue acessar via IP LAN.

Crie o `OWNER_TOKEN_HASH` no ambiente do orchestrator:

```bash
# No terminal do orchestrator:
export OWNER_TOKEN_HASH=$(echo -n "owner_dev_local_seguro_1234" | shasum -a 256 | awk '{print $1}')
```

Agora o token `owner_dev_local_seguro_1234` é válido no Bearer header.

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
   useChat (state + streaming)
      │
      ▼
src/services/orchestrator.ts
   react-native-sse (SSE client com POST body)
      │
      ▼ Authorization: Bearer owner_...
apps/orchestrator (FastAPI)
   POST /agents/claudinho/run → EventSourceResponse
      │
      ▼
Managed Agents (Anthropic)
```

## Eventos SSE recebidos

O `useChat` processa:

| Evento | Ação |
|---|---|
| `init` | grava `session_id` |
| `assistant_message` | concatena `data.text` na mensagem assistant streamando |
| `end` | marca mensagem como `streaming: false` |
| `error` | mostra banner vermelho |

Eventos `thinking`, `tool_use`, `tool_result` são ignorados por enquanto — PR 3+ vai tratar.

## Por que `react-native-sse` (e não `EventSource` nativo)

React Native **não** tem `EventSource` nativo. O `fetch` com `ReadableStream` existe no RN 0.72+ mas é instável no iOS. `react-native-sse` é Apache-2.0, testado e — crítico — aceita `method: POST` com `body`, que o `EventSource` do browser não aceita.

## Referência arquitetural

- [ADR-011](../../docs/adr/011-jarvis-4-stages-pipecat-livekit.md) — os 4 estágios do Jarvis (revisado Electron/Swift → Expo)
- [PLANO-EXECUCAO-V4.md §D3](../../docs/masterplans/PLANO-EXECUCAO-V4.md) — evolução CLI → WA → Voz → Jarvis
- [apps/orchestrator/src/orchestrator/routes/agents.py](../orchestrator/src/orchestrator/routes/agents.py) — contract dos endpoints SSE
