// ============================================================
// GERADOR DE PDFs — Documentos Complementares do Diploma
// Usa pdf-lib (serverless-friendly, sem Puppeteer)
//
// Documentos gerados:
// 1. Histórico Escolar (PDF)
// 2. Termo de Expedição
// 3. Termo de Responsabilidade Técnica
// ============================================================

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, PageSizes } from 'pdf-lib'

// ── Tipos de input ──────────────────────────────────────────

export interface DadosHistoricoPDF {
  // Diplomado
  nome: string
  nome_social?: string | null
  cpf: string
  rg?: string | null
  rg_orgao?: string | null
  rg_uf?: string | null
  data_nascimento?: string | null
  sexo?: string | null
  nacionalidade?: string | null
  naturalidade?: string | null
  naturalidade_uf?: string | null

  // Curso
  curso_nome: string
  grau: string
  titulo_conferido?: string | null
  modalidade?: string | null
  turno?: string | null
  carga_horaria_total?: number | null

  // IES
  ies_nome: string
  ies_cnpj?: string | null
  ies_municipio?: string | null
  ies_uf?: string | null
  mantenedora_nome?: string | null
  ato_reconhecimento?: string | null

  // Datas
  data_ingresso?: string | null
  data_conclusao?: string | null
  data_colacao?: string | null
  forma_acesso?: string | null
  periodo_letivo?: string | null
  situacao_aluno?: string

  // Disciplinas
  disciplinas: DisciplinaPDF[]

  // Estágios
  estagios?: EstagioPDF[]

  // Atividades complementares
  atividades_complementares?: AtividadePDF[]

  // ENADE
  enade_situacao?: string | null

  // Assinantes
  assinantes: AssinantePDF[]
}

export interface DisciplinaPDF {
  codigo?: string | null
  nome: string
  periodo?: string | null
  carga_horaria_aula?: number | null
  carga_horaria_relogio?: number | null
  nota?: number | null
  conceito?: string | null
  situacao: string
  forma_integralizacao?: string | null
  docente_nome?: string | null
  docente_titulacao?: string | null
}

export interface EstagioPDF {
  nome?: string | null
  carga_horaria?: number | null
  data_inicio?: string | null
  data_fim?: string | null
}

export interface AtividadePDF {
  nome?: string | null
  carga_horaria?: number | null
}

export interface AssinantePDF {
  nome: string
  cargo: string
  cpf?: string | null
}

export interface DadosTermoExpedicao {
  nome_diplomado: string
  cpf_diplomado: string
  curso_nome: string
  grau: string
  titulo_conferido?: string | null
  data_colacao?: string | null
  data_conclusao?: string | null
  data_expedicao: string
  numero_registro?: string | null
  livro?: string | null
  pagina?: string | null
  ies_nome: string
  ies_municipio?: string | null
  ies_uf?: string | null
  assinantes: AssinantePDF[]
}

export interface DadosTermoResponsabilidade {
  ies_nome: string
  ies_cnpj?: string | null
  ies_municipio?: string | null
  ies_uf?: string | null
  responsavel_nome: string
  responsavel_cargo: string
  responsavel_cpf?: string | null
  data_emissao: string
  assinantes: AssinantePDF[]
}

// ── Helpers ─────────────────────────────────────────────────

function formatarCPF(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return cpf
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`
}

function formatarData(data: string | null | undefined): string {
  if (!data) return '—'
  try {
    return new Date(data).toLocaleDateString('pt-BR')
  } catch {
    return data
  }
}

function formatarDataExtenso(data: string | null | undefined): string {
  if (!data) return '—'
  try {
    const d = new Date(data)
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return data
  }
}

// ── Constantes de layout ────────────────────────────────────

const MARGEM = 50
const LARGURA_UTIL = PageSizes.A4[0] - MARGEM * 2
const COR_TITULO = rgb(0.12, 0.12, 0.45)   // Azul escuro
const COR_TEXTO = rgb(0.15, 0.15, 0.15)     // Quase preto
const COR_CINZA = rgb(0.5, 0.5, 0.5)
const COR_LINHA = rgb(0.85, 0.85, 0.85)

// ── Helper para quebrar texto em linhas ─────────────────────

function quebrarTexto(texto: string, font: PDFFont, tamanho: number, larguraMax: number): string[] {
  const palavras = texto.split(' ')
  const linhas: string[] = []
  let linhaAtual = ''

  for (const palavra of palavras) {
    const teste = linhaAtual ? `${linhaAtual} ${palavra}` : palavra
    const largura = font.widthOfTextAtSize(teste, tamanho)
    if (largura > larguraMax && linhaAtual) {
      linhas.push(linhaAtual)
      linhaAtual = palavra
    } else {
      linhaAtual = teste
    }
  }
  if (linhaAtual) linhas.push(linhaAtual)
  return linhas
}

// ── Classe geradora ─────────────────────────────────────────

class PDFBuilder {
  private doc!: PDFDocument
  private page!: PDFPage
  private y: number = 0
  private fontRegular!: PDFFont
  private fontBold!: PDFFont
  private pageNum: number = 0

  async init(): Promise<void> {
    this.doc = await PDFDocument.create()
    this.doc.setTitle('Documento FIC')
    this.doc.setProducer('FIC ERP Educacional')
    this.fontRegular = await this.doc.embedFont(StandardFonts.Helvetica)
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold)
    this.novaPage()
  }

  private novaPage(): PDFPage {
    this.page = this.doc.addPage(PageSizes.A4)
    this.y = this.page.getHeight() - MARGEM
    this.pageNum++
    return this.page
  }

  private verificarEspaco(necessario: number): void {
    if (this.y - necessario < MARGEM + 30) {
      this.novaPage()
    }
  }

  titulo(texto: string, tamanho: number = 14): void {
    this.verificarEspaco(tamanho + 10)
    this.page.drawText(texto, {
      x: MARGEM,
      y: this.y,
      size: tamanho,
      font: this.fontBold,
      color: COR_TITULO,
    })
    this.y -= tamanho + 8
  }

  subtitulo(texto: string, tamanho: number = 10): void {
    this.verificarEspaco(tamanho + 8)
    this.page.drawText(texto, {
      x: MARGEM,
      y: this.y,
      size: tamanho,
      font: this.fontBold,
      color: COR_TEXTO,
    })
    this.y -= tamanho + 6
  }

  texto(texto: string, tamanho: number = 9, indent: number = 0): void {
    const linhas = quebrarTexto(texto, this.fontRegular, tamanho, LARGURA_UTIL - indent)
    for (const linha of linhas) {
      this.verificarEspaco(tamanho + 4)
      this.page.drawText(linha, {
        x: MARGEM + indent,
        y: this.y,
        size: tamanho,
        font: this.fontRegular,
        color: COR_TEXTO,
      })
      this.y -= tamanho + 3
    }
  }

  textoBold(texto: string, tamanho: number = 9, indent: number = 0): void {
    const linhas = quebrarTexto(texto, this.fontBold, tamanho, LARGURA_UTIL - indent)
    for (const linha of linhas) {
      this.verificarEspaco(tamanho + 4)
      this.page.drawText(linha, {
        x: MARGEM + indent,
        y: this.y,
        size: tamanho,
        font: this.fontBold,
        color: COR_TEXTO,
      })
      this.y -= tamanho + 3
    }
  }

  campo(label: string, valor: string, tamanho: number = 9): void {
    this.verificarEspaco(tamanho + 4)
    const labelWidth = this.fontBold.widthOfTextAtSize(label + ': ', tamanho)
    this.page.drawText(label + ': ', {
      x: MARGEM,
      y: this.y,
      size: tamanho,
      font: this.fontBold,
      color: COR_CINZA,
    })
    // Texto do valor pode precisar quebrar
    const valorLinhas = quebrarTexto(valor, this.fontRegular, tamanho, LARGURA_UTIL - labelWidth)
    for (let i = 0; i < valorLinhas.length; i++) {
      if (i > 0) {
        this.y -= tamanho + 3
        this.verificarEspaco(tamanho + 4)
      }
      this.page.drawText(valorLinhas[i], {
        x: MARGEM + (i === 0 ? labelWidth : 0),
        y: this.y,
        size: tamanho,
        font: this.fontRegular,
        color: COR_TEXTO,
      })
    }
    this.y -= tamanho + 4
  }

  linhaHorizontal(): void {
    this.verificarEspaco(8)
    this.page.drawLine({
      start: { x: MARGEM, y: this.y },
      end: { x: MARGEM + LARGURA_UTIL, y: this.y },
      thickness: 0.5,
      color: COR_LINHA,
    })
    this.y -= 8
  }

  espacamento(px: number = 10): void {
    this.y -= px
  }

  // Tabela simples
  tabela(headers: string[], linhas: string[][], colWidths: number[]): void {
    const rowHeight = 14
    const fontSize = 7.5

    // Header
    this.verificarEspaco(rowHeight + 4)
    let x = MARGEM
    for (let col = 0; col < headers.length; col++) {
      this.page.drawText(headers[col], {
        x: x + 2,
        y: this.y,
        size: fontSize,
        font: this.fontBold,
        color: COR_TITULO,
      })
      x += colWidths[col]
    }
    this.y -= rowHeight
    this.linhaHorizontal()

    // Linhas
    for (const linha of linhas) {
      this.verificarEspaco(rowHeight + 2)
      x = MARGEM
      for (let col = 0; col < linha.length; col++) {
        const txt = linha[col] || '—'
        // Truncar se não cabe
        let txtFinal = txt
        while (this.fontRegular.widthOfTextAtSize(txtFinal, fontSize) > colWidths[col] - 4 && txtFinal.length > 3) {
          txtFinal = txtFinal.slice(0, -4) + '...'
        }
        this.page.drawText(txtFinal, {
          x: x + 2,
          y: this.y,
          size: fontSize,
          font: this.fontRegular,
          color: COR_TEXTO,
        })
        x += colWidths[col]
      }
      this.y -= rowHeight
    }
  }

  assinaturas(assinantes: AssinantePDF[]): void {
    this.espacamento(30)
    const larguraPorAssinante = LARGURA_UTIL / Math.max(assinantes.length, 1)

    this.verificarEspaco(60)
    for (let i = 0; i < assinantes.length; i++) {
      const centroX = MARGEM + (larguraPorAssinante * i) + (larguraPorAssinante / 2)

      // Linha de assinatura
      this.page.drawLine({
        start: { x: centroX - 80, y: this.y },
        end: { x: centroX + 80, y: this.y },
        thickness: 0.5,
        color: COR_TEXTO,
      })

      // Nome
      const nomeW = this.fontBold.widthOfTextAtSize(assinantes[i].nome, 8)
      this.page.drawText(assinantes[i].nome, {
        x: centroX - nomeW / 2,
        y: this.y - 12,
        size: 8,
        font: this.fontBold,
        color: COR_TEXTO,
      })

      // Cargo
      const cargoW = this.fontRegular.widthOfTextAtSize(assinantes[i].cargo, 7)
      this.page.drawText(assinantes[i].cargo, {
        x: centroX - cargoW / 2,
        y: this.y - 22,
        size: 7,
        font: this.fontRegular,
        color: COR_CINZA,
      })
    }
    this.y -= 40
  }

  async salvar(): Promise<Uint8Array> {
    return this.doc.save()
  }
}

// ═════════════════════════════════════════════════════════════
// 1. HISTÓRICO ESCOLAR (PDF)
// ═════════════════════════════════════════════════════════════

export async function gerarHistoricoEscolarPDF(dados: DadosHistoricoPDF): Promise<Uint8Array> {
  const pdf = new PDFBuilder()
  await pdf.init()

  // ── Cabeçalho ──
  pdf.titulo(dados.ies_nome.toUpperCase(), 12)
  if (dados.mantenedora_nome) {
    pdf.texto(`Mantida por: ${dados.mantenedora_nome}`, 8)
  }
  pdf.texto(`CNPJ: ${dados.ies_cnpj ?? '—'} — ${dados.ies_municipio ?? ''}/${dados.ies_uf ?? ''}`, 8)
  pdf.espacamento(5)
  pdf.titulo('HISTÓRICO ESCOLAR', 14)
  pdf.linhaHorizontal()

  // ── Dados do aluno ──
  pdf.subtitulo('DADOS DO DIPLOMADO')
  pdf.campo('Nome', dados.nome_social ?? dados.nome)
  if (dados.nome_social) pdf.campo('Nome de Registro', dados.nome)
  pdf.campo('CPF', formatarCPF(dados.cpf))
  if (dados.rg) pdf.campo('RG', `${dados.rg} ${dados.rg_orgao ?? ''}/${dados.rg_uf ?? ''}`)
  pdf.campo('Data de Nascimento', formatarData(dados.data_nascimento))
  pdf.campo('Sexo', dados.sexo === 'M' ? 'Masculino' : dados.sexo === 'F' ? 'Feminino' : '—')
  pdf.campo('Nacionalidade', dados.nacionalidade ?? '—')
  pdf.campo('Naturalidade', dados.naturalidade ? `${dados.naturalidade}/${dados.naturalidade_uf ?? ''}` : '—')
  pdf.linhaHorizontal()

  // ── Dados do curso ──
  pdf.subtitulo('DADOS DO CURSO')
  pdf.campo('Curso', dados.curso_nome)
  pdf.campo('Grau', dados.grau)
  if (dados.titulo_conferido) pdf.campo('Título Conferido', dados.titulo_conferido)
  pdf.campo('Modalidade', dados.modalidade ?? '—')
  if (dados.turno) pdf.campo('Turno', dados.turno)
  if (dados.carga_horaria_total) pdf.campo('Carga Horária Total', `${dados.carga_horaria_total}h`)
  if (dados.ato_reconhecimento) pdf.campo('Reconhecimento', dados.ato_reconhecimento)
  pdf.campo('Forma de Acesso', dados.forma_acesso ?? '—')
  pdf.campo('Data de Ingresso', formatarData(dados.data_ingresso))
  pdf.campo('Data de Conclusão', formatarData(dados.data_conclusao))
  pdf.campo('Data de Colação', formatarData(dados.data_colacao))
  pdf.campo('Situação', dados.situacao_aluno ?? 'Formado')
  pdf.linhaHorizontal()

  // ── Disciplinas ──
  pdf.subtitulo('COMPONENTES CURRICULARES')
  pdf.espacamento(4)

  if (dados.disciplinas.length > 0) {
    const headers = ['Cód', 'Disciplina', 'Per.', 'CH (h/a)', 'CH (h/r)', 'Nota', 'Situação']
    const colWidths = [35, 180, 30, 45, 45, 35, 55]
    const linhas = dados.disciplinas.map(d => [
      d.codigo ?? '—',
      d.nome,
      d.periodo ?? '—',
      d.carga_horaria_aula?.toString() ?? '—',
      d.carga_horaria_relogio?.toString() ?? '—',
      d.nota?.toFixed(1) ?? d.conceito ?? '—',
      d.situacao,
    ])
    pdf.tabela(headers, linhas, colWidths)
  } else {
    pdf.texto('Nenhuma disciplina registrada.', 9)
  }

  // ── Estágios ──
  if (dados.estagios && dados.estagios.length > 0) {
    pdf.espacamento(10)
    pdf.subtitulo('ESTÁGIOS SUPERVISIONADOS')
    for (const est of dados.estagios) {
      pdf.texto(`• ${est.nome ?? 'Estágio'} — ${est.carga_horaria ?? '?'}h (${formatarData(est.data_inicio)} a ${formatarData(est.data_fim)})`, 8)
    }
  }

  // ── Atividades complementares ──
  if (dados.atividades_complementares && dados.atividades_complementares.length > 0) {
    pdf.espacamento(10)
    pdf.subtitulo('ATIVIDADES COMPLEMENTARES')
    for (const ativ of dados.atividades_complementares) {
      pdf.texto(`• ${ativ.nome ?? 'Atividade'} — ${ativ.carga_horaria ?? '?'}h`, 8)
    }
  }

  // ── ENADE ──
  pdf.espacamento(10)
  pdf.subtitulo('ENADE')
  pdf.campo('Situação ENADE', dados.enade_situacao ?? 'Não informado')

  // ── Assinaturas ──
  pdf.linhaHorizontal()
  pdf.assinaturas(dados.assinantes)

  return pdf.salvar()
}

// ═════════════════════════════════════════════════════════════
// 2. TERMO DE EXPEDIÇÃO
// ═════════════════════════════════════════════════════════════

export async function gerarTermoExpedicaoPDF(dados: DadosTermoExpedicao): Promise<Uint8Array> {
  const pdf = new PDFBuilder()
  await pdf.init()

  pdf.titulo(dados.ies_nome.toUpperCase(), 12)
  pdf.espacamento(10)
  pdf.titulo('TERMO DE EXPEDIÇÃO DE DIPLOMA', 14)
  pdf.linhaHorizontal()
  pdf.espacamento(10)

  const corpo = [
    `A ${dados.ies_nome}, com sede em ${dados.ies_municipio ?? '—'}/${dados.ies_uf ?? '—'}, `,
    `no uso de suas atribuições legais, confere o diploma de ${dados.grau} em ${dados.curso_nome}`,
    dados.titulo_conferido ? `, com o título de ${dados.titulo_conferido},` : ',',
    ` a ${dados.nome_diplomado}, portador(a) do CPF nº ${formatarCPF(dados.cpf_diplomado)},`,
    ` tendo concluído o curso em ${formatarDataExtenso(dados.data_conclusao)}`,
    dados.data_colacao ? ` e colado grau em ${formatarDataExtenso(dados.data_colacao)}` : '',
    '.',
  ].join('')

  pdf.texto(corpo, 10)
  pdf.espacamento(10)

  if (dados.numero_registro) {
    pdf.texto(
      `Registrado sob o nº ${dados.numero_registro}${dados.livro ? `, ${dados.livro}` : ''}${dados.pagina ? `, ${dados.pagina}` : ''}.`,
      10
    )
    pdf.espacamento(5)
  }

  pdf.texto(
    `Expedido em ${formatarDataExtenso(dados.data_expedicao)}.`,
    10
  )

  pdf.espacamento(10)
  pdf.texto(
    `${dados.ies_municipio ?? '—'}/${dados.ies_uf ?? '—'}, ${formatarDataExtenso(dados.data_expedicao)}.`,
    10
  )

  pdf.linhaHorizontal()
  pdf.assinaturas(dados.assinantes)

  return pdf.salvar()
}

// ═════════════════════════════════════════════════════════════
// 3. TERMO DE RESPONSABILIDADE TÉCNICA
// ═════════════════════════════════════════════════════════════

export async function gerarTermoResponsabilidadePDF(dados: DadosTermoResponsabilidade): Promise<Uint8Array> {
  const pdf = new PDFBuilder()
  await pdf.init()

  pdf.titulo(dados.ies_nome.toUpperCase(), 12)
  pdf.espacamento(10)
  pdf.titulo('TERMO DE RESPONSABILIDADE TÉCNICA', 14)
  pdf.texto('(Portaria MEC nº 554/2019, art. 5º, §2º)', 8)
  pdf.linhaHorizontal()
  pdf.espacamento(10)

  const corpo = [
    `Eu, ${dados.responsavel_nome}, ${dados.responsavel_cargo} da ${dados.ies_nome}`,
    dados.ies_cnpj ? ` (CNPJ ${dados.ies_cnpj})` : '',
    `, com sede em ${dados.ies_municipio ?? '—'}/${dados.ies_uf ?? '—'}, `,
    `DECLARO, para os devidos fins e sob as penas da lei, que:`,
  ].join('')

  pdf.texto(corpo, 10)
  pdf.espacamento(10)

  const itens = [
    'Os dados constantes nos documentos digitais gerados por esta Instituição de Ensino Superior são fidedignos e correspondem integralmente aos registros acadêmicos mantidos por esta IES;',
    'Os procedimentos de geração, assinatura digital e preservação dos documentos seguem as normas técnicas estabelecidas pela Portaria MEC nº 554/2019 e Instrução Normativa SESU/MEC nº 1/2020;',
    'Os certificados digitais utilizados nas assinaturas são do tipo ICP-Brasil A3, conforme exigência legal;',
    'A IES mantém infraestrutura adequada para a preservação e verificação dos diplomas digitais emitidos, incluindo repositório público acessível via HTTPS;',
    'Assumo inteira responsabilidade pela veracidade das informações contidas nos diplomas digitais emitidos sob minha supervisão.',
  ]

  for (let i = 0; i < itens.length; i++) {
    pdf.texto(`${i + 1}. ${itens[i]}`, 9, 10)
    pdf.espacamento(4)
  }

  pdf.espacamento(10)
  pdf.texto(
    `${dados.ies_municipio ?? '—'}/${dados.ies_uf ?? '—'}, ${formatarDataExtenso(dados.data_emissao)}.`,
    10
  )

  pdf.linhaHorizontal()
  pdf.assinaturas(dados.assinantes)

  return pdf.salvar()
}
