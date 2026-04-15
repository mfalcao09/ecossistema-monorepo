/**
 * Tipos e interfaces para geração de XMLs de Diploma Digital
 * Conforme Portaria MEC 70/2025 e XSD v1.05
 *
 * ESTRUTURA XSD v1.05:
 * - TDadosDiplomado: ID, GPessoa(Nome,NomeSocial?,Sexo), Nacionalidade, Naturalidade(GMunicipio), CPF, RG, DataNascimento
 * - TDadosCurso: NomeCurso, CodigoCursoEMEC, Habilitacao*, Modalidade, TituloConferido, GrauConferido, EnderecoCurso, Autorizacao, Reconhecimento
 * - TDadosIesEmissora: Nome, CodigoMEC, CNPJ, Endereco, Credenciamento, Recredenciamento?, Mantenedora?
 * - THistoricoEscolar: CodigoCurriculo, ElementosHistorico, DataEmissao, Hora, SituacaoAtualDiscente, ENADE, CargaHoraria, IngressoCurso
 */

// ============================================================
// INTERFACE PRINCIPAL — Dados completos para geração dos XMLs
// ============================================================

export interface DadosDiploma {
  // Dados do diplomado (TDadosDiplomado)
  diplomado: {
    /** RA do aluno — obrigatório, elemento <ID> no XSD */
    ra: string;
    nome: string;
    nome_social?: string;
    sexo: 'M' | 'F';
    nacionalidade: string;
    /** Código IBGE do município de naturalidade (7 dígitos) — OBRIGATÓRIO */
    codigo_municipio_ibge: string;
    naturalidade_municipio: string;
    naturalidade_uf: string;
    /** Para estrangeiros, usar naturalidade_municipio_estrangeiro */
    naturalidade_municipio_estrangeiro?: string;
    cpf: string;
    data_nascimento: string; // ISO date YYYY-MM-DD
    rg_numero?: string;
    rg_orgao_expedidor?: string;
    rg_uf?: string;
    /** Filiação — obrigatório na DocumentacaoAcademica (TDadosPrivadosDiplomado) */
    filiacao?: Genitor[];
  };

  // Dados do curso (TDadosCurso)
  curso: {
    nome: string;
    codigo_emec: string;
    habilitacoes?: Habilitacao[];
    modalidade: 'Presencial' | 'EAD';
    /** Título conferido: "Bacharel", "Licenciado", "Tecnólogo", "Médico" ou outro */
    titulo_conferido: string;
    /** Grau conferido: "Bacharelado", "Licenciatura", "Tecnólogo", "Curso sequencial" */
    grau_conferido: string;
    enfase?: string;
    /** Endereço do curso — TEndereco com GMunicipio */
    endereco: EnderecoXSD;
    /** Ato regulatório de autorização — OBRIGATÓRIO */
    autorizacao: AtoRegulatorio;
    /** Ato regulatório de reconhecimento — OBRIGATÓRIO */
    reconhecimento: AtoRegulatorio;
    /** Ato regulatório de renovação de reconhecimento — opcional */
    renovacao_reconhecimento?: AtoRegulatorio;
  };

  // Dados da IES emissora (TDadosIesEmissora)
  ies: {
    nome: string;
    codigo_mec: string;
    cnpj: string;
    endereco: EnderecoXSD;
    /** Ato de credenciamento — TAtoRegulatorioComOuSemEMEC */
    credenciamento: AtoRegulatorio;
    recredenciamento?: AtoRegulatorio;
    renovacao_recredenciamento?: AtoRegulatorio;
    mantenedora?: {
      razao_social: string;
      cnpj: string;
      endereco: EnderecoXSD;
    };
  };

  // Dados da IES registradora (para DocumentacaoAcademica)
  ies_registradora?: {
    nome: string;
    codigo_mec: string;
    cnpj: string;
  };

  // Dados do diploma em si
  diploma: {
    id: string; // UUID do diploma
    /**
     * Código de validação do DIPLOMA — preenchido APENAS pela registradora.
     *
     * IMPORTANTE: A FIC (emissora) NÃO gera nem emite este campo. O XSD v1.05
     * `TDadosDiploma` (que vai dentro do DocumentacaoAcademicaRegistro) NÃO
     * possui elemento para `codigo_validacao` — esse código aparece somente
     * em `TDadosRegistro`, gerado posteriormente pela registradora.
     *
     * Mantemos o campo opcional aqui apenas para casos em que o ERP precise
     * exibir o código DEPOIS do retorno da registradora (via portal do
     * diplomado, RVDD, etc.). Nunca deve ser preenchido pelo motor da emissora.
     */
    codigo_validacao?: string;
    data_colacao_grau: string; // ISO date
    data_conclusao: string; // ISO date
    /**
     * Bug #E — fix 2026-04-07 (Onda 2 / Caminho C):
     * REMOVIDO. `DataExpedicaoDiploma` no XML do diploma só existe dentro
     * de `TLivroRegistro`/`TLivroRegistroNSF` (XSD diploma v1.05 linhas
     * 500/532), que são EXCLUSIVAMENTE preenchidos pela registradora.
     * A FIC nunca escreve esse campo no diploma. No histórico, é derivado
     * automaticamente pelo helper `gerarDataExpedicaoXML()` ao montar o
     * XML — quem chamar o motor não tem como passar valor manual.
     */
    segunda_via?: boolean;
    /**
     * Ambiente da emissão do XML (XSD `TAmb`).
     *
     * Bug #1 — fix 2026-04-07 (Onda 1):
     * Antes era hardcoded "Produção" nos generators. Agora é dinâmico para
     * permitir dev/staging emitirem XMLs marcados como `homologacao` ou
     * `teste` (sem efeito jurídico). Em NODE_ENV=production o montador
     * SEMPRE força "producao" como trava de segurança.
     *
     * Per IN SESu 05/2022 §2.2.2.3, apenas `Produção` tem validade legal.
     */
    ambiente?: 'producao' | 'homologacao' | 'teste';
  };

  // Histórico escolar (THistoricoEscolar)
  historico: {
    codigo_curriculo: string;
    /** Código de validação do histórico: eMEC_ies.hex12+ */
    codigo_validacao_historico: string;
    data_emissao: string; // ISO date
    hora_emissao: string; // HH:MM:SS
    /** Carga horária total do currículo */
    carga_horaria_curso: number;
    /** Carga horária efetivamente integralizada */
    carga_horaria_integralizada: number;
    /** Se é hora-aula ou hora-relógio */
    tipo_carga_horaria: 'HoraAula' | 'HoraRelogio';
    /** Data de ingresso no curso */
    data_ingresso: string; // ISO date
    /** Forma de acesso ao curso */
    forma_acesso: TFormaAcesso;
    /**
     * Situação do discente — para formados, inclui datas.
     *
     * Bug #E — fix 2026-04-07 (Onda 2 / Caminho C):
     * `data_expedicao_diploma` foi REMOVIDO deste tipo. Agora é derivado
     * automaticamente pelo `historico.builder.ts` via `gerarDataExpedicaoXML()`,
     * que retorna a data atual no fuso America/Sao_Paulo. Isso elimina a
     * possibilidade de quem chama o motor passar uma data incorreta.
     */
    situacao_discente: {
      tipo: 'Formado';
      data_conclusao: string;
      data_colacao_grau: string;
    };
    disciplinas: Disciplina[];
    atividades_complementares?: AtividadeComplementar[];
    estagios?: Estagio[];
    enade: EnadeInfo[];
  };

  // Assinantes (para geração posterior de assinatura)
  assinantes: Assinante[];
}

// ============================================================
// TIPOS AUXILIARES
// ============================================================

/** Formas de acesso ao curso — conforme XSD v1.05 TFormaAcessoCurso */
export type TFormaAcesso =
  | 'Vestibular'
  | 'Enem'
  | 'Avaliação Seriada'
  | 'Seleção Simplificada'
  | 'Egresso BI/LI'
  | 'PEC-G'
  | 'Transferência Ex Officio'
  | 'Decisão judicial'
  | 'Seleção para Vagas Remanescentes'
  | 'Seleção para Vagas de Programas Especiais';

/** Endereço conforme TEndereco do XSD v1.05 */
export interface EnderecoXSD {
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  codigo_municipio: string; // IBGE 7 dígitos
  nome_municipio: string;
  uf: string;
  cep: string;
}

/** Ato regulatório — TAtoRegulatorioComOuSemEMEC */
export interface AtoRegulatorio {
  tipo: string; // "Portaria", "Decreto", etc.
  numero: string;
  data: string; // ISO date
  veiculo_publicacao?: string;
  data_publicacao?: string; // ISO date
  secao_publicacao?: string;
  pagina_publicacao?: string;
  numero_dou?: string;
}

/** Habilitação — THabilitacao */
export interface Habilitacao {
  nome: string;
  data: string; // ISO date
}

/** Genitor — para TFiliacao */
export interface Genitor {
  nome: string;
  nome_social?: string;
  sexo: 'M' | 'F';
}

/** ENADE — TEnade: Habilitado, NaoHabilitado ou Irregular */
export interface EnadeInfo {
  tipo: 'Habilitado' | 'NaoHabilitado' | 'Irregular';
  condicao: 'Ingressante' | 'Concluinte';
  edicao: string; // ano AAAA
  /** Para NaoHabilitado: motivo ou outro motivo */
  motivo?: string;
  outro_motivo?: string;
}

/**
 * Disciplina do histórico escolar (TEntradaHistoricoDisciplina)
 */
export interface Disciplina {
  codigo: string;
  nome: string;
  periodo_letivo: string;
  /** Carga horária com etiqueta — XSD permite múltiplas */
  carga_horaria: CargaHorariaComEtiqueta[];
  /** Nota 0-10 */
  nota?: number;
  /** Nota 0-100 */
  nota_ate_cem?: number;
  /** Conceito (A+, A, A-, ... F-) */
  conceito?: string;
  /** Conceito RM (A, B, C, APD, APP, APR) */
  conceito_rm?: string;
  /** Conceito específico do curso */
  conceito_especifico?: string;
  /** Situação: Aprovado, Pendente, Reprovado */
  situacao: 'Aprovado' | 'Pendente' | 'Reprovado';
  /** Forma de integralização (apenas para Aprovado) */
  forma_integralizacao?: 'Cursado' | 'Validado' | 'Aproveitado';
  outra_forma_integralizacao?: string;
  /** Docentes da disciplina — obrigatório no XSD v1.05 */
  docentes: DocenteInfo[];
}

/** Carga horária com etiqueta — TCargaHorariaComEtiqueta */
export interface CargaHorariaComEtiqueta {
  tipo: 'HoraAula' | 'HoraRelogio';
  valor: number;
  etiqueta?: string;
}

/** Informações do docente — TDocente */
export interface DocenteInfo {
  nome: string;
  titulacao: 'Tecnólogo' | 'Graduação' | 'Especialização' | 'Mestrado' | 'Doutorado';
  lattes?: string;
  cpf?: string;
}

/**
 * Atividade complementar (TEntradaHistoricoAtividadeComplementar)
 */
export interface AtividadeComplementar {
  codigo: string;
  data_inicio: string; // ISO date
  data_fim: string; // ISO date
  data_registro?: string;
  tipo: string;
  descricao?: string;
  carga_horaria_relogio: CargaHorariaRelogioComEtiqueta[];
  docentes_validacao: DocenteInfo[];
}

/** Hora-relógio com etiqueta */
export interface CargaHorariaRelogioComEtiqueta {
  valor: number;
  etiqueta?: string;
}

/**
 * Estágio (TEntradaHistoricoEstagio)
 */
export interface Estagio {
  codigo_unidade_curricular: string;
  data_inicio: string; // ISO date
  data_fim: string; // ISO date
  concedente?: {
    tipo: 'PJ' | 'PF';
    razao_social?: string;
    nome_fantasia?: string;
    cnpj?: string;
    nome?: string;
    cpf?: string;
  };
  descricao?: string;
  carga_horaria_relogio: CargaHorariaRelogioComEtiqueta[];
  docentes_orientadores: DocenteInfo[];
}

/**
 * Assinante do diploma (diretor, reitor, etc.)
 * Conforme XSD v1.05: mínimo 2 e-CPF A3 + 1 e-CNPJ A3.
 * O portador do e-CNPJ DEVE ser o último a assinar (maior ordem_assinatura).
 */
export interface Assinante {
  nome: string;
  cpf: string;
  cargo: string;
  /**
   * Tipo de certificado ICP-Brasil.
   * 'eCPF'  → certificado pessoal (A3 obrigatório)
   * 'eCNPJ' → certificado da instituição (deve assinar por último)
   */
  tipo_certificado: 'eCPF' | 'eCNPJ';
  /** Ordem numérica de assinatura. O eCNPJ deve ter o maior número. */
  ordem_assinatura?: number;
}
