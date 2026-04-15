-- Backup Log Table for Encrypted Database Backups
-- Tracks backup status, encryption metadata, and storage locations

CREATE TABLE backup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('diario', 'semanal', 'mensal', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('sucesso', 'erro', 'em_andamento')),
  tabelas_incluidas TEXT[],
  tamanho_bytes BIGINT,
  tamanho_criptografado_bytes BIGINT,
  algoritmo_criptografia TEXT DEFAULT 'AES-256-GCM',
  versao_chave TEXT,
  armazenamento TEXT CHECK (armazenamento IN ('r2', 'supabase_storage', 'local')),
  caminho_arquivo TEXT,
  hash_sha256 TEXT,
  inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fim TIMESTAMPTZ,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_backup_log_tipo ON backup_log(tipo);
CREATE INDEX idx_backup_log_status ON backup_log(status);
CREATE INDEX idx_backup_log_created_at ON backup_log(created_at DESC);
CREATE INDEX idx_backup_log_armazenamento ON backup_log(armazenamento);

-- Enable Row Level Security
ALTER TABLE backup_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can read backup logs
CREATE POLICY "Apenas admins veem logs de backup" ON backup_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuario_papeis up
      JOIN papeis p ON p.id = up.papel_id
      WHERE up.user_id = auth.uid()
      AND p.slug = 'admin'
    )
  );

-- RLS Policy: Only service role can insert (for automated backups)
CREATE POLICY "Service role insere logs de backup" ON backup_log
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
  );

-- RLS Policy: Only service role can update (status updates)
CREATE POLICY "Service role atualiza logs de backup" ON backup_log
  FOR UPDATE USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_backup_log_timestamp
  BEFORE UPDATE ON backup_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
