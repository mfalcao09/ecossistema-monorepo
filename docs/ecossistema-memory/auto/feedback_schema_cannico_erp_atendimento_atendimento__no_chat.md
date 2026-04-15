---
name: Schema canônico ERP atendimento: atendimento_* (não chat_*)
description: Schema canônico ERP atendimento: atendimento_* (não chat_*)
type: feedback
project: erp
tags: ["atendimento", "schema", "webhook", "whatsapp", "sprint-s2"]
success_score: 0.95
supabase_id: 52c09bf1-d4a8-4c65-a689-dede514f1232
created_at: 2026-04-13 06:47:08.370588+00
updated_at: 2026-04-13 09:04:39.356233+00
---

O módulo de atendimento do ERP Educacional usa tabelas atendimento_* (migration 20260412_atendimento_modulo_init.sql, Sprint S1 sessão 085). Single-tenant, sem tenant_id. Tabelas: atendimento_inboxes (provider_config JSONB com phone_number_id), atendimento_contacts (phone_number, external_id), atendimento_conversations (inbox_id, contact_id, status, channel_conversation_id, last_activity_at), atendimento_messages (conversation_id, message_type incoming/outgoing, channel_message_id, sender_type contact/agent). webhook.ts DEVE usar esse schema. Tabelas chat_* foram criadas por engano no projeto Intentus — tech debt a limpar.
