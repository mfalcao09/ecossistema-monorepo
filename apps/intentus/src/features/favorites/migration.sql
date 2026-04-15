-- ============================================================
-- Migration: Property Favorites
-- Feature: Permitir usuários marcarem imóveis como favoritos
-- Autor: Claude (Opus) — full-feature-pipeline test
-- Data: 05/04/2026
-- ============================================================

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS public.property_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  notes TEXT,
  notify_on_change BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. Unique constraint (parcial — só ativos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_property_favorites_active
  ON public.property_favorites (tenant_id, user_id, property_id)
  WHERE deleted_at IS NULL;

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_property_favorites_user
  ON public.property_favorites (tenant_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_property_favorites_property
  ON public.property_favorites (tenant_id, property_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_property_favorites_notify
  ON public.property_favorites (tenant_id, property_id)
  WHERE deleted_at IS NULL AND notify_on_change = true;

-- 4. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.update_property_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_favorites_updated_at
  BEFORE UPDATE ON public.property_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_property_favorites_updated_at();

-- 5. RLS
ALTER TABLE public.property_favorites ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE policies (obrigatório antes de RESTRICTIVE)
CREATE POLICY "Users can view own favorites"
  ON public.property_favorites
  FOR SELECT
  USING (
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can insert own favorites"
  ON public.property_favorites
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update own favorites"
  ON public.property_favorites
  FOR UPDATE
  USING (
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND deleted_at IS NULL
  );

-- Admin/superadmin podem ver todos (para dashboards)
CREATE POLICY "Admins can view all favorites"
  ON public.property_favorites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      AND ur.role IN ('superadmin', 'admin')
      AND ur.tenant_id = property_favorites.tenant_id
    )
  );

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP POLICY IF EXISTS "Admins can view all favorites" ON public.property_favorites;
-- DROP POLICY IF EXISTS "Users can update own favorites" ON public.property_favorites;
-- DROP POLICY IF EXISTS "Users can insert own favorites" ON public.property_favorites;
-- DROP POLICY IF EXISTS "Users can view own favorites" ON public.property_favorites;
-- DROP TRIGGER IF EXISTS trg_property_favorites_updated_at ON public.property_favorites;
-- DROP FUNCTION IF EXISTS public.update_property_favorites_updated_at();
-- DROP TABLE IF EXISTS public.property_favorites;
