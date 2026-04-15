// ============================================================
// PARSER — Extrai dados de registro do DiplomaDigital XML
// ============================================================
//
// Quando a UFMS (registradora) devolve o XML do DiplomaDigital,
// este parser extrai os campos de DadosRegistro e as assinaturas
// da registradora (ordens 3-5) para atualizar o diploma no banco.
//
// Campos extraídos de <DadosRegistro>:
//   - LivroRegistro
//   - NumeroRegistro
//   - Processo (número SEI)
//   - DataRegistro
//   - CodigoValidacao (gerado pela registradora)
//
// Assinaturas extraídas de <Signature> elements:
//   - Nome do assinante
//   - CPF ou CNPJ
//   - Data da assinatura
//   - Tipo de certificado (eCPF / eCNPJ)
// ============================================================

export interface DadosRegistroExtraidos {
  livro_registro: string | null
  numero_registro: string | null
  processo_sei: string | null
  data_registro: string | null
  codigo_validacao: string | null
}

export interface AssinaturaExtraida {
  nome: string
  cpf_cnpj: string
  tipo_certificado: "eCPF" | "eCNPJ"
  data_assinatura: string | null
  ordem_sugerida: number
  papel: "emissora" | "registradora"
}

export interface ResultadoParseRegistro {
  sucesso: boolean
  dados_registro: DadosRegistroExtraidos
  assinaturas: AssinaturaExtraida[]
  erros: string[]
  xml_tipo: "diploma_digital" | "desconhecido"
}

/**
 * Extrai o texto de um elemento XML usando regex simples.
 * Para uso em produção, trocar por um parser XML real (fast-xml-parser).
 */
function extrairElemento(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i")
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

/**
 * Verifica se o XML é um DiplomaDigital válido (contém os namespaces corretos).
 */
function isDiplomaDigitalXML(xml: string): boolean {
  return (
    xml.includes("DiplomaDigital") &&
    (xml.includes("diploma.mec.gov.br") || xml.includes("DiplomaDigital_"))
  )
}

/**
 * Extrai dados de DadosRegistro do XML do DiplomaDigital.
 */
function extrairDadosRegistro(xml: string): DadosRegistroExtraidos {
  return {
    livro_registro: extrairElemento(xml, "LivroRegistro"),
    numero_registro: extrairElemento(xml, "NumeroRegistro"),
    processo_sei: extrairElemento(xml, "Processo") ?? extrairElemento(xml, "NumeroProcesso"),
    data_registro: extrairElemento(xml, "DataRegistro"),
    codigo_validacao: extrairElemento(xml, "CodigoValidacao"),
  }
}

/**
 * Extrai assinaturas do XML (blocos <Signature>).
 * Cada <Signature> contém informações do certificado no <X509Certificate>
 * e do assinante no <SignerInfo>.
 *
 * NOTA: Esta é uma implementação estrutural. A extração real de campos
 * de certificados X.509 requer uma lib como `node-forge` ou `@peculiar/x509`.
 * Por ora, extraímos os campos que o XSD do MEC coloca em tags legíveis.
 */
function extrairAssinaturas(xml: string): AssinaturaExtraida[] {
  const assinaturas: AssinaturaExtraida[] = []

  // O XSD do MEC coloca dados dos assinantes em <InformacoesGenericas> ou
  // dentro de estruturas <TituloDoConferente>, <InformacoesSobreAssinatura>, etc.
  // Busca todos os blocos de assinatura na seção <Assinaturas> se existir
  const blocosAssinatura = xml.match(/<Assinatura[\s>][\s\S]*?<\/Assinatura>/gi) ?? []

  blocosAssinatura.forEach((bloco, idx) => {
    const nome = extrairElemento(bloco, "Nome") ?? `Assinante ${idx + 1}`
    const cpf = extrairElemento(bloco, "CPF")
    const cnpj = extrairElemento(bloco, "CNPJ")
    const cpfCnpj = cpf ?? cnpj ?? ""
    const tipoDoc = cnpj ? "eCNPJ" : "eCPF"
    const data = extrairElemento(bloco, "DataAssinatura") ?? extrairElemento(bloco, "SigningTime")

    assinaturas.push({
      nome,
      cpf_cnpj: cpfCnpj,
      tipo_certificado: tipoDoc,
      data_assinatura: data,
      ordem_sugerida: idx + 1,
      papel: idx < 2 ? "emissora" : "registradora",  // ordens 1-2 = emissora, 3-5 = registradora
    })
  })

  return assinaturas
}

/**
 * Parser principal — recebe o XML cru do DiplomaDigital devolvido pela UFMS
 * e extrai todos os dados necessários para atualizar o banco.
 */
export function parseDiplomaDigitalRegistrado(xmlContent: string): ResultadoParseRegistro {
  const erros: string[] = []

  // 1. Verifica se é um DiplomaDigital
  if (!isDiplomaDigitalXML(xmlContent)) {
    return {
      sucesso: false,
      dados_registro: {
        livro_registro: null,
        numero_registro: null,
        processo_sei: null,
        data_registro: null,
        codigo_validacao: null,
      },
      assinaturas: [],
      erros: ["O arquivo não parece ser um XML de DiplomaDigital válido."],
      xml_tipo: "desconhecido",
    }
  }

  // 2. Extrai dados de registro
  const dados = extrairDadosRegistro(xmlContent)

  if (!dados.livro_registro) erros.push("Campo LivroRegistro não encontrado no XML.")
  if (!dados.numero_registro) erros.push("Campo NumeroRegistro não encontrado no XML.")
  if (!dados.data_registro) erros.push("Campo DataRegistro não encontrado no XML.")
  if (!dados.codigo_validacao) erros.push("Campo CodigoValidacao não encontrado no XML.")

  // 3. Extrai assinaturas
  const assinaturas = extrairAssinaturas(xmlContent)

  if (assinaturas.length === 0) {
    erros.push("Nenhuma assinatura encontrada no XML. O XML pode não estar assinado.")
  }

  const assinaturasRegistradora = assinaturas.filter((a) => a.papel === "registradora")
  if (assinaturasRegistradora.length === 0 && assinaturas.length > 0) {
    erros.push("Nenhuma assinatura da registradora identificada (esperadas nas posições 3-5).")
  }

  return {
    sucesso: erros.length === 0,
    dados_registro: dados,
    assinaturas,
    erros,
    xml_tipo: "diploma_digital",
  }
}
