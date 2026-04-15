
-- Add legal_representative_id to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS legal_representative_id uuid REFERENCES public.people(id);
