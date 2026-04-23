# ADR-011: Jarvis 4-stage — pipecat + LiveKit Agents

- **Status:** aceito · **revisado 2026-04-20** (E3 shell Electron/Swift → Expo)
- **Data:** 2026-04-16 (original) · **2026-04-20** (revisão E3)
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte X, PLANO-EXECUCAO-V4 D3, `docs/analises/ANALISE-MULTIAGENT-VOICE-OBS.md`

## Contexto e problema

D3 (V4) estabelece evolução do Jarvis em 4 estágios:

| Estágio | Funcionalidade |
|---|---|
| E1 — CLI | Agora. Claude Code |
| E2 — WhatsApp | ~sem 4. Text-first bot |
| E3 — Voz App | ~sem 8. macOS/iOS push-to-talk |
| E4 — Always-on | ~sem 16+. Wake-word + voz proativa |

Cada estágio tem requisitos técnicos distintos — precisamos de stack de voz que atenda E2 (WhatsApp audio notes) **e** E3/E4 (WebRTC real-time). Uma única ferramenta cobrindo tudo não existe hoje.

## Opções consideradas

- **Opção 1:** Só LiveKit Agents (WebRTC + telephony via SIP)
- **Opção 2:** Só pipecat (WhatsApp-friendly, batch audio)
- **Opção 3:** OpenAI Realtime API end-to-end
- **Opção 4:** **pipecat para WhatsApp + LiveKit Agents para WebRTC** (drive-thru pattern)

## Critérios de decisão

- Suporte WhatsApp audio notes (Evolution API integra)
- Latência real-time para voz contínua (< 500ms round-trip)
- Licença open source (preferência Apache/MIT)
- Flexibilidade de STT/TTS providers (Groq Whisper, ElevenLabs, Piper local)
- Suporte PT-BR de qualidade

## Decisão

**Escolhemos Opção 4** — pipecat (E2 WhatsApp/telefonia) + LiveKit Agents (E3/E4 WebRTC).

**Stack canônica por estágio (§34 V9):**

| Estágio | Stack |
|---|---|
| **E1** | Claude Code + Managed Agents + skills + hooks constitucionais |
| **E2** | **Evolution API (Cloud API) + pipecat + Supabase + C-Suite routing** |
| **E3** | **pipecat + Groq Whisper + ElevenLabs + openWakeWord + Silero VAD + app Expo (iOS + Android + macOS/Web)** |
| **E4** | **livekit/agents + Omi-like + wake-word + sensors + proactive triggers** |

## Consequências

### Positivas
- pipecat integra nativamente com Evolution API (WhatsApp áudios)
- LiveKit Agents entrega WebRTC sub-500ms em pt-BR (testado via Groq Whisper)
- STT/TTS trocáveis: Groq Whisper (cloud) ↔ faster-whisper (local); ElevenLabs (qualidade) ↔ Piper (local privado)
- Wake-word openWakeWord + Silero VAD são production-grade e open source
- Ambos (pipecat + LiveKit) são Apache-2.0 — forks, modificações e comercialização permitidas

### Negativas
- Duas stacks para aprender/operar
- LiveKit requer infra de turn/stun servers (mitigado por LiveKit Cloud como fallback)
- ElevenLabs é comercial (custo por caractere)

### Neutras / riscos
- **Risco:** LiveKit Cloud outage. **Mitigação:** self-host como fallback.
- **Risco:** Groq Whisper descontinuar pt-BR premium. **Mitigação:** faster-whisper self-host já testado.

## Evidência / pesquisa

- `pipecat-ai/pipecat` — Apache-2.0, suporta WhatsApp audio via Evolution
- `livekit/agents` — Apache-2.0, padrão drive-thru voice agent
- `docs/analises/ANALISE-MULTIAGENT-VOICE-OBS.md` § voice comparison
- `SYSTRAN/faster-whisper` — MIT, STT local
- `rhasspy/piper` — MIT, TTS local
- `dscripka/openWakeWord` — Apache-2.0
- `snakers4/silero-vad` — MIT

## Ação de implementação

- E1 é o atual — estabilizar Claude Code + hooks (Fase 0 inteira)
- E2 no Sprint 1-2 pós-Fase 0: WhatsApp Evolution + pipecat + routing C-Suite (sessão futura)
- E3 no Sprint 5-6: app Expo (React Native) + push-to-talk — scaffold em `apps/jarvis-app/` (PR 1 em 2026-04-20)
- E4 na Fase 3 (semanas 13-24): always-on + proactive triggers

## Revisão

Revisar ao fim do E2 (quando WhatsApp entrar em produção). Reavaliar LiveKit vs concorrentes emergentes (OpenAI Realtime evolution, etc).

### Revisão 2026-04-20 — shell do E3: Electron/Swift → Expo

**O que mudou:** a camada de voz (pipecat + Groq Whisper + ElevenLabs + openWakeWord + Silero VAD) permanece; **só o shell do app** passa de Electron ou Swift para **Expo (React Native)**.

**Motivo:** Marcelo quer usar o Jarvis **fora do escritório** (celular) além de no Mac. Expo entrega iOS + Android + web/macOS com um único código, o que Electron (só desktop) e Swift (só Apple) não entregam.

**Como isso afeta a stack:**

- Client lib: `@pipecat-ai/client-js` / `@pipecat-ai/client-react-native` (ambos Apache-2.0, publicados pelo mesmo time do pipecat)
- Áudio: `expo-av` para gravação/playback; `react-native-webrtc` quando precisar de streaming contínuo (E4)
- Wake-word: openWakeWord continua rodando no backend (pipecat recebe o stream do client e faz VAD + wake-word server-side)
- Auth: Expo permite deep-link de magic-link do Supabase sem fricção

**Trade-off aceito:** latência em React Native é ~50-100ms maior que Swift nativo. Para E3 (push-to-talk) isso é irrelevante porque o usuário já está segurando o botão. Se E4 (always-on com wake-word no device) mostrar que RN é insuficiente, a gente pode portar só a camada de captura para módulo nativo sem trocar o shell.

**Precedente:** apps de voz como Granola, Fireflies e outros usam Expo/RN + pipecat ou similar com sucesso.
