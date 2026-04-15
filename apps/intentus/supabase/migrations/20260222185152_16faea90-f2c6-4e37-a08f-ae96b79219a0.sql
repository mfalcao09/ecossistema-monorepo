ALTER TABLE public.deal_request_comments
  ADD COLUMN IF NOT EXISTS mentioned_users UUID[] DEFAULT '{}';