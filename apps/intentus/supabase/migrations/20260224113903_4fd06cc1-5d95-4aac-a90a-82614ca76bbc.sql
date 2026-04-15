
ALTER TABLE public.teams
  ADD COLUMN is_signature_department boolean NOT NULL DEFAULT false;

ALTER TABLE public.legal_signature_envelopes
  ADD COLUMN department_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
