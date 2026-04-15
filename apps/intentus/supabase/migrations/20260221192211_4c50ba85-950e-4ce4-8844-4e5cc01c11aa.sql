
-- Add provider metadata columns to chat_channels
ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS connected_via TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS waba_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_business_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zapi_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS zapi_instance_token TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.chat_channels.connected_via IS 'Connection provider: hunion, zapi, or manual';
COMMENT ON COLUMN public.chat_channels.zapi_instance_id IS 'Z-API instance ID - internal use only, never exposed to frontend';
COMMENT ON COLUMN public.chat_channels.zapi_instance_token IS 'Z-API instance token - internal use only, never exposed to frontend';
