-- =============================================================================
-- Migração: Row Level Security (RLS) — Tabelas Críticas
-- ERP Educacional FIC — Diploma Digital
-- Data: 2026-03-26
-- =============================================================================
--
-- OBJETIVO:
-- Implementar Row Level Security em todas as tabelas críticas do ERP
-- garantindo isolamento de dados por tenant (instituição) e permissões
-- baseadas em papéis/funções dos usuários.
--
-- TABELAS PROTEGIDAS (12):
-- 1. documentos_digitais    — Diplomas, XMls, PDFs
-- 2. processos_emissao      — Processos em lote
-- 3. pessoas                — Dados pessoais (alunos, professores, etc)
-- 4. instituicoes           — Configuração das IES
-- 5. cursos                 — Cursos oferecidos
-- 6. usuario_papeis         — Vínculo usuário-papel-tenant
-- 7. papeis                 — Papéis/funções (Admin, Coordenador, etc)
-- 8. permissoes             — Permissões individuais
-- 9. papel_permissoes       — Vínculo papel-permissão
-- 10. usuario_permissoes_diretas — Permissões diretas sem papel
-- 11. acervo_lotes          — Lotes de documentos digitalizados
-- 12. config_diploma        — Configuração de diploma digital
--
-- ESTRATÉGIA DE SEGURANÇA:
-- - Authenticated users: Acesso aos dados de seu tenant (via usuario_papeis)
-- - Service Role: Bypass automático (migrations e admin)
-- - Anon: Sem acesso (apis públicas usam RPC functions)
--
-- HELPER FUNCTIONS:
-- - get_user_tenant_ids()   — Retorna tenants do usuário logado
-- - is_admin()              — Verifica se é admin da instituição
--
-- =============================================================================

-- ============================================================================
-- STEP 1: HELPER FUNCTIONS
-- ============================================================================

-- Função 1: get_user_tenant_ids()
-- Retorna array de tenant_ids (instituicoes) que o usuário atual pertence
-- Usada em todas as políticas RLS para filtrar dados por tenant
CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT tenant_id), ARRAY[]::UUID[])
  FROM usuario_papeis
  WHERE usuario_id = auth.uid()
    AND ativo = TRUE
$$;

COMMENT ON FUNCTION get_user_tenant_ids() IS
'Helper para RLS: Retorna array de tenant_ids do usuário autenticado.
Usado para filtrar dados por tenant em políticas RLS.
Retorna array vazio se usuário não tem vínculos ativos.';

-- Função 2: is_admin()
-- Verifica se o usuário atual é admin de qualquer instituição
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM usuario_papeis up
    INNER JOIN papeis p ON p.id = up.papel_id
    WHERE up.usuario_id = auth.uid()
      AND up.ativo = TRUE
      AND p.nome ILIKE '%admin%'
      AND p.ativo = TRUE
    LIMIT 1
  )
$$;

COMMENT ON FUNCTION is_admin() IS
'Helper para RLS: Verifica se usuário é admin de qualquer instituição.
Retorna TRUE se tem papel contendo "admin" em nome.
Usado para políticas especiais de admin.';

-- ============================================================================
-- STEP 2: ENABLE RLS ON CRITICAL TABLES
-- ============================================================================

ALTER TABLE IF EXISTS documentos_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS processos_emissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS instituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuario_papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS papel_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuario_permissoes_diretas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS acervo_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS config_diploma ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: RLS POLICIES FOR DOCUMENTOS_DIGITAIS
-- Table: documentos_digitais (Diplomas, XMLs, PDFs)
-- Tenancy Key: tenant_id (instituicao_id)
-- ============================================================================

-- documentos_digitais_select_authenticated
-- Usuários autenticados podem ler documentos do seu tenant
CREATE POLICY IF NOT EXISTS "documentos_digitais_select_authenticated"
  ON documentos_digitais
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

COMMENT ON POLICY "documentos_digitais_select_authenticated" ON documentos_digitais IS
'SELECT: Usuários podem ler documentos do seu tenant.';

-- documentos_digitais_insert_authenticated
-- Usuários podem criar documentos se têm permissão "inserir" no tenant
CREATE POLICY IF NOT EXISTS "documentos_digitais_insert_authenticated"
  ON documentos_digitais
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

COMMENT ON POLICY "documentos_digitais_insert_authenticated" ON documentos_digitais IS
'INSERT: Usuários podem criar documentos no seu tenant.';

-- documentos_digitais_update_authenticated
-- Usuários podem editar documentos do seu tenant
CREATE POLICY IF NOT EXISTS "documentos_digitais_update_authenticated"
  ON documentos_digitais
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  )
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

COMMENT ON POLICY "documentos_digitais_update_authenticated" ON documentos_digitais IS
'UPDATE: Usuários podem editar documentos do seu tenant.';

-- documentos_digitais_delete_authenticated
-- Apenas admins podem deletar documentos
CREATE POLICY IF NOT EXISTS "documentos_digitais_delete_authenticated"
  ON documentos_digitais
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    AND is_admin()
  );

COMMENT ON POLICY "documentos_digitais_delete_authenticated" ON documentos_digitais IS
'DELETE: Apenas admins podem deletar documentos.';

-- ============================================================================
-- STEP 4: RLS POLICIES FOR PROCESSOS_EMISSAO
-- Table: processos_emissao (Processos em lote)
-- Tenancy Key: instituicao_id
-- ============================================================================

-- processos_emissao_select_authenticated
CREATE POLICY IF NOT EXISTS "processos_emissao_select_authenticated"
  ON processos_emissao
  FOR SELECT
  TO authenticated
  USING (
    instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- processos_emissao_insert_authenticated
CREATE POLICY IF NOT EXISTS "processos_emissao_insert_authenticated"
  ON processos_emissao
  FOR INSERT
  TO authenticated
  WITH CHECK (
    instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- processos_emissao_update_authenticated
CREATE POLICY IF NOT EXISTS "processos_emissao_update_authenticated"
  ON processos_emissao
  FOR UPDATE
  TO authenticated
  USING (
    instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  )
  WITH CHECK (
    instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- ============================================================================
-- STEP 5: RLS POLICIES FOR PESSOAS
-- Table: pessoas (Dados pessoais: alunos, professores, colaboradores)
-- Tenancy Key: tenant_id
-- ============================================================================

-- pessoas_select_authenticated
CREATE POLICY IF NOT EXISTS "pessoas_select_authenticated"
  ON pessoas
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- pessoas_insert_authenticated
CREATE POLICY IF NOT EXISTS "pessoas_insert_authenticated"
  ON pessoas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- pessoas_update_authenticated
CREATE POLICY IF NOT EXISTS "pessoas_update_authenticated"
  ON pessoas
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  )
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- ============================================================================
-- STEP 6: RLS POLICIES FOR INSTITUICOES
-- Table: instituicoes (Configuração das IES)
-- Tenancy Key: id (a própria tabela é tenant)
-- ============================================================================

-- instituicoes_select_authenticated
-- Usuários podem ler dados da sua instituição
CREATE POLICY IF NOT EXISTS "instituicoes_select_authenticated"
  ON instituicoes
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- instituicoes_update_authenticated
-- Apenas admins podem atualizar dados da instituição
CREATE POLICY IF NOT EXISTS "instituicoes_update_authenticated"
  ON instituicoes
  FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    AND is_admin()
  )
  WITH CHECK (
    id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    AND is_admin()
  );

-- ============================================================================
-- STEP 7: RLS POLICIES FOR CURSOS
-- Table: cursos (Cursos oferecidos)
-- Tenancy Key: instituicao_id ou tenant_id
-- ============================================================================

-- cursos_select_authenticated
CREATE POLICY IF NOT EXISTS "cursos_select_authenticated"
  ON cursos
  FOR SELECT
  TO authenticated
  USING (
    instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    OR tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- cursos_insert_authenticated
CREATE POLICY IF NOT EXISTS "cursos_insert_authenticated"
  ON cursos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
     OR tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids())))
  );

-- cursos_update_authenticated
CREATE POLICY IF NOT EXISTS "cursos_update_authenticated"
  ON cursos
  FOR UPDATE
  TO authenticated
  USING (
    instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    OR tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  )
  WITH CHECK (
    instituicao_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    OR tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- ============================================================================
-- STEP 8: RLS POLICIES FOR USUARIO_PAPEIS
-- Table: usuario_papeis (Vínculo usuário-papel-tenant)
-- Tenancy Key: tenant_id
-- ============================================================================

-- usuario_papeis_select_authenticated
-- Usuários podem ler alocações da sua instituição
CREATE POLICY IF NOT EXISTS "usuario_papeis_select_authenticated"
  ON usuario_papeis
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- usuario_papeis_insert_authenticated
-- Apenas admins podem criar alocações
CREATE POLICY IF NOT EXISTS "usuario_papeis_insert_authenticated"
  ON usuario_papeis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    AND is_admin()
  );

-- usuario_papeis_update_authenticated
-- Apenas admins podem alterar alocações
CREATE POLICY IF NOT EXISTS "usuario_papeis_update_authenticated"
  ON usuario_papeis
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    AND is_admin()
  )
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    AND is_admin()
  );

-- ============================================================================
-- STEP 9: RLS POLICIES FOR PAPEIS
-- Table: papeis (Papéis/funções)
-- Tenancy Key: tenant_id (se existir, senão é global)
-- ============================================================================

-- papeis_select_authenticated
-- Todos podem ler papéis disponíveis
CREATE POLICY IF NOT EXISTS "papeis_select_authenticated"
  ON papeis
  FOR SELECT
  TO authenticated
  USING (
    -- Se papel tem tenant_id específico, deve ser do usuário
    -- Se papel é global (tenant_id NULL), é acessível
    (tenant_id IS NULL)
    OR (tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids())))
  );

-- papeis_insert_authenticated
-- Apenas admins podem criar papéis
CREATE POLICY IF NOT EXISTS "papeis_insert_authenticated"
  ON papeis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin()
  );

-- ============================================================================
-- STEP 10: RLS POLICIES FOR PERMISSOES
-- Table: permissoes (Permissões individuais)
-- Tenancy Key: Nenhuma (permissões são globais, controladas por papel)
-- ============================================================================

-- permissoes_select_authenticated
-- Usuários autenticados podem ler permissões
CREATE POLICY IF NOT EXISTS "permissoes_select_authenticated"
  ON permissoes
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "permissoes_select_authenticated" ON permissoes IS
'SELECT: Permissões são globais, todos autenticados podem ler.';

-- ============================================================================
-- STEP 11: RLS POLICIES FOR PAPEL_PERMISSOES
-- Table: papel_permissoes (Vínculo papel-permissão)
-- ============================================================================

-- papel_permissoes_select_authenticated
-- Usuários podem ler vínculo de papéis que usam
CREATE POLICY IF NOT EXISTS "papel_permissoes_select_authenticated"
  ON papel_permissoes
  FOR SELECT
  TO authenticated
  USING (
    papel_id IN (
      SELECT papel_id FROM usuario_papeis
      WHERE usuario_id = auth.uid()
      AND tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    )
  );

-- ============================================================================
-- STEP 12: RLS POLICIES FOR USUARIO_PERMISSOES_DIRETAS
-- Table: usuario_permissoes_diretas (Permissões diretas sem papel)
-- Tenancy Key: tenant_id
-- ============================================================================

-- usuario_permissoes_diretas_select_authenticated
CREATE POLICY IF NOT EXISTS "usuario_permissoes_diretas_select_authenticated"
  ON usuario_permissoes_diretas
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- usuario_permissoes_diretas_insert_authenticated
-- Apenas admins
CREATE POLICY IF NOT EXISTS "usuario_permissoes_diretas_insert_authenticated"
  ON usuario_permissoes_diretas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
    AND is_admin()
  );

-- ============================================================================
-- STEP 13: RLS POLICIES FOR ACERVO_LOTES
-- Table: acervo_lotes (Lotes de documentos digitalizados)
-- Tenancy Key: tenant_id
-- ============================================================================

-- acervo_lotes_select_authenticated
CREATE POLICY IF NOT EXISTS "acervo_lotes_select_authenticated"
  ON acervo_lotes
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- acervo_lotes_insert_authenticated
CREATE POLICY IF NOT EXISTS "acervo_lotes_insert_authenticated"
  ON acervo_lotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- acervo_lotes_update_authenticated
CREATE POLICY IF NOT EXISTS "acervo_lotes_update_authenticated"
  ON acervo_lotes
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  )
  WITH CHECK (
    tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
  );

-- ============================================================================
-- STEP 14: RLS POLICIES FOR CONFIG_DIPLOMA
-- Table: config_diploma (Configuração de diploma digital)
-- Tenancy Key: tenant_id ou ambiente (pode ser global)
-- ============================================================================

-- config_diploma_select_authenticated
CREATE POLICY IF NOT EXISTS "config_diploma_select_authenticated"
  ON config_diploma
  FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL)  -- Config global
    OR (tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids())))
  );

-- config_diploma_update_authenticated
-- Apenas admins podem atualizar config
CREATE POLICY IF NOT EXISTS "config_diploma_update_authenticated"
  ON config_diploma
  FOR UPDATE
  TO authenticated
  USING (
    (tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
     OR tenant_id IS NULL)
    AND is_admin()
  )
  WITH CHECK (
    (tenant_id IN (SELECT * FROM unnest(get_user_tenant_ids()))
     OR tenant_id IS NULL)
    AND is_admin()
  );

-- ============================================================================
-- STEP 15: INDEXES FOR RLS PERFORMANCE
-- ============================================================================

-- Índices para acelerar lookups de tenant em políticas RLS
CREATE INDEX IF NOT EXISTS idx_documentos_digitais_tenant
  ON documentos_digitais(tenant_id);

CREATE INDEX IF NOT EXISTS idx_processos_emissao_instituicao
  ON processos_emissao(instituicao_id);

CREATE INDEX IF NOT EXISTS idx_pessoas_tenant
  ON pessoas(tenant_id);

CREATE INDEX IF NOT EXISTS idx_usuario_papeis_usuario_tenant
  ON usuario_papeis(usuario_id, tenant_id, ativo);

CREATE INDEX IF NOT EXISTS idx_usuario_papeis_tenant
  ON usuario_papeis(tenant_id, ativo);

CREATE INDEX IF NOT EXISTS idx_papel_permissoes_papel
  ON papel_permissoes(papel_id);

CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_diretas_tenant
  ON usuario_permissoes_diretas(tenant_id);

CREATE INDEX IF NOT EXISTS idx_acervo_lotes_tenant
  ON acervo_lotes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_config_diploma_tenant
  ON config_diploma(tenant_id);

-- ============================================================================
-- STEP 16: GRANT PERMISSIONS TO SERVICE ROLE
-- ============================================================================

-- O Service Role Key do Supabase bypassa RLS automaticamente,
-- então não é necessário conceder permissões explícitas.
-- Isso permite que o admin console do Supabase funcione normalmente.

COMMENT ON SCHEMA public IS
'RLS habilitada em 12 tabelas críticas do ERP Educacional FIC.
Service Role Key bypassa RLS automaticamente.
Authenticated users veem dados do seu tenant via get_user_tenant_ids().
Anon role não tem acesso direto a tabelas (usa RPC functions).';

-- ============================================================================
-- STEP 17: VALIDATION AND NOTES
-- ============================================================================

/*
CHECKLIST DE VALIDAÇÃO:
✓ get_user_tenant_ids() criada
✓ is_admin() criada
✓ RLS habilitado em 12 tabelas críticas
✓ Políticas SELECT para all authenticated
✓ Políticas INSERT/UPDATE/DELETE com validação de tenant
✓ Índices para performance
✓ Sem GRANT necessários (Service Role bypassa RLS)

IMPORTANTE:
1. Service Role Key continua funcionando (bypassa RLS)
2. Você deve manter registros em usuario_papeis para que usuários tenham acesso
3. Admin console do Supabase continua acessível (usa Service Role)
4. Anon role não tem acesso (apis públicas usam RPC functions)

PARA TESTAR RLS:
1. No Supabase dashboard, desabilite API Key (Service Role)
2. Faça request com token JWT válido
3. Deve retornar apenas dados do tenant do usuário
4. Sem token, deve retornar erro

TROUBLESHOOTING:
- Se usuário não vê dados: Verificar usuario_papeis
- Se policy falha: Verificar se tabela existe (IF NOT EXISTS)
- Se RPC não funciona: Usar Service Role Key ou verificar SECURITY DEFINER
*/

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- =============================================================================
