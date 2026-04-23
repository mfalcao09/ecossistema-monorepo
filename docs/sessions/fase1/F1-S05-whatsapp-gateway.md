# F1-S05 — whatsapp-gateway: Baileys Nível 2

**Sessão:** F1-S05 · **Fase:** 1 · **Branch:** `feature/f1-s05-whatsapp-gateway`
**Duração estimada:** 1 dia (6–8h)
**Dependências:** ADR-017 (Baileys Level 2 validado ✅), Supabase ECOSYSTEM ✅
**Bloqueia:** Jarvis Stage 3 (leitura de WA pessoal do Marcelo)

---

## Leituras obrigatórias

1. `CLAUDE.md` + `MEMORY.md`
2. `docs/adr/017-jarvis-whatsapp-pairing.md` (se existir) ou memória `project_jarvis_whatsapp_pairing.md`
3. `apps/orchestrator/src/orchestrator/services/whatsapp_service.py` — client WABA atual (Jarvis Stage 2)
4. `docs/sessions/fase1/F1-S01-jarvis-routing.md` — o que foi feito em F1-S01 (inbound WABA)

---

## Contexto

F1-S01 conectou Jarvis ao **WABA da FIC** (número institucional) para cobrança e HITL. Agora precisa de uma segunda camada: o WhatsApp **pessoal do Marcelo** (linked device), para que Jarvis possa **ler** o histórico de conversas e **responder como Marcelo** quando autorizado.

Arquitetura ADR-017 (decidida em 2026-04-19, não reverter):

```
iPhone 15 Pro Max (Action Button)
        ↓
jarvis-app (Expo + módulo Swift)
        ↓
Orchestrator Railway (FastAPI)
        ↓
apps/whatsapp-gateway (Node 24 + Hono + Baileys)
        ↓ linked device (QR)
WhatsApp pessoal do Marcelo (número 556781119511)
```

---

## Escopo exato

```
apps/whatsapp-gateway/
├── src/
│   ├── index.ts                 # Hono app + setup
│   ├── auth/
│   │   ├── session.ts           # QR pairing + session persist em Supabase
│   │   └── reconnect.ts         # Auto-reconnect em desconexão
│   ├── routes/
│   │   ├── health.ts            # GET /health
│   │   ├── messages.ts          # POST /send, GET /history
│   │   └── webhook.ts           # POST /webhook → notifica orchestrator
│   ├── services/
│   │   ├── baileys.ts           # Wrapper @whiskeysockets/baileys
│   │   └── supabase.ts          # Auth state persistence
│   └── config.ts
├── tests/
│   └── baileys.test.ts          # Mock Baileys, testa session + send
├── package.json
├── Dockerfile                   # Node 24-alpine, para Railway
└── README.md
```

---

## Implementação detalhada

### session.ts — auth state em Supabase

```typescript
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import { createClient } from "@supabase/supabase-js";

// Auth state persiste em Supabase table `jarvis_pessoal` (schema já existe?)
// Se não existir, criar migration mínima:
// CREATE TABLE jarvis_wa_sessions (
//   instance_id TEXT PRIMARY KEY,
//   auth_state JSONB NOT NULL,
//   phone TEXT,
//   status TEXT DEFAULT 'disconnected',
//   updated_at TIMESTAMPTZ DEFAULT now()
// );

export async function createSupabaseAuthState(instanceId: string) {
  // Implementar useSingleFileAuthState equivalente com Supabase como storage
  // Cada field do auth state (creds, keys) vai como JSON no JSONB
}
```

### baileys.ts — wrapper principal

```typescript
import makeWASocket from "@whiskeysockets/baileys";

export class BaileysClient {
  private sock: ReturnType<typeof makeWASocket>;

  async connect(instanceId: string): Promise<string | null>;
  // Retorna QR code como string (para exibir na UI ou enviar via push)
  // null = já conectado

  async sendMessage(to: string, text: string): Promise<string>;
  // Retorna messageId

  async getHistory(jid: string, limit: number): Promise<Message[]>;
  // Últimas N mensagens com contato

  async isConnected(): Promise<boolean>;
}
```

### routes/webhook.ts — notifica orchestrator em mensagem recebida

```typescript
// Quando Baileys recebe mensagem → POST para orchestrator
// com { from, text, timestamp, instance_id }
// Orchestrator decide se é mensagem para Claudinho ou aprovação HITL
```

### Dockerfile

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["node", "dist/index.js"]
```

---

## Tabela Supabase necessária

```sql
-- Migration: 20260421000001_jarvis_wa_sessions.sql
-- Aplicar em: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
CREATE TABLE IF NOT EXISTS jarvis_wa_sessions (
  instance_id   TEXT PRIMARY KEY,
  auth_state    JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone_number  TEXT,
  status        TEXT DEFAULT 'disconnected',
  qr_code       TEXT,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jarvis_wa_sessions ENABLE ROW LEVEL SECURITY;
```

---

## Variáveis de ambiente (Railway)

| Var                         | Descrição                                           |
| --------------------------- | --------------------------------------------------- |
| `SUPABASE_URL`              | URL do ECOSYSTEM                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role para escrever auth state               |
| `ORCHESTRATOR_URL`          | URL do Railway Orchestrator (webhook notifications) |
| `ORCHESTRATOR_SECRET`       | Header de autenticação para o orchestrator          |
| `PORT`                      | 3000 (default)                                      |
| `INSTANCE_ID`               | Identificador da instância (ex: `marcelo-pessoal`)  |

---

## Fluxo de pairing (primeiro uso)

1. `GET /health` → se `status=disconnected` → frontend exibe QR
2. `POST /auth/start` → Baileys gera QR → salvo em `jarvis_wa_sessions.qr_code`
3. Marcelo escaneia QR no WhatsApp (Configurações → Dispositivos Vinculados)
4. Baileys emite evento `connection.update { connection: 'open' }` → status = `connected`
5. `GET /health` → `status=connected` → jarvis-app exibe "Conectado"

---

## Testes

```typescript
// Mocks: vi.mock('@whiskeysockets/baileys')
test("connect retorna QR quando não autenticado");
test("sendMessage retorna messageId");
test("getHistory retorna array de mensagens");
test("webhook notifica orchestrator em mensagem recebida");
test("reconnect tenta 3x antes de marcar como disconnected");
```

---

## Critério de sucesso

- [ ] `apps/whatsapp-gateway/` com Hono + Baileys + auth state em Supabase
- [ ] Dockerfile funcional para Railway
- [ ] Migration SQL criada para `jarvis_wa_sessions`
- [ ] Testes unitários com mocks Baileys
- [ ] `GET /health` retorna `{status, phone, instance_id}`
- [ ] `POST /send` aceita `{to, text}` e retorna `{messageId}`
- [ ] README com instruções de pairing e deploy Railway
- [ ] CI verde
- [ ] Commit: `feat(jarvis): whatsapp-gateway Baileys Nível 2 — linked device + session Supabase [F1-S05]`

---

## Handoff

- **F1-S03 (jarvis-app)** precisa da URL do gateway para exibir QR e enviar mensagens
- **P-XXX nova:** Marcelo faz QR pairing após deploy Railway (HITL — não automatizável)
- **Fase 2:** multi-instância (um número por business) se outros gestores quiserem Jarvis
