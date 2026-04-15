// ============================================================
// VALIDADOR DE XML — Portal de Consulta Pública
// Valida XMLs de Diploma Digital contra XSD do MEC
// Verifica estrutura, assinaturas e dados obrigatórios
// ============================================================

// ── Tipos de resultado da validação ─────────────────────────

export type NivelValidacao = 'sucesso' | 'aviso' | 'erro'

export interface ItemValidacao {
  nivel: NivelValidacao
  categoria: string       // Ex: 'estrutura', 'assinatura', 'dados', 'xsd'
  mensagem: string
  detalhe?: string        // XPath ou campo específico
}

export interface DadosExtraidosXML {
  nome_diplomado: string | null
  cpf_diplomado: string | null
  nome_ies: string | null
  nome_curso: string | null
  grau: string | null
  data_colacao: string | null
  data_conclusao: string | null
  data_nascimento: string | null
  codigo_curso_emec: string | null
}

export interface ResultadoValidacaoXML {
  valido: boolean
  tipo_documento: string | null   // 'DiplomaDigital', 'HistoricoEscolar', etc.
  versao_xsd: string | null       // Versão do XSD identificada
  total_erros: number
  total_avisos: number
  itens: ItemValidacao[]
  resumo: string                   // Mensagem humana de resumo
  tempo_ms: number
  dados_extraidos: DadosExtraidosXML | null
}

// ── Namespaces e tags conhecidas ────────────────────────────

const NAMESPACES_DIPLOMA = {
  diploma: 'http://portal.mec.gov.br/diplomadigital/DiplomaDigital',
  historico: 'http://portal.mec.gov.br/diplomadigital/HistoricoEscolar',
  documentacao: 'http://portal.mec.gov.br/diplomadigital/DocumentacaoAcademica',
  // Namespace genérico usado no XSD v1.04/v1.05
  arquivosXsd: 'http://portal.mec.gov.br/diplomadigital/arquivos-em-xsd',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  xades: 'http://uri.etsi.org/01903/v1.3.2#',
}

const TIPOS_DOCUMENTO_RAIZ: Record<string, string> = {
  'DiplomaDigital': 'Diploma Digital',
  'Diploma': 'Diploma Digital (XSD 1.05)',                       // Root element no XSD v1.05
  'HistoricoEscolarDigital': 'Histórico Escolar Digital',
  'HistoricoEscolar': 'Histórico Escolar Digital (XSD 1.05)',    // Root element no XSD v1.05
  'DocumentacaoAcademicaRegistro': 'Documentação Acadêmica de Registro',
  'DocumentacaoAcademica': 'Documentação Acadêmica (XSD 1.05)',  // Root element no XSD v1.05
}

// ── Campos obrigatórios por tipo de documento ───────────────

const CAMPOS_OBRIGATORIOS: Record<string, string[]> = {
  DiplomaDigital: [
    'DadosDiploma',
    'DadosDiplomado',
    'DadosIESEmissora',
    'DadosCurso',
  ],
  Diploma: [
    'DadosDiploma',
    'Diplomado',        // XSD 1.05 usa <Diplomado> (não <DadosDiplomado>)
    'IesEmissora',      // XSD 1.05 usa <IesEmissora> (não <DadosIESEmissora>)
    'DadosCurso',
  ],
  HistoricoEscolarDigital: [
    'DadosHistorico',
    'DadosAluno',
    'DadosIESEmissora',
    'DadosCurso',
    'ElementosHistorico',
  ],
  HistoricoEscolar: [
    'DadosHistorico',
    'DadosAluno',
    'DadosIESEmissora',
    'DadosCurso',
    'ElementosHistorico',
  ],
  DocumentacaoAcademicaRegistro: [
    'DadosDiploma',       // Presente tanto no XSD 1.05 quanto 1.06
    'Diplomado',          // XSD 1.05 usa <Diplomado> dentro de DadosDiploma
  ],
  DocumentacaoAcademica: [
    'DadosDiploma',
    'Diplomado',
  ],
}

// ── Extração de dados do XML ─────────────────────────────────

/**
 * Extrai valor de um elemento XML usando regex.
 * Busca <Tag>valor</Tag> ou <ns:Tag>valor</ns:Tag>
 */
function extrairElemento(xml: string, tag: string): string | null {
  // Match <Tag>valor</Tag> ou <prefix:Tag>valor</prefix:Tag>
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]+)<\\/`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

/**
 * Extrai dados contextuais do XML para exibição no card de resultado.
 * Não depende de DOM parser — funciona via regex (Edge Runtime compatível).
 */
function extrairDadosDoXML(xmlContent: string): DadosExtraidosXML {
  // Nome do diplomado — vários padrões possíveis
  const nome = extrairElemento(xmlContent, 'Nome')
    || extrairElemento(xmlContent, 'NomeDiplomado')
    || extrairElemento(xmlContent, 'NomeAluno')

  // CPF — mascarar para privacidade (exibe só ***.XXX.XXX-**)
  const cpfRaw = extrairElemento(xmlContent, 'CPF')
    || extrairElemento(xmlContent, 'NumeroCPF')
  let cpfMascarado: string | null = null
  if (cpfRaw) {
    const limpo = cpfRaw.replace(/\D/g, '')
    if (limpo.length === 11) {
      cpfMascarado = `***.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-**`
    }
  }

  // Nome da IES
  const ies = extrairElemento(xmlContent, 'NomeIES')
    || extrairElemento(xmlContent, 'NomeInstituicao')
    || extrairElemento(xmlContent, 'RazaoSocial')

  // Curso
  const curso = extrairElemento(xmlContent, 'NomeCurso')
    || extrairElemento(xmlContent, 'Curso')

  // Grau
  const grau = extrairElemento(xmlContent, 'Grau')
    || extrairElemento(xmlContent, 'GrauConferido')
    || extrairElemento(xmlContent, 'TituloConferido')

  // Datas — formatar de YYYY-MM-DD para DD/MM/YYYY
  const formatarData = (raw: string | null): string | null => {
    if (!raw) return null
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
    return raw
  }

  const dataColacao = formatarData(
    extrairElemento(xmlContent, 'DataColacaoGrau')
    || extrairElemento(xmlContent, 'DataColacao')
  )

  const dataConclusao = formatarData(
    extrairElemento(xmlContent, 'DataConclusaoCurso')
    || extrairElemento(xmlContent, 'DataConclusao')
  )

  const dataNascimento = formatarData(
    extrairElemento(xmlContent, 'DataNascimento')
  )

  // Código e-MEC do curso
  const codigoCurso = extrairElemento(xmlContent, 'CodigoCursoEMEC')
    || extrairElemento(xmlContent, 'CodigoMECCurso')

  return {
    nome_diplomado: nome,
    cpf_diplomado: cpfMascarado,
    nome_ies: ies,
    nome_curso: curso,
    grau,
    data_colacao: dataColacao,
    data_conclusao: dataConclusao,
    data_nascimento: dataNascimento,
    codigo_curso_emec: codigoCurso,
  }
}

// ── Validação principal ─────────────────────────────────────

/**
 * Valida um XML de Diploma Digital
 *
 * Verificações realizadas:
 * 1. XML bem-formado (parsing)
 * 2. Tipo de documento reconhecido
 * 3. Presença de campos obrigatórios
 * 4. Presença de assinatura digital (Signature)
 * 5. Estrutura básica da assinatura XAdES
 * 6. Dados de IES (CNPJ, código MEC)
 * 7. Dados do diplomado (CPF, nome)
 *
 * NÃO realiza:
 * - Validação criptográfica da assinatura (requer certificado ICP-Brasil)
 * - Validação contra XSD completo (futuro)
 * - Verificação de revogação do certificado
 *
 * @param xmlContent Conteúdo XML como string
 */
export function validarXML(xmlContent: string): ResultadoValidacaoXML {
  const inicio = Date.now()
  const itens: ItemValidacao[] = []

  let tipoDocumento: string | null = null
  let versaoXsd: string | null = null

  // ── 0. Proteção contra XXE (XML External Entity) ────────
  // SEGURANÇA CRÍTICA: Rejeita XMLs que contenham declarações
  // DOCTYPE ou ENTITY, que podem ser usadas para:
  // - Ler arquivos do servidor (file://)
  // - Fazer requisições externas (SSRF)
  // - Causar DoS (billion laughs attack)
  const xxePatterns = [
    /<!DOCTYPE/i,
    /<!ENTITY/i,
    /SYSTEM\s+["']/i,
    /PUBLIC\s+["']/i,
  ]

  for (const pattern of xxePatterns) {
    if (pattern.test(xmlContent)) {
      itens.push({
        nivel: 'erro',
        categoria: 'seguranca',
        mensagem: 'Documento contém declaração DOCTYPE/ENTITY não permitida',
        detalhe: 'Por segurança, declarações DOCTYPE e ENTITY externas são bloqueadas. XMLs de Diploma Digital não devem conter estas declarações.',
      })
      // Retornar imediatamente — não processar XML potencialmente malicioso
      return {
        valido: false,
        tipo_documento: null,
        versao_xsd: null,
        total_erros: 1,
        total_avisos: 0,
        itens,
        resumo: 'Documento rejeitado por conter declarações de segurança não permitidas (DOCTYPE/ENTITY).',
        tempo_ms: Date.now() - inicio,
        dados_extraidos: null,
      }
    }
  }

  // ── 0b. Limite de tamanho ─────────────────────────────────
  // XMLs de diploma tipicamente têm 50-500KB. Limitar a 10MB para prevenir DoS.
  const MAX_XML_SIZE = 10 * 1024 * 1024 // 10MB
  if (xmlContent.length > MAX_XML_SIZE) {
    return {
      valido: false,
      tipo_documento: null,
      versao_xsd: null,
      total_erros: 1,
      total_avisos: 0,
      itens: [{
        nivel: 'erro',
        categoria: 'seguranca',
        mensagem: `Documento excede o tamanho máximo permitido (${Math.round(MAX_XML_SIZE / 1024 / 1024)}MB)`,
      }],
      resumo: 'Documento muito grande para validação.',
      tempo_ms: Date.now() - inicio,
      dados_extraidos: null,
    }
  }

  // ── 1. Verificar se é XML válido ─────────────────────────
  // Usamos regex-based parsing (sem DOM parser no Edge Runtime)
  // Para validação básica de estrutura

  // Verificar declaração XML
  if (!xmlContent.trim().startsWith('<?xml')) {
    itens.push({
      nivel: 'aviso',
      categoria: 'estrutura',
      mensagem: 'Declaração XML (<?xml ...?>) não encontrada no início do documento',
    })
  }

  // Verificar encoding UTF-8
  const encodingMatch = xmlContent.match(/encoding=["']([^"']+)["']/i)
  if (encodingMatch && encodingMatch[1].toUpperCase() !== 'UTF-8') {
    itens.push({
      nivel: 'aviso',
      categoria: 'estrutura',
      mensagem: `Encoding "${encodingMatch[1]}" detectado. Recomendado: UTF-8`,
    })
  }

  // Verificar balanceamento básico de tags (simplificado)
  // Nota: XMLs de diploma contêm blocos Base64 enormes dentro de assinaturas
  // digitais, então a contagem por regex é apenas uma heurística.
  // Usamos DOMParser quando disponível, senão contagem tolerante.
  let xmlParseError: string | null = null
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xmlContent, 'application/xml')
      const parseErr = doc.querySelector('parsererror')
      if (parseErr) {
        xmlParseError = parseErr.textContent?.slice(0, 200) ?? 'Erro de parsing'
      }
    } catch {
      // DOMParser não disponível neste runtime, usar heurística
    }
  }

  if (xmlParseError) {
    itens.push({
      nivel: 'erro',
      categoria: 'estrutura',
      mensagem: 'XML mal-formado: erro no parsing do documento',
      detalhe: xmlParseError,
    })
  } else {
    // Heurística simples: verificar se abre e fecha a tag raiz
    // Pular <?xml ...?> e encontrar a primeira tag real de elemento
    const stripped = xmlContent.replace(/<\?[^?]*\?>/g, '').trimStart()
    const rootMatch = stripped.match(/^<([a-zA-Z][\w:-]*)[\s>]/)
    if (rootMatch) {
      const rootTag = rootMatch[1]
      const hasClosing = xmlContent.includes(`</${rootTag}>`)
      if (!hasClosing) {
        itens.push({
          nivel: 'erro',
          categoria: 'estrutura',
          mensagem: `Tag raiz <${rootTag}> não possui fechamento correspondente`,
        })
      }
    }
  }

  // ── 2. Identificar tipo de documento ─────────────────────
  // Ordem importa: verificar tipos mais específicos primeiro (DiplomaDigital antes de Diploma)
  const TIPOS_PRIORIDADE = [
    'DiplomaDigital',
    'DocumentacaoAcademicaRegistro',
    'DocumentacaoAcademica',
    'HistoricoEscolarDigital',
    'HistoricoEscolar',
    'Diploma',  // último — é o mais genérico (XSD 1.05)
  ]

  for (const tag of TIPOS_PRIORIDADE) {
    // Regex: match como root element (ex: <Diploma xmlns= ou <ns:Diploma )
    // mas NÃO match substrings (ex: <DiplomaDados)
    const rgx = new RegExp(`<(?:[\\w-]+:)?${tag}[\\s>]`)
    if (rgx.test(xmlContent)) {
      tipoDocumento = tag
      itens.push({
        nivel: 'sucesso',
        categoria: 'estrutura',
        mensagem: `Tipo de documento identificado: ${TIPOS_DOCUMENTO_RAIZ[tag] ?? tag}`,
      })
      break
    }
  }

  if (!tipoDocumento) {
    itens.push({
      nivel: 'erro',
      categoria: 'estrutura',
      mensagem: 'Tipo de documento não reconhecido. Esperado: DiplomaDigital, Diploma, HistoricoEscolarDigital, HistoricoEscolar ou DocumentacaoAcademicaRegistro',
    })
  }

  // ── 3. Verificar versão do XSD ───────────────────────────
  const versaoMatch = xmlContent.match(/versao=["']([^"']+)["']/i) ||
    xmlContent.match(/version=["']([^"']+)["']/i) ||
    xmlContent.match(/v(\d+\.\d+)/i)

  if (versaoMatch) {
    versaoXsd = versaoMatch[1]
    itens.push({
      nivel: 'sucesso',
      categoria: 'xsd',
      mensagem: `Versão do schema identificada: v${versaoXsd}`,
    })

    if (versaoXsd !== '1.05' && versaoXsd !== '1.06') {
      itens.push({
        nivel: 'aviso',
        categoria: 'xsd',
        mensagem: `Versão ${versaoXsd} pode não ser a mais recente. Vigente: v1.05`,
      })
    }
  }

  // ── 4. Verificar namespaces ──────────────────────────────
  const hasNamespace = Object.values(NAMESPACES_DIPLOMA).some(ns =>
    xmlContent.includes(ns)
  )

  if (hasNamespace) {
    itens.push({
      nivel: 'sucesso',
      categoria: 'estrutura',
      mensagem: 'Namespaces do Diploma Digital detectados',
    })
  } else {
    itens.push({
      nivel: 'aviso',
      categoria: 'estrutura',
      mensagem: 'Namespaces padrão do MEC não encontrados',
    })
  }

  // ── 5. Verificar campos obrigatórios ─────────────────────
  if (tipoDocumento && CAMPOS_OBRIGATORIOS[tipoDocumento]) {
    for (const campo of CAMPOS_OBRIGATORIOS[tipoDocumento]) {
      const encontrado = xmlContent.includes(`<${campo}`) ||
        xmlContent.includes(`:${campo}`)

      if (encontrado) {
        itens.push({
          nivel: 'sucesso',
          categoria: 'dados',
          mensagem: `Campo obrigatório presente: ${campo}`,
        })
      } else {
        itens.push({
          nivel: 'erro',
          categoria: 'dados',
          mensagem: `Campo obrigatório ausente: ${campo}`,
          detalhe: `O elemento <${campo}> é obrigatório para ${TIPOS_DOCUMENTO_RAIZ[tipoDocumento] || tipoDocumento}`,
        })
      }
    }
  }

  // ── 6. Verificar assinatura digital ──────────────────────
  const hasSignature = xmlContent.includes('<Signature') ||
    xmlContent.includes(':Signature')

  if (hasSignature) {
    itens.push({
      nivel: 'sucesso',
      categoria: 'assinatura',
      mensagem: 'Assinatura digital (Signature) detectada no documento',
    })

    // Verificar componentes da assinatura
    const sigComponents = [
      { tag: 'SignedInfo', nome: 'Informações assinadas (SignedInfo)' },
      { tag: 'SignatureValue', nome: 'Valor da assinatura (SignatureValue)' },
      { tag: 'KeyInfo', nome: 'Informações do certificado (KeyInfo)' },
      { tag: 'X509Certificate', nome: 'Certificado X.509' },
    ]

    for (const comp of sigComponents) {
      const found = xmlContent.includes(`<${comp.tag}`) ||
        xmlContent.includes(`:${comp.tag}`)

      if (found) {
        itens.push({
          nivel: 'sucesso',
          categoria: 'assinatura',
          mensagem: `${comp.nome} presente`,
        })
      } else {
        itens.push({
          nivel: 'erro',
          categoria: 'assinatura',
          mensagem: `${comp.nome} ausente`,
          detalhe: `Elemento <${comp.tag}> é obrigatório na assinatura`,
        })
      }
    }

    // Verificar XAdES (Assinatura Avançada)
    const hasXAdES = xmlContent.includes('QualifyingProperties') ||
      xmlContent.includes(NAMESPACES_DIPLOMA.xades)

    if (hasXAdES) {
      itens.push({
        nivel: 'sucesso',
        categoria: 'assinatura',
        mensagem: 'Assinatura avançada XAdES detectada',
      })

      // Verificar carimbo de tempo
      const hasTimestamp = xmlContent.includes('SignatureTimeStamp') ||
        xmlContent.includes('ArchiveTimeStamp')

      if (hasTimestamp) {
        itens.push({
          nivel: 'sucesso',
          categoria: 'assinatura',
          mensagem: 'Carimbo de tempo presente na assinatura',
        })
      } else {
        itens.push({
          nivel: 'aviso',
          categoria: 'assinatura',
          mensagem: 'Carimbo de tempo não encontrado. Assinatura AD-RA requer carimbo.',
        })
      }
    } else {
      itens.push({
        nivel: 'aviso',
        categoria: 'assinatura',
        mensagem: 'Elementos XAdES não encontrados. O MEC exige assinatura no padrão XAdES AD-RA.',
      })
    }
  } else {
    itens.push({
      nivel: 'erro',
      categoria: 'assinatura',
      mensagem: 'Assinatura digital não encontrada no documento',
      detalhe: 'Documentos de Diploma Digital devem conter pelo menos uma assinatura digital ICP-Brasil',
    })
  }

  // ── 7. Verificar dados de IES ────────────────────────────
  const cnpjMatch = xmlContent.match(/CNPJ[>"](\d{14})[<"]/i) ||
    xmlContent.match(/cnpj[>"](\d{14})[<"]/i)

  if (cnpjMatch) {
    itens.push({
      nivel: 'sucesso',
      categoria: 'dados',
      mensagem: `CNPJ da IES encontrado: ${cnpjMatch[1].replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`,
    })
  }

  const codigoMecMatch = xmlContent.match(/CodigoMEC[>"](\d+)[<"]/i) ||
    xmlContent.match(/codigoIES[>"](\d+)[<"]/i)

  if (codigoMecMatch) {
    itens.push({
      nivel: 'sucesso',
      categoria: 'dados',
      mensagem: `Código MEC da IES encontrado: ${codigoMecMatch[1]}`,
    })
  }

  // ── 8. Contar erros e avisos ─────────────────────────────
  const totalErros = itens.filter(i => i.nivel === 'erro').length
  const totalAvisos = itens.filter(i => i.nivel === 'aviso').length
  const totalSucessos = itens.filter(i => i.nivel === 'sucesso').length
  const valido = totalErros === 0

  // ── 9. Gerar resumo ─────────────────────────────────────
  let resumo: string
  if (valido && totalAvisos === 0) {
    resumo = `Documento válido! ${totalSucessos} verificações passaram com sucesso.`
  } else if (valido) {
    resumo = `Documento válido com ${totalAvisos} aviso(s). ${totalSucessos} verificações OK.`
  } else {
    resumo = `Documento com ${totalErros} erro(s) e ${totalAvisos} aviso(s). Revise os itens abaixo.`
  }

  // ── 10. Extrair dados do diploma para exibição ──────────
  const dadosExtraidos = extrairDadosDoXML(xmlContent)

  return {
    valido,
    tipo_documento: tipoDocumento ? (TIPOS_DOCUMENTO_RAIZ[tipoDocumento] || tipoDocumento) : null,
    versao_xsd: versaoXsd,
    total_erros: totalErros,
    total_avisos: totalAvisos,
    itens,
    resumo,
    tempo_ms: Date.now() - inicio,
    dados_extraidos: dadosExtraidos,
  }
}
