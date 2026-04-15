
-- Table for internal company announcements visible on dashboard
CREATE TABLE public.company_announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  priority text NOT NULL DEFAULT 'normal',
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view active announcements"
  ON public.company_announcements FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Admins can manage announcements"
  ON public.company_announcements FOR ALL
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

-- Table to cache social media posts (Instagram etc.)
CREATE TABLE public.social_feed_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'instagram',
  post_id text NOT NULL,
  media_url text,
  thumbnail_url text,
  caption text,
  permalink text,
  posted_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, post_id)
);

ALTER TABLE public.social_feed_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view social feed"
  ON public.social_feed_cache FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Service role can manage social feed"
  ON public.social_feed_cache FOR ALL
  USING (true)
  WITH CHECK (true);
