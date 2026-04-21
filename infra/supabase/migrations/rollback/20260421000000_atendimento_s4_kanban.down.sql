-- Rollback — Atendimento S4 Kanban
-- Reverte 20260421000000_atendimento_s4_kanban.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_protocols_bump_count       ON protocols;
DROP TRIGGER IF EXISTS trg_deals_history_update       ON deals;
DROP TRIGGER IF EXISTS trg_deals_history_insert       ON deals;
DROP TRIGGER IF EXISTS trg_pipelines_updated_at       ON pipelines;
DROP TRIGGER IF EXISTS trg_pipeline_stages_updated_at ON pipeline_stages;
DROP TRIGGER IF EXISTS trg_deals_updated_at           ON deals;
DROP TRIGGER IF EXISTS trg_deal_activities_updated_at ON deal_activities;
DROP TRIGGER IF EXISTS trg_protocols_updated_at       ON protocols;
DROP TRIGGER IF EXISTS trg_campaigns_updated_at       ON campaigns;

DROP FUNCTION IF EXISTS atnd_s4_bump_protocol_count();
DROP FUNCTION IF EXISTS atnd_s4_log_deal_history();
DROP FUNCTION IF EXISTS atnd_s4_touch_updated_at();

ALTER TABLE atendimento_conversations
  DROP COLUMN IF EXISTS deal_id,
  DROP COLUMN IF EXISTS protocol_count;

ALTER TABLE atendimento_contacts
  DROP COLUMN IF EXISTS aluno_id,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS color_hex;

DROP TABLE IF EXISTS contact_custom_fields CASCADE;
DROP TABLE IF EXISTS campaigns             CASCADE;
DROP TABLE IF EXISTS protocols             CASCADE;
DROP TABLE IF EXISTS deal_history_events   CASCADE;
DROP TABLE IF EXISTS deal_notes            CASCADE;
DROP TABLE IF EXISTS deal_activities       CASCADE;
DROP TABLE IF EXISTS deals                 CASCADE;
DROP TABLE IF EXISTS pipeline_stages       CASCADE;
DROP TABLE IF EXISTS pipelines             CASCADE;

COMMIT;
