# @ecossistema/jarvis-app

App Expo (iOS + Android + Web) do **Jarvis Estágio 3** — push-to-talk com os agentes do ecossistema.

## Status

**PR 1 — scaffold.** Interface com botão "Falar com Claudinho" sem backend. Serve para validar que o pipeline Expo + pnpm workspace funciona no monorepo.

Próximos PRs:
- **PR 2** — chat texto via SSE contra `apps/orchestrator`
- **PR 3** — push-to-talk real (pipecat + Groq Whisper + ElevenLabs)
- **PR 4** — auth + EAS build no celular do Marcelo

## Como rodar

Do **root do monorepo**:

```bash
pnpm install
pnpm --filter @ecossistema/jarvis-app start
```

Depois:
- Aperta `w` no terminal → abre no navegador
- Aperta `i` → abre no simulador iOS (precisa Xcode instalado)
- Escaneia o QR Code com o app **Expo Go** (iPhone/Android) → abre no celular real

## Stack

- **Expo SDK 52** · React Native 0.76 · TypeScript strict
- **Metro** configurado para pnpm monorepo (watcha root + resolve de 2 `node_modules`)
- `.npmrc` com `node-linker=hoisted` — exigência do Expo em workspaces pnpm

## Referência arquitetural

- [ADR-011](../../docs/adr/011-jarvis-4-stages-pipecat-livekit.md) — os 4 estágios do Jarvis
- [PLANO-EXECUCAO-V4.md](../../docs/masterplans/PLANO-EXECUCAO-V4.md) §D3 — evolução CLI → WA → Voz → Jarvis
