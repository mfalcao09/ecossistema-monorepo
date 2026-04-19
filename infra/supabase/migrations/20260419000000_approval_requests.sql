-- Migration: approval_requests table
-- Migra _pending_approvals de in-memory para Supabase ECOSYSTEM.
-- F1-S01 — Stage 2 WA routing HITL.

CREATE TABLE IF NOT EXISTS public.approval_requests (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   text        NOT NULL,
    agent_id     text        NOT NULL,
    status       text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'allow', 'deny')),
    requires_action jsonb,
    decided_by   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice para queries de pending
CREATE INDEX IF NOT EXISTS approval_requests_status_idx
    ON public.approval_requests (status)
    WHERE status = 'pending';

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER approval_requests_updated_at
    BEFORE UPDATE ON public.approval_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: somente service_role acessa
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.approval_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.approval_requests IS
    'HITL approval requests — Managed Agents → CEO via WhatsApp. F1-S01.';
