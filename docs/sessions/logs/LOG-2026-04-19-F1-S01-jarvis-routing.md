# LOG — F1-S01 Jarvis Routing (2026-04-19)

**Branch:** `feature/f1-s01-jarvis-routing`
**PR:** https://github.com/mfalcao09/ecossistema-monorepo/pull/25
**Commits:** `8325315` (F1-S01) + `62786b7` (P3 resume)
**Testes:** 19/19 passando

---

## O que foi feito

### Código entregue

| Arquivo | Descrição |
|---|---|
| `services/whatsapp_service.py` | Outbound Meta Graph API v20.0 — graceful sem token |
| `services/approval_service.py` | CRUD async `approval_requests` — Supabase + in-memory fallback |
| `routes/webhooks.py` | `GET/POST /webhooks/whatsapp` + HITL migrado + `_resume_session()` |
| `config.py` | 4 novas env vars WhatsApp |
| `tests/test_whatsapp_webhook.py` | 9 testes: verify, inbound, SIM/NÃO, prefix ID |
| `tests/test_hitl.py` | 8→10 testes: HITL completo + resume + ignores_api_error |
| `apps/fic/agents/cfo/tools/` | `shared.ts` + `send_whatsapp_cobranca.ts` + `index.ts` |

### Infraestrutura

- **Supabase ECOSYSTEM** (`gqck…`): migration `approval_requests` aplicada via MCP ✅
- **Railway Orchestrator**: P-009 (env vars) pendente — Railway CLI não autenticado na sessão

### Fluxo HITL completo implementado

```
Agente → POST /webhooks/status-idled → approval_service (Supabase)
  → whatsapp_service.send_text() → Marcelo recebe WA
  → Marcelo responde "SIM <id>" → POST /webhooks/whatsapp (inbound)
  → _route_approval_reply → approval_service.update_approval(allow)
  → _resume_session() → client.beta.sessions.events.send(session_id, user.message)
  → Managed Agent retoma execução
```

---

## Decisão arquitetural importante — Visão Jarvis revisada

**Contexto:** Discussão sobre P4 (Meta WABA Dashboard) levou a questionamento sobre a arquitetura do Jarvis.

**O que Marcelo quer:** Jarvis como "Siri para o WhatsApp dele" — lê conversas, resume, prepara e envia respostas como Marcelo.

**O que construímos em F1-S01:** Canal de aprovações HITL (Jarvis tem número próprio WABA, notifica Marcelo sobre decisões críticas). Ainda válido como canal de HITL, mas não é o produto principal.

**Visão confirmada:**
- Evolution API (Railway, linked device) lê o WhatsApp pessoal do Marcelo
- Jarvis App (Expo + Swift nativo) roda no iPhone 15 Pro Max
- Action Button mapeado para abrir Jarvis em modo voz
- Apple Intelligence (App Intents) — iPhone 15 Pro Max tem suporte
- Canal HITL atual → substituído por push notifications APNs quando app estiver pronto

---

## Pendências abertas desta sessão

| ID | Ação | Severidade |
|---|---|---|
| P-009 | Configurar 4 env vars no Railway Orchestrator (`META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `MARCELO_WHATSAPP_NUMBER`) | high |
| P-010 | Registrar webhook URL no Meta WABA Dashboard (`/webhooks/whatsapp` + verify token) | high |

---

## Próxima sessão: F1-S02 — `jarvis-app`

- Expo (React Native) — `apps/jarvis-app`
- Action Button shortcut → abre app em modo voz
- Microfone → texto → Orchestrator → agentes → resposta em voz/texto
- App Intents (módulo Swift nativo) para integração com Siri/Apple Intelligence
- Evolution API como backend de leitura do WhatsApp pessoal
- Push notifications (APNs) para HITL — substitui canal WA atual
