import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { protegerRota, erroInterno } from '@/lib/security/api-guard'

// Fallback templates in case the table doesn't exist or query fails
const FALLBACK_TEMPLATES = [
  {
    id: '1',
    slug: 'humanas',
    nome: 'Humanas & Sociais',
    descricao: 'Direito, Administração, Pedagogia',
    area_conhecimento: 'humanas',
    icone: '📚',
    is_default: true,
    formato_nota: 'nota_0_10',
    cor_cabecalho: '#1A3A6B',
    colunas_config: [
      { campo: 'codigo', label: 'Código', visivel: true, ordem: 1, largura: 8 },
      { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 30 },
      { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 8 },
      { campo: 'nota', label: 'Média', visivel: true, ordem: 4, largura: 8 },
      { campo: 'periodo', label: 'P/Letivo', visivel: true, ordem: 5, largura: 8 },
      { campo: 'situacao', label: 'Sit. Fin.', visivel: true, ordem: 6, largura: 10 },
    ],
    secoes_config: {
      agrupar_por: 'periodo',
      formato_cabecalho_grupo: '{numero}º Período',
      exibir_subtotal_ch: true,
      separador_visual: 'linha',
    },
  },
  {
    id: '2',
    slug: 'saude',
    nome: 'Saúde',
    descricao: 'Medicina, Enfermagem — conceitos',
    area_conhecimento: 'saude',
    icone: '🏥',
    is_default: false,
    formato_nota: 'conceito',
    cor_cabecalho: '#0F766E',
    colunas_config: [
      { campo: 'codigo', label: 'Código', visivel: true, ordem: 1, largura: 8 },
      { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 28 },
      { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 7 },
      { campo: 'conceito_especifico', label: 'Conceito', visivel: true, ordem: 4, largura: 10 },
      { campo: 'periodo', label: 'P/Letivo', visivel: true, ordem: 5, largura: 7 },
      { campo: 'situacao', label: 'Sit. Fin.', visivel: true, ordem: 6, largura: 9 },
      { campo: 'etiqueta', label: 'Obs.', visivel: true, ordem: 7, largura: 8 },
    ],
    secoes_config: {
      agrupar_por: 'etiqueta',
      formato_cabecalho_grupo: 'UNIDADE DE APRENDIZAGEM: {valor}',
      exibir_subtotal_ch: true,
      separador_visual: 'destaque',
    },
  },
  {
    id: '3',
    slug: 'exatas',
    nome: 'Exatas & Engenharias',
    descricao: 'Notas numéricas, pré-requisitos',
    area_conhecimento: 'exatas',
    icone: '⚙️',
    is_default: false,
    formato_nota: 'nota_0_10',
    cor_cabecalho: '#1E40AF',
    colunas_config: [
      { campo: 'codigo', label: 'Cód.', visivel: true, ordem: 1, largura: 7 },
      { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 28 },
      { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 7 },
      { campo: 'nota', label: 'Nota', visivel: true, ordem: 4, largura: 7 },
      { campo: 'periodo', label: 'Sem.', visivel: true, ordem: 5, largura: 7 },
      { campo: 'situacao', label: 'Situação', visivel: true, ordem: 6, largura: 9 },
      { campo: 'forma_integralizacao', label: 'Forma', visivel: true, ordem: 7, largura: 10 },
    ],
    secoes_config: {
      agrupar_por: 'periodo',
      formato_cabecalho_grupo: '{numero}º Semestre',
      exibir_subtotal_ch: true,
      separador_visual: 'linha',
    },
  },
  {
    id: '4',
    slug: 'licenciatura',
    nome: 'Licenciaturas',
    descricao: 'Estágio destacado, docentes',
    area_conhecimento: 'licenciatura',
    icone: '🎓',
    is_default: false,
    formato_nota: 'nota_0_10',
    cor_cabecalho: '#7C3AED',
    colunas_config: [
      { campo: 'codigo', label: 'Código', visivel: true, ordem: 1, largura: 8 },
      { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 28 },
      { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 7 },
      { campo: 'nota', label: 'Média', visivel: true, ordem: 4, largura: 7 },
      { campo: 'periodo', label: 'Período', visivel: true, ordem: 5, largura: 7 },
      { campo: 'situacao', label: 'Situação', visivel: true, ordem: 6, largura: 9 },
      { campo: 'docente_nome', label: 'Docente', visivel: true, ordem: 7, largura: 15 },
    ],
    secoes_config: {
      agrupar_por: 'periodo',
      formato_cabecalho_grupo: '{numero}º Período',
      exibir_subtotal_ch: true,
      separador_visual: 'linha',
    },
  },
  {
    id: '5',
    slug: 'tecnologo',
    nome: 'Tecnólogos',
    descricao: 'Formato compacto, módulos',
    area_conhecimento: 'tecnologo',
    icone: '💻',
    is_default: false,
    formato_nota: 'nota_0_10',
    cor_cabecalho: '#059669',
    colunas_config: [
      { campo: 'codigo', label: 'Cód.', visivel: true, ordem: 1, largura: 7 },
      { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 32 },
      { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 7 },
      { campo: 'nota', label: 'Nota', visivel: true, ordem: 4, largura: 7 },
      { campo: 'situacao', label: 'Sit.', visivel: true, ordem: 5, largura: 8 },
      { campo: 'periodo', label: 'Mod.', visivel: true, ordem: 6, largura: 7 },
    ],
    secoes_config: {
      agrupar_por: 'periodo',
      formato_cabecalho_grupo: 'Módulo {numero}',
      exibir_subtotal_ch: true,
      separador_visual: 'linha',
    },
  },
]

// GET /api/config/diploma/templates
// Returns available transcript templates, ordered by is_default DESC, nome ASC
export const GET = protegerRota(
  async (request: NextRequest) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('historico_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('nome', { ascending: true })

    // If query fails or table doesn't exist, return fallback templates
    if (error) {
      console.warn('[API] Erro ao buscar historico_templates, usando fallback:', error.message)
      return NextResponse.json(FALLBACK_TEMPLATES)
    }

    // If no data returned, return fallback templates
    if (!data || data.length === 0) {
      console.info('[API] Nenhum template encontrado, usando fallback')
      return NextResponse.json(FALLBACK_TEMPLATES)
    }

    return NextResponse.json(data)
  },
  { skipCSRF: true }
)
