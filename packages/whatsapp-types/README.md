# @ecossistema/whatsapp-types

Tipos TypeScript compartilhados da camada WhatsApp — schema do banco, eventos Realtime/webhook, contratos HTTP do gateway.

Referência: [ADR-017 — WhatsApp pairing via Baileys direto (Nível 2)](../../docs/adr/017-whatsapp-pairing-baileys-direto.md).

## Por quê existe

Três consumidores precisam concordar em tipos:

1. **`apps/whatsapp-gateway`** — serviço Node que fala com Baileys, grava no Supabase, emite webhook
2. **`apps/jarvis-app`** — consumidor que escuta mensagens e ações de voz
3. **`apps/fic-comercial-inbox`** (futuro) — inbox web

Sem esse pacote, cada um redefiniria `WhatsAppMessage` divergindo. Aqui fica a fonte única.

## O que exporta

| Módulo | Conteúdo |
|---|---|
| `instance` | `WhatsAppInstance`, `InstanceStatus`, `TERMINAL_STATUSES` |
| `auth-state` | `WhatsAppAuthStateRow` (secret — RLS service_role) |
| `contact` | `WhatsAppContact` |
| `chat` | `WhatsAppChat` |
| `message` | `WhatsAppMessage`, `MessageKind`, `MessageStatus`, `isSystemMessageType` |
| `jid` | `classifyJid`, `isLidJid`, `isGroupJid`, `jidToPhoneNumber` |
| `events` | `WhatsAppWebhookEvent` (union de 4 variantes) + `isWhatsAppWebhookEvent` |
| `gateway-api` | Request/response de cada rota HTTP (`CreateInstanceRequest`, `SendMessageRequest`, etc.) |

## Zero runtime pesado

Só tipos + helpers puros (`classifyJid`, `isSystemMessageType`, `isWhatsAppWebhookEvent`). Sem IO, sem deps de banco. Cabe em qualquer lado (Node, Deno, browser, React Native via Expo).

## Versionamento

- `0.x` — interface ainda mutável conforme Fase C3 valida em campo
- Bump pra `1.0.0` quando gateway e primeiro consumidor (Jarvis) subirem em prod

Eventos de webhook têm `WEBHOOK_SCHEMA_VERSION = 1` — consumidores devem validar e abortar se versão diferente. Mudança de contrato = bump dessa constante.

## Build

```bash
pnpm --filter @ecossistema/whatsapp-types build
```

Output em `dist/` (ESM + `.d.ts` + source maps).

## Convenções

- ESM + `NodeNext`-friendly — imports terminam em `.js` (não `.ts`), conforme padrão do monorepo
- `strict: true` sempre ligado
- Tipos de tabela são apenas as colunas **lidas** do DB. Defaults gerados pelo DB (`id`, `created_at`, `updated_at`) são tipos **obrigatórios** nas interfaces mas **opcionais** nos `Insert` variants
