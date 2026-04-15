
-- Fix overly permissive RLS on social_feed_cache: restrict write to service role only
DROP POLICY "Service role can manage social feed" ON public.social_feed_cache;

-- Only allow inserts/updates/deletes via service role (edge functions)
-- The service role bypasses RLS anyway, so we don't need an ALL policy for regular users
-- Regular users only need SELECT which is already covered
