---
name: Nexvy Gap Analysis batch 2 — 15 novas tabelas identificadas
description: Nexvy Gap Analysis batch 2 — 15 novas tabelas identificadas
type: reference
project: erp
tags: ["nexvy", "atendimento", "schema", "gap-analysis", "tabelas"]
success_score: 0.93
supabase_id: 2cf6711b-8110-49c8-ab96-289791f794a6
created_at: 2026-04-13 02:29:34.843781+00
updated_at: 2026-04-13 07:04:18.906086+00
---

Novas tabelas identificadas nos prints batch 2 (38 screenshots):

P2 (Sprint 4):
- deal_activities: Tipo/Responsável/Assunto/Agendado/Duração/Anexo/NotasHTML/deal_id
- deal_history_events: deal_id/event_type enum/description TEXT (imutável)
- deal_notes: deal_id/agent_id/content/attachment_url
- contact_custom_fields: contact_id/field_name/field_value (par chave-valor inline)
- stage_task_cadences: pipeline_stage_id/activity_type/subject/delay_days/duration_minutes
- campaigns: name/description/status + contact_campaigns M2M
- automation_executions: automation_rule_id/pipeline_stage_id/deal_id/status/error

P3 (Sprint 9):
- ds_voice_folders: nome + content_type enum
- ds_voice_messages: content/variables JSONB/visible_to_all/editable_on_send
- ds_voice_audios: file_url/duration_seconds/send_as_voice_message BOOL
- ds_voice_media: media_type(image|video)/file_url/caption
- ds_voice_documents: file_url/file_type/file_size
- ds_voice_funnels: name/visible_to_all/total_duration_seconds
- ds_voice_funnel_steps: funnel_id/position/content_type/content_id/delay_seconds
- ds_voice_triggers: funnel_id/condition_text/case_insensitive/ignore_saved_contacts/ignore_groups/active_whatsapp/active_instagram/tags JSONB
- products: nome (deals opciona produto)

Total acumulado: 30 tabelas novas necessárias para módulo Atendimento completo (além das 9 do Sprint 1)
