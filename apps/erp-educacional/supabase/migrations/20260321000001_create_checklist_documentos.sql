-- Create checklist_documentos table
CREATE TABLE IF NOT EXISTS checklist_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES instituicoes(id) ON DELETE CASCADE,
  tipo_vinculo VARCHAR(30) NOT NULL,
  tipo_documento VARCHAR(50) NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, tipo_vinculo, tipo_documento)
);

-- Index for fast lookups
CREATE INDEX idx_checklist_docs_tenant_vinculo ON checklist_documentos(tenant_id, tipo_vinculo);

-- RLS
ALTER TABLE checklist_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own checklist" ON checklist_documentos
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Tenant can manage own checklist" ON checklist_documentos
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- Seed: insert default checklists for existing tenants
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  FOR v_tenant_id IN SELECT id FROM instituicoes LOOP
    -- Aluno
    INSERT INTO checklist_documentos (tenant_id, tipo_vinculo, tipo_documento, descricao, obrigatorio, ordem) VALUES
      (v_tenant_id, 'aluno', 'rg', 'RG (Identidade)', true, 1),
      (v_tenant_id, 'aluno', 'cpf', 'CPF', true, 2),
      (v_tenant_id, 'aluno', 'certidao_nascimento', 'Certidão de Nascimento ou Casamento', true, 3),
      (v_tenant_id, 'aluno', 'comprovante_residencia', 'Comprovante de Residência', true, 4),
      (v_tenant_id, 'aluno', 'historico_escolar', 'Histórico Escolar do Ensino Médio', true, 5),
      (v_tenant_id, 'aluno', 'foto_3x4', 'Foto 3x4 recente', true, 6),
      (v_tenant_id, 'aluno', 'titulo_eleitor', 'Título de Eleitor', false, 7),
      (v_tenant_id, 'aluno', 'reservista', 'Certificado de Reservista (sexo masculino)', false, 8),
      -- Professor
      (v_tenant_id, 'professor', 'rg', 'RG (Identidade)', true, 1),
      (v_tenant_id, 'professor', 'cpf', 'CPF', true, 2),
      (v_tenant_id, 'professor', 'comprovante_residencia', 'Comprovante de Residência', true, 3),
      (v_tenant_id, 'professor', 'diploma', 'Diploma de Graduação', true, 4),
      (v_tenant_id, 'professor', 'curriculo_lattes', 'Currículo Lattes atualizado', true, 5),
      -- Colaborador
      (v_tenant_id, 'colaborador', 'rg', 'RG (Identidade)', true, 1),
      (v_tenant_id, 'colaborador', 'cpf', 'CPF', true, 2),
      (v_tenant_id, 'colaborador', 'ctps', 'CTPS (Carteira de Trabalho)', true, 3),
      (v_tenant_id, 'colaborador', 'comprovante_residencia', 'Comprovante de Residência', true, 4),
      (v_tenant_id, 'colaborador', 'certidao_nascimento', 'Certidão de Nascimento ou Casamento', true, 5),
      (v_tenant_id, 'colaborador', 'pis_pasep', 'PIS/PASEP', true, 6)
    ON CONFLICT (tenant_id, tipo_vinculo, tipo_documento) DO NOTHING;
  END LOOP;
END $$;
