/**
 * Validação estrutural dos XMLs gerados
 * Conforme XSD v1.05 — Portaria MEC 70/2025
 *
 * Elementos raiz corretos:
 * - <Diploma> (não DiplomaDigital)
 * - <DocumentoHistoricoEscolarFinal> (não HistoricoEscolarDigital)
 * - <DocumentacaoAcademicaRegistro>
 */

export interface ResultadoValidacao {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

/**
 * Verifica se uma tag XML existe no documento
 */
function tagExiste(xml: string, tagName: string): boolean {
  const regex = new RegExp(`<${tagName}[^>]*>`, 'i');
  return regex.test(xml);
}

/**
 * Extrai o conteúdo de uma tag XML
 */
function extrairConteudoTag(
  xml: string,
  tagName: string
): string | undefined {
  const regex = new RegExp(
    `<${tagName}[^>]*>([^<]*)</${tagName}>`,
    'i'
  );
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Valida se um XML tem a estrutura básica correta
 */
function validarEstruturaBasica(xml: string): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Verifica declaração XML
  if (!xml.startsWith('<?xml')) {
    erros.push(
      'XML não possui declaração <?xml version="1.0" encoding="UTF-8"?>'
    );
  }

  // Verifica UTF-8
  if (!xml.includes('UTF-8')) {
    avisos.push('Recomenda-se usar encoding UTF-8');
  }

  // Verifica namespace obrigatório — HTTPS conforme XSD v1.05
  if (!xml.includes('https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd')) {
    erros.push('Namespace do MEC não encontrado (deve ser HTTPS)');
  }

  // Verifica versão
  if (!xml.includes('versao="1.05"')) {
    avisos.push('Atributo versao="1.05" não encontrado no elemento raiz');
  }

  return { valido: erros.length === 0, erros, avisos };
}

/**
 * Valida Diploma (elemento raiz <Diploma> no XSD v1.05)
 * Nota: FIC é emissora, não registradora. Este XML é gerado pela registradora (UFMS).
 * Mantido para validação de referência.
 */
export function validarDiplomaDigital(xml: string): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Estrutura básica
  const basica = validarEstruturaBasica(xml);
  erros.push(...basica.erros);
  avisos.push(...basica.avisos);

  // Verifica elemento raiz — XSD v1.05 usa <Diploma>, não <DiplomaDigital>
  if (!xml.includes('<Diploma')) {
    erros.push('Elemento raiz <Diploma> não encontrado');
  }

  // Campos obrigatórios de TDadosDiplomado
  const camposDiplomado = [
    'Nome',
    'CPF',
    'DataNascimento',
    'Sexo',
    'Nacionalidade',
  ];
  for (const campo of camposDiplomado) {
    if (!tagExiste(xml, campo)) {
      erros.push(`Campo obrigatório ausente: ${campo}`);
    }
  }

  // ID (RA) obrigatório
  if (!tagExiste(xml, 'ID')) {
    erros.push('Campo obrigatório ausente: ID (RA do aluno)');
  }

  // Campos obrigatórios de TDadosCurso (XSD v1.05)
  const camposCurso = [
    'NomeCurso',
    'CodigoCursoEMEC',
    'GrauConferido',
    'TituloConferido',
    'Modalidade',
  ];
  for (const campo of camposCurso) {
    if (!tagExiste(xml, campo)) {
      erros.push(`Campo obrigatório ausente: ${campo}`);
    }
  }

  // Campos obrigatórios de TDadosIesEmissora (XSD v1.05)
  // Nota: no XSD os campos são Nome, CodigoMEC, CNPJ dentro de IesEmissora
  if (!tagExiste(xml, 'IesEmissora')) {
    erros.push('Seção IesEmissora obrigatória ausente');
  }

  // Campos de Credenciamento
  if (!tagExiste(xml, 'Credenciamento')) {
    avisos.push('Seção Credenciamento não encontrada em IesEmissora');
  }

  // Campos de Autorizacao e Reconhecimento do curso
  if (!tagExiste(xml, 'Autorizacao')) {
    avisos.push('Seção Autorizacao não encontrada em DadosCurso');
  }
  if (!tagExiste(xml, 'Reconhecimento')) {
    avisos.push('Seção Reconhecimento não encontrada em DadosCurso');
  }

  // Validações de formato
  const cpf = extrairConteudoTag(xml, 'CPF');
  if (cpf && !/^\d{11}$/.test(cpf)) {
    erros.push(`CPF inválido: ${cpf} (deve ter 11 dígitos)`);
  }

  const cnpj = extrairConteudoTag(xml, 'CNPJ');
  if (cnpj && !/^\d{14}$/.test(cnpj)) {
    erros.push(`CNPJ inválido: ${cnpj} (deve ter 14 dígitos)`);
  }

  // Validação de datas (formato YYYY-MM-DD)
  const datas = [
    'DataNascimento',
    'DataColacaoGrau',
    'DataConclusaoCurso',
    'DataExpedicaoDiploma',
  ];
  const regexData = /^\d{4}-\d{2}-\d{2}$/;

  for (const campo of datas) {
    const data = extrairConteudoTag(xml, campo);
    if (data && !regexData.test(data)) {
      avisos.push(
        `Campo ${campo} pode ter formato de data inválido: ${data}`
      );
    }
  }

  // Validação de sexo
  const sexo = extrairConteudoTag(xml, 'Sexo');
  if (sexo && !['M', 'F'].includes(sexo)) {
    erros.push(`Sexo inválido: ${sexo} (deve ser M ou F)`);
  }

  return { valido: erros.length === 0, erros, avisos };
}

/**
 * Valida DocumentoHistoricoEscolarFinal (XSD v1.05)
 * Elemento raiz: <DocumentoHistoricoEscolarFinal>
 */
export function validarHistoricoEscolar(xml: string): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Estrutura básica
  const basica = validarEstruturaBasica(xml);
  erros.push(...basica.erros);
  avisos.push(...basica.avisos);

  // Verifica elemento raiz — XSD v1.05 usa <DocumentoHistoricoEscolarFinal>
  if (!xml.includes('<DocumentoHistoricoEscolarFinal')) {
    erros.push('Elemento raiz <DocumentoHistoricoEscolarFinal> não encontrado');
  }

  // Campos obrigatórios do aluno
  const camposAluno = ['Nome', 'CPF', 'DataNascimento', 'Sexo'];
  for (const campo of camposAluno) {
    if (!tagExiste(xml, campo)) {
      erros.push(`Campo obrigatório ausente em Aluno: ${campo}`);
    }
  }

  // Campos obrigatórios do histórico (XSD v1.05)
  if (!tagExiste(xml, 'DataEmissaoHistorico')) {
    erros.push('Campo obrigatório ausente: DataEmissaoHistorico');
  }
  if (!tagExiste(xml, 'HoraEmissaoHistorico')) {
    avisos.push('Campo HoraEmissaoHistorico não encontrado');
  }
  if (!tagExiste(xml, 'CodigoCurriculo')) {
    avisos.push('Campo CodigoCurriculo não encontrado');
  }

  // SituacaoAtualDiscente
  if (!tagExiste(xml, 'SituacaoAtualDiscente')) {
    avisos.push('Seção SituacaoAtualDiscente não encontrada');
  }

  // ENADE
  if (!tagExiste(xml, 'ENADE')) {
    avisos.push('Seção ENADE não encontrada');
  }

  // CargaHoraria
  if (!tagExiste(xml, 'CargaHorariaCursoIntegralizada')) {
    avisos.push('Campo CargaHorariaCursoIntegralizada não encontrado');
  }

  // Deve haver pelo menos 1 disciplina
  const disciplinaMatch = xml.match(/<Disciplina>/gi);
  if (!disciplinaMatch || disciplinaMatch.length === 0) {
    avisos.push('Nenhuma disciplina encontrada no histórico');
  }

  // Validação de estrutura de disciplinas (XSD v1.05 tags)
  const disciplinas = xml.match(/<Disciplina>[\s\S]*?<\/Disciplina>/gi) || [];
  for (let i = 0; i < disciplinas.length; i++) {
    const disc = disciplinas[i];
    if (!disc.includes('<CodigoDisciplina>')) {
      erros.push(`Disciplina ${i + 1}: Campo CodigoDisciplina obrigatório ausente`);
    }
    if (!disc.includes('<NomeDisciplina>')) {
      erros.push(`Disciplina ${i + 1}: Campo NomeDisciplina obrigatório ausente`);
    }
    // XSD v1.05: Situação é representada por <Aprovado>, <Reprovado> ou <Pendente>
    if (!disc.includes('<Aprovado') && !disc.includes('<Reprovado') && !disc.includes('<Pendente')) {
      erros.push(`Disciplina ${i + 1}: Campo de Situação obrigatório ausente (Aprovado/Reprovado/Pendente)`);
    }
  }

  return { valido: erros.length === 0, erros, avisos };
}

/**
 * Valida DocumentacaoAcademicaRegistro (XSD v1.05)
 * Elemento raiz: <DocumentacaoAcademicaRegistro>
 */
export function validarDocAcademicaRegistro(
  xml: string
): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Estrutura básica
  const basica = validarEstruturaBasica(xml);
  erros.push(...basica.erros);
  avisos.push(...basica.avisos);

  // Verifica elemento raiz
  if (!xml.includes('<DocumentacaoAcademicaRegistro')) {
    erros.push('Elemento raiz DocumentacaoAcademicaRegistro não encontrado');
  }

  // Seções obrigatórias
  if (!tagExiste(xml, 'DadosDiploma')) {
    erros.push('Seção DadosDiploma obrigatória ausente');
  }

  if (!tagExiste(xml, 'DadosPrivadosDiplomado')) {
    erros.push('Seção DadosPrivadosDiplomado obrigatória ausente');
  }

  if (!tagExiste(xml, 'HistoricoEscolar')) {
    erros.push('Seção HistoricoEscolar obrigatória ausente');
  }

  // RegistroReq (informações de registro)
  if (!tagExiste(xml, 'RegistroReq')) {
    avisos.push('Seção RegistroReq não encontrada');
  }

  // Filiação dentro de DadosPrivadosDiplomado
  if (!tagExiste(xml, 'Filiacao')) {
    avisos.push('Seção Filiacao não encontrada em DadosPrivadosDiplomado');
  }

  // Validação de IesEmissora e IesRegistradora
  if (tagExiste(xml, 'IesEmissora')) {
    if (!xml.match(/<IesEmissora>[\s\S]*?<CNPJ>[\s\S]*?<\/CNPJ>/)) {
      erros.push('IesEmissora: CNPJ obrigatório ausente');
    }
    if (!xml.match(/<IesEmissora>[\s\S]*?<Nome>[\s\S]*?<\/Nome>/)) {
      erros.push('IesEmissora: Nome obrigatório ausente');
    }
  }

  if (tagExiste(xml, 'IesRegistradora')) {
    if (!xml.match(/<IesRegistradora>[\s\S]*?<CNPJ>[\s\S]*?<\/CNPJ>/)) {
      erros.push('IesRegistradora: CNPJ obrigatório ausente');
    }
  }

  return { valido: erros.length === 0, erros, avisos };
}
