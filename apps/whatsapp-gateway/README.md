# @ecossistema/whatsapp-gateway

Gateway WhatsApp do ecossistema — **Baileys direto (Nível 2, ADR-017)**, multi-instância, auth state em Supabase, provider-agnóstico pra swap futuro (Whatsmeow).

## Stack

- Node.js 24 LTS
- [Hono](https://hono.dev) — HTTP framework leve, tipado
- [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) — biblioteca WhatsApp Web unofficial (MIT)
- Supabase (DB + auth state + Realtime)
- `@ecossistema/whatsapp-types` — tipos compartilhados
- pino → Langfuse (logs estruturados)

## Arquitetura

```
┌──────────────┐   events   ┌──────────────┐
│ Web/Jarvis   │◄───────────┤ InstanceMgr  │
│ (Realtime +  │            │ (N sockets)  │
│  HTTP)       │  REST API  │              │
│              │───────────►│  WhatsAppProv│   ← abstração swap-ready
└──────┬───────┘            │   ├ Baileys  │
       │                    │   └ Whatsmeow│   ← futuro
       ▼                    │      (stub)  │
┌──────────────┐            └──────┬───────┘
│  Supabase    │◄──persistence─────┘
│  jarvis-pes. │
└──────────────┘
```

## Executar local

```bash
cd apps/whatsapp-gateway
cp .env.example .env.local
# Edita .env.local e cola SUPABASE_SERVICE_ROLE_KEY (do dashboard)
# Gera um GATEWAY_BEARER_TOKEN:  openssl rand -hex 32

pnpm install
pnpm dev
```

## Defesas de estabilidade (as 10)

Baileys quebra às vezes. Essas defesas garantem que a gente sobreviva:

| # | Onde | O que faz |
|---|---|---|
| 1 | `providers/baileys/index.ts` | Rate limit outbound (queue worker, C3d) |
| 2 | `providers/baileys/index.ts` | Keep-alive / socket ping (C3d) |
| 3 | Operacional | Chip secundário (não número principal) |
| 4 | `package.json` | Baileys version — atualmente `latest` em dev; **pin SemVer antes de prod** |
| 5 | `health/` (C3d) | Heartbeat 60s + canary 1h + socket ping 30s |
| 6 | `logger.ts` | pino → Langfuse; structured logs com `instance_id`/`req_id` |
| 7 | Railway + monitor externo | Alertas: desconexão > 5min, ban, msg/min queda |
| 8 | `providers/baileys/index.ts` | Reconnect com backoff exponencial (1→60s, max 10 tentativas) |
| 9 | `providers/baileys/auth-state.ts` | Snapshot em `whatsapp_auth_state_snapshots` antes de reconnect; `rollback()` se corrompe |
| 10 | `queue/` (C3d) | Outbound queue durável — msgs não perdem se offline |

Plan B (última linha de defesa): `providers/types.ts` é agnóstico, `BaileysProvider` é swappable. Se Baileys virar dor crônica, `WhatsmeowProvider` (Go sidecar via gRPC) é implementável sem tocar no resto.

## Endpoints (C3c)

```
POST   /v1/instances              criar instância
GET    /v1/instances              listar
GET    /v1/instances/:id          ler
GET    /v1/instances/:id/qr       QR atual (polling alternativo ao Realtime)
DELETE /v1/instances/:id          logout + apaga auth_state
POST   /v1/instances/:id/send     enviar mensagem (via queue)
GET    /v1/instances/:id/chats    listar chats
GET    /v1/instances/:id/chats/:chatId/messages  listar mensagens
GET    /healthz                   healthcheck (Railway)
```

Auth: `Authorization: Bearer <GATEWAY_BEARER_TOKEN>`.

## Deploy Railway (C3d)

```bash
railway link   # projeto novo 'whatsapp-gateway'
railway up
# depois popular vars via dashboard OU credential-gateway v2
```

Convenções Railway canônicas (ver MEMORY.md):
- Bind `0.0.0.0`
- Healthcheck TCP (não HTTP — Bearer-protected)
- Pin `pip<26` não aplica (Node), mas pin Baileys em `package.json` quando chegar em prod

## Status atual (2026-04-20)

- ✅ C3a — scaffold
- ✅ C3b — BaileysProvider + Supabase auth state adapter + provider abstraction
- ⏳ C3c — Hono HTTP + middleware Bearer + rotas
- ⏳ C3d — Realtime emitters + outbound queue worker + health checks
- ⏳ C3e — LID resolver (parcial pronto em `BaileysProvider.resolveLid()`) + history-sync filter
- ⏳ C4 — Run local E2E + smoke test
