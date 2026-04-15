-- Create ia_usage_log table for tracking AI usage per tenant
-- Used for monthly limit control and analytics

CREATE TABLE IF NOT EXISTS ia_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
  modulo VARCHAR(50) NOT NULL,
  funcionalidade VARCHAR(100),
  modelo VARCHAR(100) NOT NULL,
  tokens_usados INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for monthly usage count queries per tenant
CREATE INDEX IF NOT EXISTS idx_ia_usage_tenant_month
  ON ia_usage_log(tenant_id, created_at);

-- Index for analytics by module
CREATE INDEX IF NOT EXISTS idx_ia_usage_modulo
  ON ia_usage_log(modulo, created_at);

-- Index for user-level tracking
CREATE INDEX IF NOT EXISTS idx_ia_usage_user
  ON ia_usage_log(user_id, created_at);

-- RLS
ALTER TABLE ia_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own ia usage" ON ia_usage_log
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "System can insert ia usage logs" ON ia_usage_log
  FOR INSERT WITH CHECK (true);

-- Insert default limit parameter for all existing tenants
INSERT INTO parametros_sistema (tenant_id, chave, valor, tipo, modulo, descricao, editavel)
SELECT
  i.id,
  'max_ia_calls_per_month',
  '5000',
  'numero',
  'ia',
  'Limite mensal de chamadas IA por tenant',
  true
FROM instituicoes i
WHERE NOT EXISTS (
  SELECT 1 FROM parametros_sistema ps
  WHERE ps.tenant_id = i.id
  AND ps.chave = 'max_ia_calls_per_month'
);
