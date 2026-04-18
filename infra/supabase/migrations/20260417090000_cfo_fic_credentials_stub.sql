-- ============================================================
-- Migration: Credential stubs CFO-FIC no SC-29 (ECOSYSTEM)
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)
-- Data: 2026-04-17 · Sessão S16
--
-- Insere 5 placeholders para credenciais sandbox do CFO-FIC.
-- VALORES SÃO PLACEHOLDERS — Marcelo deve substituir via
-- Supabase Studio antes do primeiro run real (is_active=false).
--
-- Credenciais Inter sandbox: developers.inter.co → Sandbox
-- Credenciais Evolution: painel Evolution API → instância fic-sandbox
--
-- Após configurar, execute:
--   UPDATE ecosystem_credentials
--   SET vault_key = '<valor_real>', is_active = true
--   WHERE project = 'fic' AND environment = 'sandbox' AND name = '<NOME>';
-- ============================================================

INSERT INTO public.ecosystem_credentials
  (name, service, scope, location, project, environment, provider, proxy_only, is_active, acl, description)
VALUES
  (
    'INTER_CLIENT_ID',
    'banco-inter',
    'proxy',
    'PENDENTE_CONFIGURAR',
    'fic',
    'sandbox',
    'inter',
    true,
    false,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb,
    'Banco Inter sandbox — client_id OAuth2. Obter em developers.inter.co'
  ),
  (
    'INTER_CLIENT_SECRET',
    'banco-inter',
    'proxy',
    'PENDENTE_CONFIGURAR',
    'fic',
    'sandbox',
    'inter',
    true,
    false,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb,
    'Banco Inter sandbox — client_secret OAuth2'
  ),
  (
    'INTER_CERT_PEM',
    'banco-inter',
    'proxy',
    'PENDENTE_CONFIGURAR',
    'fic',
    'sandbox',
    'inter',
    true,
    false,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb,
    'Banco Inter sandbox — certificado mTLS (PEM)'
  ),
  (
    'INTER_KEY_PEM',
    'banco-inter',
    'proxy',
    'PENDENTE_CONFIGURAR',
    'fic',
    'sandbox',
    'inter',
    true,
    false,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb,
    'Banco Inter sandbox — chave privada mTLS (PEM)'
  ),
  (
    'EVOLUTION_API_TOKEN',
    'evolution-api',
    'proxy',
    'PENDENTE_CONFIGURAR',
    'fic',
    'sandbox',
    'evolution',
    true,
    false,
    '[{"agent_pattern": "cfo-fic", "allowed_scopes": ["proxy"]}]'::jsonb,
    'Evolution API — API Key instância fic-sandbox'
  )
ON CONFLICT (name, project, environment) DO NOTHING;

-- ============================================================
-- Verificação pós-insert (executar manualmente):
-- ============================================================
-- SELECT name, environment, is_active, description
-- FROM public.ecosystem_credentials
-- WHERE project = 'fic'
-- ORDER BY environment, name;
