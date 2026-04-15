// =============================================================================
// montar-variaveis-rvdd.ts — Transformador DiplomaCompleto → VariaveisRVDD
//
// Pega o objeto completo (9 tabelas) e "achata" em variáveis planas
// que serão injetadas no template HTML/PDF da RVDD.
//
// Convenção das variáveis: snake_case, sem prefixo de tabela.
// Exemplo de uso no template:  {{nome}}, {{titulo_conferido}}, {{data_colacao}}
// =============================================================================

import type { DiplomaCompleto, VariaveisRVDD } from '@/types/diplomas'

// =============================================================================
// FUNÇÃO PRINCIPAL
// =============================================================================

/**
 * Transforma um DiplomaCompleto nas variáveis planas para o template RVDD.
 *
 * @param completo Objeto retornado por buscarDiplomaCompleto()
 * @param configIes Configurações da IES (nome, CNPJ, etc.) — vem de diploma_config
 * @throws Error se dados obrigatórios estiverem ausentes
 */
export function montarVariaveisRVDD(
  completo: DiplomaCompleto,
  configIes: ConfigIesParaRVDD
): VariaveisRVDD {
  const { diploma, diplomado, curso, assinantes, fluxo_assinaturas } = completo

  // ── Validações básicas ──────────────────────────────────────────────────────
  if (!diplomado) throw new Error('Diplomado não encontrado para este diploma')
  if (!curso)     throw new Error('Curso não encontrado para este diploma')
  if (!diploma.codigo_validacao) throw new Error('Diploma sem código de validação')

  // ── Título conferido ─────────────────────────────────────────────────────────
  // Prioridade: campo específico do diploma > padrão do curso
  const tituloConferido =
    diploma.titulo_conferido ??
    curso.titulo_conferido ??
    `${formatarGrau(curso.grau)} em ${curso.nome}`

  // ── Carga horária ─────────────────────────────────────────────────────────────
  // Prioridade: CH integralizada pelo aluno > CH total do curso
  const cargaHoraria =
    diploma.carga_horaria_integralizada ??
    curso.carga_horaria_total ??
    0

  // ── Ato de reconhecimento ────────────────────────────────────────────────────
  const atoReconhecimento = montarAtoReconhecimento(curso)

  // ── URL de verificação ───────────────────────────────────────────────────────
  const urlVerificacao =
    diploma.url_verificacao ??
    `${configIes.url_portal}/verificar/${diploma.codigo_validacao}`

  // ── Signatários (apenas os que já assinaram, em ordem) ──────────────────────
  const signatariosOrdenados = fluxo_assinaturas
    .filter(f => f.status === 'assinado')
    .sort((a, b) => a.ordem - b.ordem)
    .map(f => {
      const assinante = assinantes.find(a => a.id === f.assinante_id)
      return {
        nome: assinante?.nome ?? 'Não identificado',
        cargo: formatarCargo(assinante?.cargo ?? '', assinante?.outro_cargo ?? null),
        cpf: assinante?.cpf ?? null,
      }
    })
    .filter(s => s.nome !== 'Não identificado')

  // ── Livro de registro ─────────────────────────────────────────────────────────
  const livroFormatado = diploma.livro_registro_id
    ? `Livro ${diploma.livro_registro_id}`
    : null
  const paginaFormatada = diploma.pagina_registro
    ? `Folha ${diploma.pagina_registro}`
    : null

  return {
    // ── Diplomado ────────────────────────────────────────────────────────────
    nome:             diplomado.nome,
    nome_social:      diplomado.nome_social ?? null,
    cpf:              formatarCPF(diplomado.cpf),
    data_nascimento:  diplomado.data_nascimento
                        ? formatarDataExtenso(diplomado.data_nascimento)
                        : '',
    naturalidade:     montarNaturalidade(diplomado),
    nacionalidade:    formatarNacionalidade(diplomado.nacionalidade ?? 'Brasileiro'),
    rg:               montarRG(diplomado),

    // ── Curso ────────────────────────────────────────────────────────────────
    curso_nome:       curso.nome,
    titulo_conferido: tituloConferido,
    grau:             formatarGrau(curso.grau),
    modalidade:       formatarModalidade(diploma.modalidade ?? curso.modalidade ?? 'presencial'),
    turno:            diploma.turno ? formatarTurno(diploma.turno) : null,
    carga_horaria:    cargaHoraria,
    codigo_emec:      curso.codigo_emec ?? null,
    ato_reconhecimento: atoReconhecimento,

    // ── Datas ────────────────────────────────────────────────────────────────
    data_ingresso:    diploma.data_ingresso
                        ? formatarDataExtenso(diploma.data_ingresso)
                        : null,
    data_conclusao:   diploma.data_conclusao
                        ? formatarDataExtenso(diploma.data_conclusao)
                        : null,
    data_colacao:     diploma.data_colacao_grau
                        ? formatarDataExtenso(diploma.data_colacao_grau)
                        : '',
    municipio_colacao: diploma.municipio_colacao ?? configIes.municipio ?? null,
    uf_colacao:        diploma.uf_colacao ?? configIes.uf ?? null,
    data_expedicao:   diploma.data_expedicao
                        ? formatarDataExtenso(diploma.data_expedicao)
                        : '',

    // ── Registro ─────────────────────────────────────────────────────────────
    numero_registro:  diploma.numero_registro ?? null,
    livro:            livroFormatado,
    pagina:           paginaFormatada,
    data_registro:    diploma.data_registro
                        ? formatarDataExtenso(diploma.data_registro)
                        : null,

    // ── Verificação ──────────────────────────────────────────────────────────
    codigo_validacao: diploma.codigo_validacao,
    url_verificacao:  urlVerificacao,
    qrcode_url:       diploma.qrcode_url ?? null,

    // ── IES ──────────────────────────────────────────────────────────────────
    ies_nome:     configIes.nome,
    ies_sigla:    configIes.sigla ?? null,
    ies_cnpj:     formatarCNPJ(configIes.cnpj),
    ies_municipio: configIes.municipio,
    ies_uf:       configIes.uf,

    // ── Signatários ──────────────────────────────────────────────────────────
    signatarios: signatariosOrdenados,

    // ── Metadados ────────────────────────────────────────────────────────────
    segunda_via:  diploma.segunda_via,
    ano_emissao:  diploma.data_expedicao
                    ? new Date(diploma.data_expedicao).getFullYear()
                    : new Date().getFullYear(),
    versao_xsd:   diploma.versao_xsd,
    ambiente:     diploma.ambiente,
  }
}

// =============================================================================
// Tipo auxiliar: configurações da IES necessárias para o RVDD
// (subconjunto do diploma_config)
// =============================================================================

export interface ConfigIesParaRVDD {
  nome: string             // Ex: 'Faculdades Integradas de Cassilândia'
  sigla: string | null     // Ex: 'FIC'
  cnpj: string             // Ex: '00000000000100'
  municipio: string        // Ex: 'Cassilândia'
  uf: string               // Ex: 'MS'
  url_portal: string       // Ex: 'https://diploma.ficcassilandia.com.br'
}

// =============================================================================
// FORMATADORES AUXILIARES
// =============================================================================

/** Formata CPF: 00000000000 → 000.000.000-00 */
function formatarCPF(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return cpf
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`
}

/** Formata CNPJ: 00000000000100 → 00.000.000/0001-00 */
function formatarCNPJ(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, '')
  if (limpo.length !== 14) return cnpj
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12)}`
}

/** Formata data ISO (YYYY-MM-DD) para extenso em português */
function formatarDataExtenso(dataISO: string): string {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  // Usa UTC para evitar problemas de fuso horário (a data fica um dia antes)
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  return `${dia} de ${meses[mes - 1]} de ${ano}`
}

/** Ex: 'bacharelado' → 'Bacharelado' */
function formatarGrau(grau: string): string {
  const mapaGraus: Record<string, string> = {
    bacharelado: 'Bacharel',
    licenciatura: 'Licenciado',
    tecnologico: 'Tecnólogo',
    especializacao: 'Especialista',
    mestrado: 'Mestre',
    doutorado: 'Doutor',
  }
  return mapaGraus[grau?.toLowerCase()] ?? grau
}

/** Ex: 'presencial' → 'Presencial' */
function formatarModalidade(modalidade: string): string {
  const mapa: Record<string, string> = {
    presencial: 'Presencial',
    ead: 'Educação a Distância',
    ead_parcial: 'Semipresencial',
    hibrido: 'Híbrido',
  }
  return mapa[modalidade?.toLowerCase()] ?? modalidade
}

/** Ex: 'noturno' → 'Noturno' */
function formatarTurno(turno: string): string {
  const mapa: Record<string, string> = {
    matutino: 'Matutino',
    vespertino: 'Vespertino',
    noturno: 'Noturno',
    integral: 'Integral',
    ead: 'EaD',
  }
  return mapa[turno?.toLowerCase()] ?? turno
}

/** Monta string de naturalidade: 'Cassilândia/MS' */
function montarNaturalidade(diplomado: {
  naturalidade_municipio: string | null
  naturalidade_uf: string | null
}): string {
  const { naturalidade_municipio, naturalidade_uf } = diplomado
  if (naturalidade_municipio && naturalidade_uf) {
    return `${naturalidade_municipio}/${naturalidade_uf}`
  }
  return naturalidade_municipio ?? naturalidade_uf ?? 'Não informado'
}

/** 'brasileiro' → 'Brasileiro(a)' etc. */
function formatarNacionalidade(nacionalidade: string): string {
  const mapa: Record<string, string> = {
    brasileiro: 'Brasileiro(a)',
    brasileira: 'Brasileiro(a)',
    estrangeiro: 'Estrangeiro(a)',
  }
  return mapa[nacionalidade.toLowerCase()] ?? nacionalidade
}

/** Monta string do RG: 'RG 1.234.567 SSP/MS' */
function montarRG(diplomado: {
  rg_numero: string | null
  rg_orgao_expedidor: string | null
  rg_uf: string | null
}): string | null {
  const { rg_numero, rg_orgao_expedidor, rg_uf } = diplomado
  if (!rg_numero) return null
  const orgao = [rg_orgao_expedidor, rg_uf].filter(Boolean).join('/')
  return orgao ? `RG ${rg_numero} ${orgao}` : `RG ${rg_numero}`
}

/** Formata o cargo do signatário */
function formatarCargo(cargo: string, outroCargo: string | null): string {
  const mapa: Record<string, string> = {
    reitor: 'Reitor(a)',
    diretor: 'Diretor(a)',
    diretor_academico: 'Diretor(a) Acadêmico(a)',
    secretario_academico: 'Secretário(a) Acadêmico(a)',
    coordenador: 'Coordenador(a)',
    pro_reitor: 'Pró-Reitor(a)',
  }
  if (cargo === 'outro' && outroCargo) return outroCargo
  return mapa[cargo?.toLowerCase()] ?? cargo
}

/** Monta string do ato de reconhecimento do curso */
function montarAtoReconhecimento(curso: {
  tipo_reconhecimento?: string | null
  numero_reconhecimento?: string | null
  data_reconhecimento?: string | null
  veiculo_publicacao_reconhecimento?: string | null
  data_publicacao_reconhecimento?: string | null
  numero_dou_reconhecimento?: string | null
}): string | null {
  const {
    tipo_reconhecimento,
    numero_reconhecimento,
    data_reconhecimento,
    data_publicacao_reconhecimento,
    numero_dou_reconhecimento,
  } = curso

  if (!numero_reconhecimento) return null

  const partes: string[] = []

  if (tipo_reconhecimento) partes.push(tipo_reconhecimento)
  if (numero_reconhecimento) partes.push(`nº ${numero_reconhecimento}`)
  if (data_reconhecimento) {
    partes.push(`de ${formatarDataExtenso(data_reconhecimento)}`)
  }
  if (data_publicacao_reconhecimento && numero_dou_reconhecimento) {
    partes.push(
      `publicada no DOU nº ${numero_dou_reconhecimento} de ${formatarDataExtenso(data_publicacao_reconhecimento)}`
    )
  }

  return partes.join(' ')
}
