// =============================================================================
// Tools — Claude AI Tools (Vercel AI SDK)
// ERP Educacional FIC — Assistente de Matrícula
// =============================================================================

import { tool } from 'ai'
import { z } from 'zod'

/**
 * Conjunto de ferramentas disponíveis para o Claude usar durante o processo
 * de matrícula e preenchimento de cadastro de pessoas.
 *
 * Cada tool possui:
 * - description: descrição clara do que faz
 * - parameters: schema Zod com validação automática
 */
export const ferramentasIA = {
  /**
   * Preenche um campo do formulário com dado extraído de documento.
   * Usado quando a IA consegue extrair dados com confiança de imagens/PDFs.
   */
  preencherCampo: tool({
    description:
      'Preenche um campo do formulário com dado extraído de documento. Use esta ferramenta quando conseguir extrair dados de imagens ou PDFs enviados pelo usuário.',
    parameters: z.object({
      campo: z
        .enum([
          'nome',
          'nome_social',
          'cpf',
          'data_nascimento',
          'sexo',
          'estado_civil',
          'nacionalidade',
          'naturalidade_municipio',
          'naturalidade_uf',
          'nome_mae',
          'nome_pai',
          'observacoes',
          'email',
          'celular',
          'telefone_fixo',
          'whatsapp',
        ])
        .describe('Nome exato do campo a ser preenchido'),
      valor: z.string().describe('Valor extraído do documento (sempre formatado corretamente)'),
      confianca: z
        .enum(['alta', 'media', 'baixa'])
        .describe(
          'Nível de confiança na extração: alta (documento claro), media (alguma dúvida), baixa (ilegível, requer confirmação)',
        ),
      fonte: z
        .string()
        .describe(
          'Qual documento originou este dado (ex: RG, CPF, Certidão de Nascimento, Comprovante de Residência)',
        ),
    }),
  }),

  /**
   * Solicita ao usuário um documento que está faltando.
   * Usado quando é necessário coletar mais documentos para completar o cadastro.
   */
  solicitarDocumento: tool({
    description:
      'Solicita educadamente ao usuário que envie um documento que ainda está faltando. Use quando precisar de documentos específicos como RG, CPF, Certidão, Comprovante de Residência, etc.',
    parameters: z.object({
      tipo: z
        .enum([
          'rg',
          'cpf',
          'cnh',
          'certidao_nascimento',
          'certidao_casamento',
          'comprovante_residencia',
          'historico_escolar',
          'diploma',
          'foto_3x4',
          'titulo_eleitor',
          'reservista',
          'ctps',
          'curriculo_lattes',
          'pis_pasep',
          'passaporte',
          'outro',
        ])
        .describe('Tipo de documento necessário'),
      motivo: z
        .string()
        .describe(
          'Explicação clara em português do motivo pelo qual este documento é necessário (ex: "precisamos do RG para validar sua identidade")',
        ),
    }),
  }),

  /**
   * Faz uma pergunta ao usuário para completar informações que não podem
   * ser extraídas automaticamente de documentos.
   */
  perguntarUsuario: tool({
    description:
      'Faz uma pergunta ao usuário para obter informações que não podem ser extraídas de documentos (estado civil, contatos, etc.). Use quando precisar de resposta do usuário.',
    parameters: z.object({
      pergunta: z
        .string()
        .describe('Texto da pergunta em português, claro e direto'),
      opcoes: z
        .array(z.string())
        .optional()
        .describe('Lista de opções para o usuário escolher (para múltipla escolha)'),
      campo_relacionado: z
        .string()
        .optional()
        .describe('Nome do campo que será preenchido com a resposta'),
    }),
  }),

  /**
   * Registra um documento processado com seus dados extraídos.
   * Usado para marcar documentos como recebidos e validados.
   */
  adicionarDocumento: tool({
    description:
      'Registra um documento processado, marcando-o como recebido e validado no checklist. Use após extrair e validar dados de um documento enviado.',
    parameters: z.object({
      tipo: z
        .enum([
          'rg',
          'cpf',
          'cnh',
          'certidao_nascimento',
          'certidao_casamento',
          'comprovante_residencia',
          'historico_escolar',
          'diploma',
          'foto_3x4',
          'titulo_eleitor',
          'reservista',
          'ctps',
          'curriculo_lattes',
          'pis_pasep',
          'passaporte',
          'outro',
        ])
        .describe('Tipo do documento'),
      numero: z
        .string()
        .describe('Número do documento (para RG, CPF, CNH, etc.)'),
      orgao_expedidor: z
        .string()
        .optional()
        .describe('Órgão expedidor (ex: SSP/SP, IFP, Prefeitura)'),
      uf_expedidor: z
        .string()
        .optional()
        .describe('UF do órgão expedidor (2 letras: SP, RJ, MG, etc.)'),
      data_expedicao: z
        .string()
        .optional()
        .describe('Data de expedição no formato YYYY-MM-DD'),
    }),
  }),

  /**
   * Preenche o endereço completo a partir de um comprovante de residência.
   * Extrai e valida todos os campos de endereço de uma só vez.
   */
  adicionarEndereco: tool({
    description:
      'Preenche o endereço completo extraído de um comprovante de residência. Use quando extrair endereço de documentos como contas de utilidades ou contrato de aluguel.',
    parameters: z.object({
      cep: z
        .string()
        .regex(/^\d{5}-?\d{3}$/, 'CEP deve ter formato XXXXX-XXX ou XXXXXXXX')
        .optional(),
      logradouro: z
        .string()
        .optional()
        .describe('Nome da rua, avenida, praça, etc.'),
      numero: z
        .string()
        .optional()
        .describe('Número do imóvel'),
      complemento: z
        .string()
        .optional()
        .describe('Complemento (apartamento, bloco, lote, etc.)'),
      bairro: z
        .string()
        .optional()
        .describe('Nome do bairro'),
      cidade: z
        .string()
        .optional()
        .describe('Nome da cidade/município'),
      uf: z
        .string()
        .regex(/^[A-Z]{2}$/, 'UF deve ser 2 letras maiúsculas')
        .optional()
        .describe('Sigla do estado (SP, RJ, MG, etc.)'),
      pais: z
        .string()
        .optional()
        .default('Brasil')
        .describe('País (padrão: Brasil)'),
    }),
  }),

  /**
   * Adiciona um contato (email, celular, telefone) encontrado nos documentos
   * ou informado pelo usuário.
   */
  adicionarContato: tool({
    description:
      'Registra um contato encontrado nos documentos ou informado pelo usuário (email, celular, telefone, WhatsApp).',
    parameters: z.object({
      tipo: z
        .enum(['email', 'celular', 'telefone_fixo', 'whatsapp'])
        .describe('Tipo de contato'),
      valor: z
        .string()
        .describe(
          'Valor do contato (email com @, telefone com DDD, formato: +55 (XX) XXXXX-XXXX)',
        ),
    }),
  }),
}

/**
 * Exportar lista de ferramentas para uso com Vercel AI SDK
 */
export const toolsArray = Object.entries(ferramentasIA).map(([chave, tool]) => ({
  name: chave,
  tool,
}))

/**
 * Tipo para referência das ferramentas disponíveis
 */
export type NomeFerramenta = keyof typeof ferramentasIA
