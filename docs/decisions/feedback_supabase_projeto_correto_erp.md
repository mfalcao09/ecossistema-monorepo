---
name: Supabase projeto correto do ERP é ifdnjieklngcfodmtied
description: 🚨 CRÍTICO — Vercel ERP aponta para ifdnjieklngcfodmtied (sa-east-1), NÃO bvryaopfjiyxjgsuhjsb (Intentus). Schema atendimento_* é canônico.
type: feedback
---

## Regra

**Qualquer SQL, migration ou diagnóstico do ERP Educacional/FIC DEVE usar `project_id = ifdnjieklngcfodmtied`.**

O projeto `bvryaopfjiyxjgsuhjsb` é o **Intentus Real Estate** (negócio diferente). Confundir os dois desperdiça horas de debugging.

**Why:** Sessão 088 (13/04/2026) — foram gastas horas tentando recarregar o schema cache do PostgREST no projeto errado. A causa raiz era que o Vercel `prj_VIEmyVHGD61ow5uf5pmBJp5W7eAX` aponta para `ifdnjieklngcfodmtied`, evidenciado pelo hint do PostgREST mencionando `atendimento_contacts` (existe só em `ifdnjieklngcfodmtied`).

**How to apply:**
- `execute_sql` para o ERP → sempre `project_id = ifdnjieklngcfodmtied`
- `execute_sql` para ECOSYSTEM/memória online → sempre `project_id = gqckbunsfjgerbuiyzvn`
- `execute_sql` para Intentus → sempre `project_id = bvryaopfjiyxjgsuhjsb`

## Schema canônico do módulo atendimento (ERP FIC)

Migration: `supabase/migrations/20260412_atendimento_modulo_init.sql` (Sprint S1 sessão 085)

Tabelas `atendimento_*` — **single-tenant, sem coluna `tenant_id`**:
- `atendimento_inboxes` — `provider_config JSONB` contém `phone_number_id`
- `atendimento_contacts` — `phone_number`, `external_id`, `additional_attributes JSONB`
- `atendimento_conversations` — `inbox_id`, `contact_id`, `status` (open/resolved/pending/snoozed), `channel_conversation_id`, `last_activity_at`, `unread_count`
- `atendimento_messages` — `conversation_id`, `content`, `message_type` (incoming/outgoing), `content_type`, `channel_message_id`, `sender_type` (contact/agent)

**webhook.ts DEVE usar `atendimento_*`, NÃO `chat_*`** (chat_* foi criado por engano no projeto Intentus — tech debt a limpar).

## Inbox WhatsApp FIC (seed executado em 13/04/2026)

```
id = 179deb2b-e254-4125-9465-33acf2a8ed14
name = 'WhatsApp FIC (WABA)'
channel_type = 'whatsapp'
provider_config.phone_number_id = '938274582707248'
provider_config.waba_id = '1833772130611929'
```
