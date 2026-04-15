// ─────────────────────────────────────────────────────────────────────────────
// Tipos para a integração BRy Diploma Digital (Initialize/Finalize)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de assinante conforme a API BRy.
 * Cada tipo define quem está assinando e em que contexto.
 */
export type TipoAssinanteBry =
  | "Representantes"           // PF (e-CPF) — representante da IES
  | "IESEmissoraDadosDiploma"  // PJ (e-CNPJ) — IES emissora no nodo DadosDiploma
  | "IESEmissoraRegistro"      // PJ (e-CNPJ) — IES emissora para registro
  | "IESRegistradora";         // PJ (e-CNPJ) — IES registradora

/**
 * Tipos de documento XML do diploma digital.
 */
export type TipoDocumentoBry =
  | "XMLDocumentacaoAcademica"
  | "XMLDiplomado"
  | "XMLHistoricoEscolar"
  | "XMLCurriculoEscolar";

/**
 * Perfil de assinatura (política ICP-Brasil).
 */
export type PerfilAssinatura = "ADRT" | "ADRA";

/**
 * Parâmetros para a chamada Initialize.
 */
export interface BryInitializeParams {
  /** Nonce único para identificar esta operação */
  nonce: string;
  /** Chave pública do certificado em Base64 */
  certificate: string;
  /** Perfil de assinatura: ADRT (intermediário) ou ADRA (envelope final) */
  profile: PerfilAssinatura;
  /** Conteúdo XML a ser assinado */
  xmlContent: string;
  /** Nome do nodo específico (ex: 'DadosDiploma'). null = assina documento inteiro */
  specificNodeName?: string | null;
  /** Namespace do nodo específico */
  specificNodeNamespace?: string | null;
  /** Se true, adiciona includeXPathEnveloped=false (obrigatório do 2º passo em diante) */
  includeXPathEnveloped?: boolean;
}

/**
 * Retorno da chamada Initialize.
 */
export interface BryInitializeResponse {
  signedAttributes: Array<{
    nonce: string;
    content: string; // base64 — hash para cifrar com chave privada
  }>;
  initializedDocuments: Array<{
    nonce: string;
    content: string; // blob para enviar no Finalize
  }>;
}

/**
 * Parâmetros para a chamada Finalize.
 */
export interface BryFinalizeParams {
  /** Mesmo nonce usado no Initialize */
  nonce: string;
  /** Chave pública do certificado em Base64 */
  certificate: string;
  /** Perfil de assinatura */
  profile: PerfilAssinatura;
  /** XML original a ser assinado */
  xmlContent: string;
  /** signedAttributes cifrado com chave privada (base64) — da extensão BRy */
  signatureValue: string;
  /** initializedDocument retornado pelo Initialize */
  initializedDocument: string;
  /** Se true, adiciona includeXPathEnveloped=false */
  includeXPathEnveloped?: boolean;
}

/**
 * Retorno da chamada Finalize.
 */
export interface BryFinalizeResponse {
  /** Array de documentos assinados */
  documentos: Array<{
    nonce: string;
    content?: string; // XML assinado em Base64 (quando returnType=BASE64)
    links?: Array<{
      href: string; // URL de download (quando returnType=LINK)
    }>;
  }>;
}

/**
 * Input formatado para a extensão BryWebExtension.sign().
 * O frontend monta este objeto e envia para a extensão.
 */
export interface BryExtensionSignInput {
  formatoDadosEntrada: "Base64";
  formatoDadosSaida: "Base64";
  algoritmoHash: "SHA256";
  assinaturas: Array<{
    hashes: string[]; // array com um elemento: o signedAttributes.content
    nonce: string;
  }>;
}

/**
 * Retorno da extensão BryWebExtension.sign().
 */
export interface BryExtensionSignOutput {
  assinaturas: Array<{
    hashes: string[]; // array com o signatureValue cifrado
    nonce: string;
  }>;
}

// ─── Carimbo do Tempo (Timestamp) ──────────────────────────────────────────

/**
 * Formato de envio para o carimbo-service.
 * - FILE: envia o documento inteiro (multipart file)
 * - HASH: envia apenas o hash SHA256 do documento
 */
export type TimestampFormat = "FILE" | "HASH";

/**
 * Parâmetros para solicitar carimbo do tempo.
 */
export interface BryTimestampParams {
  /** Identificador único da requisição */
  nonce: string;
  /** Algoritmo de hash: SHA1, SHA256 ou SHA512 */
  hashAlgorithm: "SHA1" | "SHA256" | "SHA512";
  /** Modo de envio: FILE (documento inteiro) ou HASH (apenas hash) */
  format: TimestampFormat;
  /** Conteúdo do documento (Buffer/Blob quando FILE, string hex quando HASH) */
  content: Buffer | string;
  /** Nome do arquivo (usado quando format=FILE) */
  fileName?: string;
  /** Nonce interno do carimbo dentro do lote */
  documentNonce?: string;
}

/**
 * Retorno do carimbo-service.
 */
export interface BryTimestampResponse {
  /** Array de carimbos gerados */
  timeStamps: Array<{
    /** Nonce do carimbo */
    nonce: number;
    /** Carimbo do tempo codificado em base64 */
    content: string;
  }>;
}

/**
 * Definição de um passo de assinatura completo.
 * Usado para configurar o fluxo multi-passo de cada tipo de XML.
 */
export interface PassoAssinatura {
  /** Número do passo (1, 2, 3...) */
  passo: number;
  /** Descrição humana do passo */
  descricao: string;
  /** Tipo de assinante */
  tipoAssinante: TipoAssinanteBry;
  /** Perfil de assinatura */
  perfil: PerfilAssinatura;
  /** Nome do nodo específico a assinar (null = envelope inteiro) */
  specificNodeName: string | null;
  /** Namespace do nodo */
  specificNodeNamespace: string | null;
  /** Se deve incluir includeXPathEnveloped=false */
  includeXPathEnveloped: boolean;
  /** CPF ou CNPJ do assinante responsável por este passo (para filtro no frontend) */
  cpfAssinante?: string | null;
  /** Tipo do certificado: eCPF ou eCNPJ */
  tipoCertificado?: "eCPF" | "eCNPJ" | null;
}
