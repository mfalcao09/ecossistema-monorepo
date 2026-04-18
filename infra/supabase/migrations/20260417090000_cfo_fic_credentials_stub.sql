-- ============================================================
-- Migration: Credential stubs CFO-FIC no SC-29 (ECOSYSTEM)
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Data: 2026-04-17 · Sessão S16
--
-- Insere 5 placeholders para credenciais do CFO-FIC.
-- VALORES SÃO PLACEHOLDERS — Marcelo deve substituir via
-- Supabase Studio ou CLI antes do primeiro run real.
--
-- Após inserir, execute:
--   SELECT name, project, environment, proxy_only, last_used_at
--   FROM ecosystem_credentials
--   WHERE project = 'fic';
-- ============================================================

-- Guard: só insere se ainda não existirem
INSERT INTO public.ecosystem_credentials
  (name, value, service, project, environment, provider, proxy_only, acl)
VALUES
  (
    'INTER_CLIENT_ID',
    'PENDENTE_CONFIGURAR',
    'banco-inter',
    'fic',
    'sandbox',
    'inter',
    true,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb
  ),
  (
    'INTER_CLIENT_SECRET',
    'PENDENTE_CONFIGURAR',
    'banco-inter',
    'fic',
    'sandbox',
    'inter',
    true,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb
  ),
  (
    'INTER_CERT',
    'PENDENTE_CONFIGURAR',
    'banco-inter',
    'fic',
    'sandbox',
    'inter',
    true,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb
  ),
  (
    'INTER_KEY',
    'PENDENTE_CONFIGURAR',
    'banco-inter',
    'fic',
    'sandbox',
    'inter',
    true,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb
  ),
  (
    'EVOLUTION_API_TOKEN',
    'PENDENTE_CONFIGURAR',
    'evolution-api',
    'fic',
    'sandbox',
    'evolution',
    true,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb
  )
ON CONFLICT (name, project, environment) DO NOTHING;

-- ============================================================
-- Verificação pós-insert (comentada — executar manualmente)
-- ============================================================
-- SELECT
--   name,
--   project,
--   environment,
--   provider,
--   proxy_only,
--   CASE WHEN value = 'PENDENTE_CONFIGURAR' THEN '⚠️ PENDENTE' ELSE '✅ OK' END AS status
-- FROM public.ecosystem_credentials
-- WHERE project = 'fic'
-- ORDER BY name;
