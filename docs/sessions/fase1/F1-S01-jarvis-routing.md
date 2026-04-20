# F1-S01 — Stage 2 WA Routing: Inbound/Outbound + HITL via WhatsApp

**Branch:** `feature/f1-s01-jarvis-routing`
**Data:** 2026-04-19
**Status:** ✅ Implementado

## Objetivo

Conectar o Orchestrator ao canal WhatsApp WABA bidirecional:
- **Outbound:** Notificar Marcelo sobre aprovações pendentes
- **Inbound:** Receber respostas "SIM"/"NÃO" do CEO para decisões HITL
- **Supabase:** Migrar `_pending_approvals` de in-memory para `approval_requests`

## Entregáveis

### 1. `whatsapp_service.py`
- Envio outbound via Meta Graph API v20.0
- Graceful degradation: sem token → warning, não quebra
- Path: `apps/orchestrator/src/orchestrator/services/whatsapp_service.py`

### 2. `approval_service.py`
- CRUD async para `approval_requests`
- Supabase quando configurado, in-memory como fallback (testes)
- Path: `apps/orchestrator/src/orchestrator/services/approval_service.py`

### 3. `webhooks.py` (atualizado)
- `GET /webhooks/whatsapp` — Meta webhook verify (hub.challenge)
- `POST /webhooks/whatsapp` — WABA inbound routing
- `_route_approval_reply()` — roteia "SIM [prefix]" / "NÃO [prefix]"
- `_notify_ceo()` — agora chama `whatsapp_service.send_text()`
- Todos endpoints HITL migrados para `approval_service`

### 4. Migration SQL
- Tabela `approval_requests` com RLS (service_role only)
- Path: `infra/supabase/migrations/20260419000000_approval_requests.sql`

### 5. FIC Tools (recuperados de pensive-feynman-cbc22b)
- `apps/fic/agents/cfo/tools/shared.ts`
- `apps/fic/agents/cfo/tools/send_whatsapp_cobranca.ts`
- `apps/fic/agents/cfo/tools/index.ts`

### 6. Testes
- `tests/test_whatsapp_webhook.py` — 8 testes: verify, inbound, SIM/NÃO routing
- `tests/test_hitl.py` — 7 testes: HITL full flow (migrado para approval_service)

## Config adicionada (env vars)

```env
META_WHATSAPP_TOKEN=        # Bearer token Meta Cloud API
META_PHONE_NUMBER_ID=       # ID do número WhatsApp Business
META_WEBHOOK_VERIFY_TOKEN=ecossistema-whatsapp-verify
MARCELO_WHATSAPP_NUMBER=    # ex: 5567999990000
```

## Fluxo completo HITL via WhatsApp

```
Agente executa ação crítica
      ↓
POST /webhooks/status-idled
      ↓
approval_service.create_approval() → Supabase approval_requests
      ↓
_notify_ceo() → whatsapp_service.send_text() → Meta Graph API
      ↓
Marcelo recebe WA: "Aprovação pendente — CFO-FIC\n...\nResponda SIM <id> ou NÃO <id>"
      ↓
Marcelo responde "SIM" via WhatsApp
      ↓
POST /webhooks/whatsapp (inbound)
      ↓
_route_approval_reply("SIM") → approval_service.update_approval(decision="allow")
      ↓
TODO(F1-S02): client.beta.sessions.events.send(session_id, ...) → resume agente
```

## Pendências para F1-S02

- [ ] Resume de sessão via Managed Agents API após aprovação
- [ ] Assinatura X-Hub-Signature-256 com secret separado (não o token de envio)
- [ ] Aplicar migration em Supabase ECOSYSTEM

## Commit

```
feat(jarvis): Stage 2 WA routing — inbound/outbound + HITL via WA [F1-S01]
```
