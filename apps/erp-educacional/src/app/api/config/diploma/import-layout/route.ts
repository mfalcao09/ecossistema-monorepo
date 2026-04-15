import { NextRequest, NextResponse } from 'next/server'
import { protegerRota, erroInterno } from '@/lib/security/api-guard'

// Default humanas layout columns for fallback
const DEFAULT_HUMANAS_COLUMNS = [
  { id: 'codigo', label: 'Código', visivel: true, largura: 80 },
  { id: 'nome', label: 'Disciplina', visivel: true, largura: 280 },
  { id: 'periodo', label: 'Sem.', visivel: true, largura: 50 },
  { id: 'carga_horaria_aula', label: 'C.H.', visivel: true, largura: 60 },
  { id: 'nota', label: 'Nota', visivel: true, largura: 60 },
  { id: 'conceito', label: 'Conceito', visivel: false, largura: 70 },
  { id: 'situacao', label: 'Situação', visivel: true, largura: 100 },
  { id: 'docente_nome', label: 'Professor', visivel: false, largura: 200 },
]

// POST /api/config/diploma/import-layout
// FormData with 'file' field containing image or PDF
// For now: placeholder response (OCR/Vision API not configured yet)
export const POST = protegerRota(async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Campo "file" é obrigatório' },
        { status: 400 }
      )
    }

    // Validate file type
    const validMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ]
    if (!validMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não suportado. Use JPEG, PNG, WEBP ou PDF.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 5MB.' },
        { status: 400 }
      )
    }

    // TODO: Integrate with Claude Vision API to analyze uploaded transcript images
    // For now, return placeholder response with default layout
    // When Vision API is configured, parse the image/PDF to extract:
    // - Column headers and field names
    // - Visual style (colors, fonts)
    // - Layout structure (grouped/ungrouped, tabular sections)
    // - Course type (if determinable from visual cues)

    const response = {
      colunas: DEFAULT_HUMANAS_COLUMNS,
      formatacao: {
        corCabecalho: '#4A90E2',
        corAlternada: '#F8F9FA',
        corBorda: '#DDDDDD',
        fonteCabecalho: 'Georgia',
        tamanhoFonte: 11,
        regrasCondicionais: []
      },
      secoes: [
        { id: 'cabecalho', titulo: 'Dados da Instituição e do Diplomado', campos: ['aluno_nome', 'aluno_cpf', 'curso_nome', 'periodo_conclusao'] },
        { id: 'disciplinas', titulo: 'Histórico Acadêmico', tipo: 'tabela', agrupado_por: null },
        { id: 'resumo', titulo: 'Informações Gerais do Curso', campos: ['carga_horaria_total', 'media_final', 'data_conclusao'] },
      ],
      descricao: 'Layout padrão aplicado. Integração com Vision AI em breve.',
      arquivoOrigem: file.name,
      tipoArquivo: file.type,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Erro ao importar layout:', error)
    return erroInterno()
  }
}, { skipCSRF: true })
