-- =============================================================================
-- Migração: Funcionalidades (sub-itens de menu) em modulos_sistema
-- Adiciona parent_id, beta, rota ao modelo existente
-- ERP Educacional FIC — 2026-03-23
-- =============================================================================
-- INSTRUÇÕES: Execute no Supabase SQL Editor em:
-- https://supabase.com/dashboard/project/ifdnjieklngcfodmtied/sql/new
-- =============================================================================

-- 1. Adicionar colunas ao modulos_sistema existente
ALTER TABLE modulos_sistema
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES modulos_sistema(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS beta      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rota      VARCHAR(200);

-- Índice para consultas hierárquicas
CREATE INDEX IF NOT EXISTS idx_modulos_parent ON modulos_sistema(parent_id)
  WHERE parent_id IS NOT NULL;

-- 2. Inserir funcionalidades de CONFIGURAÇÕES (7 itens)
INSERT INTO modulos_sistema (slug, nome, descricao, icone, ordem, ativo, parent_id, rota, beta)
SELECT
  v.slug, v.nome, v.descricao, v.icone, v.ordem, TRUE,
  (SELECT id FROM modulos_sistema WHERE slug = 'configuracoes'),
  v.rota, v.beta
FROM (VALUES
  ('configuracoes_rbac',        'Papéis e Permissões',  'Gestão de papéis e permissões de acesso',      'Shield',         1, '/configuracoes/rbac',         FALSE),
  ('configuracoes_usuarios',    'Usuários',             'Gerenciamento de usuários do sistema',          'Users',          2, '/configuracoes/usuarios',     FALSE),
  ('configuracoes_anos',        'Anos Letivos',         'Configuração de anos e períodos letivos',       'CalendarDays',   3, '/configuracoes/anos-letivos', FALSE),
  ('configuracoes_calendarios', 'Calendário Acadêmico', 'Calendário de eventos e datas acadêmicas',      'Calendar',       4, '/configuracoes/calendarios',  FALSE),
  ('configuracoes_sistema',     'Sistema',              'Configurações gerais do sistema',               'Settings',       5, '/configuracoes/sistema',      FALSE),
  ('configuracoes_ia',          'IA e Agentes',         'Configuração de integrações de IA',             'Bot',            6, '/configuracoes/ia',           TRUE),
  ('configuracoes_assinatura',  'Assinatura Digital',   'Configuração de certificados e assinatura',     'PenTool',        7, '/configuracoes/assinatura',   FALSE)
) AS v(slug, nome, descricao, icone, ordem, rota, beta)
ON CONFLICT (slug) DO NOTHING;

-- 3. Inserir funcionalidades de DIPLOMA (5 itens)
INSERT INTO modulos_sistema (slug, nome, descricao, icone, ordem, ativo, parent_id, rota, beta)
SELECT
  v.slug, v.nome, v.descricao, v.icone, v.ordem, TRUE,
  (SELECT id FROM modulos_sistema WHERE slug = 'diploma'),
  v.rota, v.beta
FROM (VALUES
  ('diploma_dashboard',  'Dashboard',         'Visão geral dos processos de diplomação',  'LayoutDashboard', 1, '/diploma',             FALSE),
  ('diploma_processos',  'Processos',         'Gestão de processos de diplomação',        'ClipboardList',   2, '/diploma/processos',   FALSE),
  ('diploma_diplomados', 'Diplomados',        'Cadastro e consulta de diplomados',        'GraduationCap',   3, '/diploma/diplomados',  FALSE),
  ('diploma_assinantes', 'Assinantes',        'Gestão de assinantes e signatários',       'PenLine',         4, '/diploma/assinantes',  FALSE),
  ('diploma_migracao',   'Migração (Legado)', 'Importação de diplomas legados',           'Database',        5, '/diploma/migracao',    TRUE)
) AS v(slug, nome, descricao, icone, ordem, rota, beta)
ON CONFLICT (slug) DO NOTHING;

-- 4. Inserir funcionalidades de ACERVO (5 itens)
INSERT INTO modulos_sistema (slug, nome, descricao, icone, ordem, ativo, parent_id, rota, beta)
SELECT
  v.slug, v.nome, v.descricao, v.icone, v.ordem, TRUE,
  (SELECT id FROM modulos_sistema WHERE slug = 'acervo'),
  v.rota, v.beta
FROM (VALUES
  ('acervo_documentos',  'Documentos',       'Consulta e gestão do acervo digital',    'FileText',  1, '/acervo/documentos',   FALSE),
  ('acervo_digitalizar', 'Digitalizar',      'Digitalização de documentos físicos',    'ScanLine',  2, '/acervo/digitalizar',  FALSE),
  ('acervo_templates',   'Templates',        'Modelos de documentos institucionais',   'FileCode',  3, '/acervo/templates',    FALSE),
  ('acervo_emitir',      'Emitir Documento', 'Emissão de documentos digitais',         'FilePlus',  4, '/acervo/emitir',       TRUE),
  ('acervo_mec',         'Integração MEC',   'Envio e consulta no portal do MEC',      'Globe',     5, '/acervo/mec',          TRUE)
) AS v(slug, nome, descricao, icone, ordem, rota, beta)
ON CONFLICT (slug) DO NOTHING;

-- 5. Inserir funcionalidades de CADASTRO (3 itens)
INSERT INTO modulos_sistema (slug, nome, descricao, icone, ordem, ativo, parent_id, rota, beta)
SELECT
  v.slug, v.nome, v.descricao, v.icone, v.ordem, TRUE,
  (SELECT id FROM modulos_sistema WHERE slug = 'cadastro'),
  v.rota, v.beta
FROM (VALUES
  ('cadastro_ies',           'Instituição de Ensino', 'Dados e configuração da IES',          'Building2', 1, '/cadastro/ies',           FALSE),
  ('cadastro_departamentos', 'Departamentos',         'Gestão de departamentos e faculdades',  'Layers',    2, '/cadastro/departamentos', FALSE),
  ('cadastro_cursos',        'Cursos',                'Cadastro e gestão de cursos',           'BookOpen',  3, '/cadastro/cursos',        FALSE)
) AS v(slug, nome, descricao, icone, ordem, rota, beta)
ON CONFLICT (slug) DO NOTHING;

-- 6. Inserir funcionalidades de PESSOAS (2 itens)
INSERT INTO modulos_sistema (slug, nome, descricao, icone, ordem, ativo, parent_id, rota, beta)
SELECT
  v.slug, v.nome, v.descricao, v.icone, v.ordem, TRUE,
  (SELECT id FROM modulos_sistema WHERE slug = 'pessoas'),
  v.rota, v.beta
FROM (VALUES
  ('pessoas_lista', 'Lista de Pessoas', 'Consulta e gestão de pessoas cadastradas', 'Users',    1, '/pessoas',      FALSE),
  ('pessoas_novo',  'Novo Cadastro',    'Cadastro de nova pessoa no sistema',        'UserPlus', 2, '/pessoas/novo', FALSE)
) AS v(slug, nome, descricao, icone, ordem, rota, beta)
ON CONFLICT (slug) DO NOTHING;

-- 7. Criar permissões para todas as funcionalidades inseridas
INSERT INTO permissoes (modulo_id, acao)
SELECT ms.id, acao.acao
FROM modulos_sistema ms
CROSS JOIN (VALUES ('acessar'),('inserir'),('alterar'),('remover'),('especial')) AS acao(acao)
WHERE ms.parent_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 8. Vincular todas as novas permissões ao papel Administradores da Instituição
INSERT INTO papel_permissoes (papel_id, permissao_id)
SELECT
  (SELECT id FROM papeis WHERE nome = 'Administradores da Instituição' LIMIT 1),
  p.id
FROM permissoes p
JOIN modulos_sistema ms ON ms.id = p.modulo_id
WHERE ms.parent_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 9. Verificar resultado
SELECT
  m.slug,
  m.nome,
  m.beta,
  m.rota,
  p.nome AS modulo_pai
FROM modulos_sistema m
LEFT JOIN modulos_sistema p ON p.id = m.parent_id
ORDER BY p.ordem NULLS FIRST, m.ordem;
