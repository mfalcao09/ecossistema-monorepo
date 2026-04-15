
-- Add start_date and due_date columns to deal_requests for the Trello-style dates feature
ALTER TABLE public.deal_requests
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS due_date timestamptz;
