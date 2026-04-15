// @ts-nocheck — Arquivo legado mantido apenas para referência
/**
 * Motor de geração de XMLs do Diploma Digital
 * Conforme Portaria MEC 70/2025 e XSD v1.05
 *
 * NAMESPACE: https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd
 *
 * IMPORTANTE — Papéis Emissora vs Registradora:
 * A FIC (emissora) gera APENAS 2 XMLs:
 *   1. DocumentoHistoricoEscolarFinal — histórico completo com disciplinas
 *   2. DocumentacaoAcademicaRegistro — dados privados + rito de emissão
 *
 * O XML do Diploma é montado pela REGISTRADORA (UFMS) após registro.
 * A função gerarDiplomaDigitalLegado() é mantida para referência e legado,
 * mas NÃO deve ser usada no fluxo de novos diplomas.
 */

import {
  DadosDiploma,
  Disciplina,
  AtividadeComplementar,
  Estagio,
  EnderecoXSD,
  AtoRegulatorio,
  EnadeInfo,
  CargaHorariaComEtiqueta,
  CargaHorariaRelogioComEtiqueta,
  DocenteInfo,
  Genitor,
} from '../tipos';

// ============================================================
// CONSTANTES
// ============================================================

const XSD_NAMESPACE = 'https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const XSD_VERSAO = '1.05';

// ============================================================
// INTERFACE DE SAÍDA
// ============================================================

export interface XMLsGerados {
  /** @deprecated Montado pela registradora — presente apenas para legado */
  diploma_digital: string | null;
  historico_escolar: string;
  doc_academica_registro: string;
}

// ============================================================
// UTILITÁRIOS
// ============================================================

/** Escapa caracteres especiais XML */
function esc(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Retorna tag XML somente se valor existir */
function tagOpc(tag: string, value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '';
  return `<${tag}>${esc(String(value))}</${tag}>`;
}

/** Remove tudo exceto dígitos (CPF, CNPJ, CEP) */
function limparNum(num: string | undefined): string {
  if (!num) return '';
  return num.replace(/\D/g, '');
}

/** Formata data para ISO YYYY-MM-DD */
function fmtData(data: string | undefined): string {
  if (!data) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return data;
}

/** Gera ID com padding de zeros (ex: Dip + 44 dígitos) */
function gerarIdXML(prefixo: string, totalDigitos: number, uuid: string): string {
  // Usa o hash hex do UUID para preencher
  const hex = uuid.replace(/-/g, '');
  const padded = hex.padStart(totalDigitos, '0').slice(0, totalDigitos);
  return `${prefixo}${padded}`;
}

// ============================================================
// BLOCOS COMPARTILHADOS
// ============================================================

/**
 * Gera bloco <Endereco> conforme TEndereco do XSD v1.05
 * Sequence: Logradouro, Numero?, Complemento?, Bairro, GMunicipio(CodigoMunicipio+NomeMunicipio+UF), CEP
 */
function gerarEndereco(end: EnderecoXSD): string {
  return `<Endereco>
      <Logradouro>${esc(end.logradouro)}</Logradouro>
      ${tagOpc('Numero', end.numero)}
      ${tagOpc('Complemento', end.complemento)}
      <Bairro>${esc(end.bairro)}</Bairro>
      <CodigoMunicipio>${limparNum(end.codigo_municipio)}</CodigoMunicipio>
      <NomeMunicipio>${esc(end.nome_municipio)}</NomeMunicipio>
      <UF>${end.uf}</UF>
      <CEP>${limparNum(end.cep)}</CEP>
    </Endereco>`;
}

/**
 * Gera bloco TAtoRegulatorioComOuSemEMEC
 * Sequence: Tipo, Numero, Data, VeiculoPublicacao?, DataPublicacao?, SecaoPublicacao?, PaginaPublicacao?, NumeroDOU?
 */
function gerarAtoRegulatorio(ato: AtoRegulatorio): string {
  return `<Tipo>${esc(ato.tipo)}</Tipo>
      <Numero>${esc(ato.numero)}</Numero>
      <Data>${fmtData(ato.data)}</Data>
      ${tagOpc('VeiculoPublicacao', ato.veiculo_publicacao)}
      ${tagOpc('DataPublicacao', ato.data_publicacao ? fmtData(ato.data_publicacao) : undefined)}
      ${tagOpc('SecaoPublicacao', ato.secao_publicacao)}
      ${tagOpc('PaginaPublicacao', ato.pagina_publicacao)}
      ${tagOpc('NumeroDOU', ato.numero_dou)}`;
}

/**
 * Gera bloco <Diplomado> conforme TDadosDiplomado do XSD v1.05
 * Sequence: ID, GPessoa(Nome,NomeSocial?,Sexo), Nacionalidade, Naturalidade(GMunicipio), CPF, RG|OutroDoc, DataNascimento
 */
function gerarDiplomado(dados: DadosDiploma): string {
  const d = dados.diplomado;

  // Naturalidade — GMunicipio (brasileiro) ou NomeMunicipioEstrangeiro
  const naturalidade = d.naturalidade_municipio_estrangeiro
    ? `<Naturalidade>
        <NomeMunicipioEstrangeiro>${esc(d.naturalidade_municipio_estrangeiro)}</NomeMunicipioEstrangeiro>
      </Naturalidade>`
    : `<Naturalidade>
        <CodigoMunicipio>${limparNum(d.codigo_municipio_ibge)}</CodigoMunicipio>
        <NomeMunicipio>${esc(d.naturalidade_municipio)}</NomeMunicipio>
        <UF>${d.naturalidade_uf}</UF>
      </Naturalidade>`;

  // RG (opcional mas exigido como choice com OutroDocumentoIdentificacao)
  const docIdentificacao = d.rg_numero
    ? `<RG>
        <Numero>${esc(d.rg_numero)}</Numero>
        ${tagOpc('OrgaoExpedidor', d.rg_orgao_expedidor)}
        <UF>${d.rg_uf || ''}</UF>
      </RG>`
    : '';

  return `<Diplomado>
      <ID>${esc(d.ra)}</ID>
      <Nome>${esc(d.nome)}</Nome>
      ${tagOpc('NomeSocial', d.nome_social)}
      <Sexo>${d.sexo}</Sexo>
      <Nacionalidade>${esc(d.nacionalidade)}</Nacionalidade>
      ${naturalidade}
      <CPF>${limparNum(d.cpf)}</CPF>
      ${docIdentificacao}
      <DataNascimento>${fmtData(d.data_nascimento)}</DataNascimento>
    </Diplomado>`;
}

/**
 * Gera bloco <DadosCurso> conforme TDadosCurso do XSD v1.05 (para Diploma)
 * Sequence: NomeCurso, CodigoCursoEMEC, Habilitacao*, Modalidade, TituloConferido, GrauConferido, Enfase*, EnderecoCurso, Autorizacao, Reconhecimento, RenovacaoReconhecimento?
 */
function gerarDadosCurso(dados: DadosDiploma): string {
  const c = dados.curso;

  const habilitacoes = (c.habilitacoes || [])
    .map(h => `<Habilitacao>
        <NomeHabilitacao>${esc(h.nome)}</NomeHabilitacao>
        <DataHabilitacao>${fmtData(h.data)}</DataHabilitacao>
      </Habilitacao>`)
    .join('\n      ');

  // TTituloConferido — escolhe entre Titulo (enum) ou OutroTitulo
  const titulosEnum = ['Licenciado', 'Tecnólogo', 'Bacharel', 'Médico'];
  const tituloTag = titulosEnum.includes(c.titulo_conferido)
    ? `<TituloConferido><Titulo>${esc(c.titulo_conferido)}</Titulo></TituloConferido>`
    : `<TituloConferido><OutroTitulo>${esc(c.titulo_conferido)}</OutroTitulo></TituloConferido>`;

  const endCurso = gerarEndereco(c.endereco).replace('<Endereco>', '<EnderecoCurso>').replace('</Endereco>', '</EnderecoCurso>');

  return `<DadosCurso>
      <NomeCurso>${esc(c.nome)}</NomeCurso>
      <CodigoCursoEMEC>${esc(c.codigo_emec)}</CodigoCursoEMEC>
      ${habilitacoes}
      <Modalidade>${c.modalidade}</Modalidade>
      ${tituloTag}
      <GrauConferido>${esc(c.grau_conferido)}</GrauConferido>
      ${tagOpc('Enfase', c.enfase)}
      ${endCurso}
      <Autorizacao>
        ${gerarAtoRegulatorio(c.autorizacao)}
      </Autorizacao>
      <Reconhecimento>
        ${gerarAtoRegulatorio(c.reconhecimento)}
      </Reconhecimento>
      ${c.renovacao_reconhecimento ? `<RenovacaoReconhecimento>
        ${gerarAtoRegulatorio(c.renovacao_reconhecimento)}
      </RenovacaoReconhecimento>` : ''}
    </DadosCurso>`;
}

/**
 * Gera bloco <DadosCurso> conforme TDadosMinimoCurso (para Histórico Escolar)
 * Sequence: NomeCurso, CodigoCursoEMEC, Habilitacao*, Autorizacao, Reconhecimento, RenovacaoReconhecimento?
 */
function gerarDadosCursoMinimo(dados: DadosDiploma): string {
  const c = dados.curso;

  const habilitacoes = (c.habilitacoes || [])
    .map(h => `<Habilitacao>
        <NomeHabilitacao>${esc(h.nome)}</NomeHabilitacao>
        <DataHabilitacao>${fmtData(h.data)}</DataHabilitacao>
      </Habilitacao>`)
    .join('\n      ');

  return `<DadosCurso>
      <NomeCurso>${esc(c.nome)}</NomeCurso>
      <CodigoCursoEMEC>${esc(c.codigo_emec)}</CodigoCursoEMEC>
      ${habilitacoes}
      <Autorizacao>
        ${gerarAtoRegulatorio(c.autorizacao)}
      </Autorizacao>
      <Reconhecimento>
        ${gerarAtoRegulatorio(c.reconhecimento)}
      </Reconhecimento>
      ${c.renovacao_reconhecimento ? `<RenovacaoReconhecimento>
        ${gerarAtoRegulatorio(c.renovacao_reconhecimento)}
      </RenovacaoReconhecimento>` : ''}
    </DadosCurso>`;
}

/**
 * Gera bloco <IesEmissora> conforme TDadosIesEmissora do XSD v1.05
 * Sequence: Nome, CodigoMEC, CNPJ, Endereco, Credenciamento, Recredenciamento?, RenovacaoDeRecredenciamento?, Mantenedora?
 */
function gerarIesEmissora(dados: DadosDiploma): string {
  const ies = dados.ies;

  const mantenedora = ies.mantenedora
    ? `<Mantenedora>
        <RazaoSocial>${esc(ies.mantenedora.razao_social)}</RazaoSocial>
        <CNPJ>${limparNum(ies.mantenedora.cnpj)}</CNPJ>
        ${gerarEndereco(ies.mantenedora.endereco)}
      </Mantenedora>`
    : '';

  return `<IesEmissora>
      <Nome>${esc(ies.nome)}</Nome>
      <CodigoMEC>${esc(ies.codigo_mec)}</CodigoMEC>
      <CNPJ>${limparNum(ies.cnpj)}</CNPJ>
      ${gerarEndereco(ies.endereco)}
      <Credenciamento>
        ${gerarAtoRegulatorio(ies.credenciamento)}
      </Credenciamento>
      ${ies.recredenciamento ? `<Recredenciamento>
        ${gerarAtoRegulatorio(ies.recredenciamento)}
      </Recredenciamento>` : ''}
      ${ies.renovacao_recredenciamento ? `<RenovacaoDeRecredenciamento>
        ${gerarAtoRegulatorio(ies.renovacao_recredenciamento)}
      </RenovacaoDeRecredenciamento>` : ''}
      ${mantenedora}
    </IesEmissora>`;
}

// ============================================================
// HISTÓRICO ESCOLAR — ELEMENTOS
// ============================================================

/** Gera bloco CargaHoraria com etiqueta */
function gerarCargaHorariaEtiqueta(chs: CargaHorariaComEtiqueta[]): string {
  return chs.map(ch => {
    const inner = ch.tipo === 'HoraAula'
      ? `<HoraAula>${ch.valor}</HoraAula>`
      : `<HoraRelogio>${ch.valor}</HoraRelogio>`;
    return ch.etiqueta
      ? `<CargaHoraria etiqueta="${esc(ch.etiqueta)}">${inner}</CargaHoraria>`
      : `<CargaHoraria>${inner}</CargaHoraria>`;
  }).join('\n          ');
}

/** Gera bloco CargaHorariaEmHoraRelogio com etiqueta */
function gerarCargaHorariaRelogioEtiqueta(chs: CargaHorariaRelogioComEtiqueta[]): string {
  return chs.map(ch =>
    ch.etiqueta
      ? `<CargaHorariaEmHoraRelogio etiqueta="${esc(ch.etiqueta)}">${ch.valor}</CargaHorariaEmHoraRelogio>`
      : `<CargaHorariaEmHoraRelogio>${ch.valor}</CargaHorariaEmHoraRelogio>`
  ).join('\n          ');
}

/** Gera bloco <Docentes> */
function gerarDocentes(docentes: DocenteInfo[]): string {
  if (!docentes || docentes.length === 0) return '<Docentes><Docente><Nome>-</Nome><Titulacao>Graduação</Titulacao></Docente></Docentes>';
  const items = docentes.map(d =>
    `<Docente>
            <Nome>${esc(d.nome)}</Nome>
            <Titulacao>${esc(d.titulacao)}</Titulacao>
            ${tagOpc('Lattes', d.lattes)}
            ${tagOpc('CPF', d.cpf ? limparNum(d.cpf) : undefined)}
          </Docente>`
  ).join('\n          ');
  return `<Docentes>${items}</Docentes>`;
}

/**
 * Gera bloco <Disciplina> conforme TEntradaHistoricoDisciplina
 * Sequence: CodigoDisciplina, NomeDisciplina, PeriodoLetivo, CargaHoraria+, (Nota|Conceito)?, (Aprovado|Pendente|Reprovado), Docentes
 */
function gerarDisciplina(disc: Disciplina): string {
  // Nota / Conceito (choice)
  let notaTag = '';
  if (disc.nota !== undefined && disc.nota !== null) {
    notaTag = `<Nota>${disc.nota.toFixed(2)}</Nota>`;
  } else if (disc.nota_ate_cem !== undefined && disc.nota_ate_cem !== null) {
    notaTag = `<NotaAteCem>${disc.nota_ate_cem.toFixed(2)}</NotaAteCem>`;
  } else if (disc.conceito) {
    notaTag = `<Conceito>${esc(disc.conceito)}</Conceito>`;
  } else if (disc.conceito_rm) {
    notaTag = `<ConceitoRM>${esc(disc.conceito_rm)}</ConceitoRM>`;
  } else if (disc.conceito_especifico) {
    notaTag = `<ConceitoEspecificoDoCurso>${esc(disc.conceito_especifico)}</ConceitoEspecificoDoCurso>`;
  }

  // Situação (choice)
  let situacaoTag = '';
  if (disc.situacao === 'Aprovado') {
    let formaTag = '';
    if (disc.forma_integralizacao) {
      formaTag = `<FormaIntegralizacao>${esc(disc.forma_integralizacao)}</FormaIntegralizacao>`;
    } else if (disc.outra_forma_integralizacao) {
      formaTag = `<OutraFormaIntegralizacao>${esc(disc.outra_forma_integralizacao)}</OutraFormaIntegralizacao>`;
    }
    situacaoTag = formaTag ? `<Aprovado>${formaTag}</Aprovado>` : '<Aprovado/>';
  } else if (disc.situacao === 'Pendente') {
    situacaoTag = '<Pendente/>';
  } else {
    situacaoTag = '<Reprovado/>';
  }

  return `<Disciplina>
          <CodigoDisciplina>${esc(disc.codigo)}</CodigoDisciplina>
          <NomeDisciplina>${esc(disc.nome)}</NomeDisciplina>
          <PeriodoLetivo>${esc(disc.periodo_letivo)}</PeriodoLetivo>
          ${gerarCargaHorariaEtiqueta(disc.carga_horaria)}
          ${notaTag}
          ${situacaoTag}
          ${gerarDocentes(disc.docentes)}
        </Disciplina>`;
}

/** Gera bloco <AtividadeComplementar> conforme TEntradaHistoricoAtividadeComplementar */
function gerarAtividadeComplementar(ac: AtividadeComplementar): string {
  return `<AtividadeComplementar>
          <CodigoAtividadeComplementar>${esc(ac.codigo)}</CodigoAtividadeComplementar>
          <DataInicio>${fmtData(ac.data_inicio)}</DataInicio>
          <DataFim>${fmtData(ac.data_fim)}</DataFim>
          ${tagOpc('DataRegistro', ac.data_registro ? fmtData(ac.data_registro) : undefined)}
          <TipoAtividadeComplementar>${esc(ac.tipo)}</TipoAtividadeComplementar>
          ${tagOpc('Descricao', ac.descricao)}
          ${gerarCargaHorariaRelogioEtiqueta(ac.carga_horaria_relogio)}
          <DocentesResponsaveisPelaValidacao>${gerarDocentes(ac.docentes_validacao).replace('<Docentes>', '').replace('</Docentes>', '')}</DocentesResponsaveisPelaValidacao>
        </AtividadeComplementar>`;
}

/** Gera bloco <Estagio> conforme TEntradaHistoricoEstagio */
function gerarEstagio(est: Estagio): string {
  let concedenteTag = '';
  if (est.concedente) {
    if (est.concedente.tipo === 'PJ') {
      concedenteTag = `<Concedente>
            <RazaoSocial>${esc(est.concedente.razao_social)}</RazaoSocial>
            ${tagOpc('NomeFantasia', est.concedente.nome_fantasia)}
            <CNPJ>${limparNum(est.concedente.cnpj)}</CNPJ>
          </Concedente>`;
    } else {
      concedenteTag = `<Concedente>
            <Nome>${esc(est.concedente.nome)}</Nome>
            <CPF>${limparNum(est.concedente.cpf)}</CPF>
          </Concedente>`;
    }
  }

  return `<Estagio>
          <CodigoUnidadeCurricular>${esc(est.codigo_unidade_curricular)}</CodigoUnidadeCurricular>
          <DataInicio>${fmtData(est.data_inicio)}</DataInicio>
          <DataFim>${fmtData(est.data_fim)}</DataFim>
          ${concedenteTag}
          ${tagOpc('Descricao', est.descricao)}
          ${gerarCargaHorariaRelogioEtiqueta(est.carga_horaria_relogio)}
          <DocentesOrientadores>${gerarDocentes(est.docentes_orientadores).replace('<Docentes>', '').replace('</Docentes>', '')}</DocentesOrientadores>
        </Estagio>`;
}

/** Gera bloco <ENADE> conforme TEnade */
function gerarEnade(infos: EnadeInfo[]): string {
  if (!infos || infos.length === 0) return '<ENADE/>';

  const items = infos.map(e => {
    const inner = `<Condicao>${esc(e.condicao)}</Condicao>
          <Edicao>${esc(e.edicao)}</Edicao>`;

    if (e.tipo === 'Habilitado') {
      return `<Habilitado>${inner}</Habilitado>`;
    } else if (e.tipo === 'Irregular') {
      return `<Irregular>${inner}</Irregular>`;
    } else {
      // NaoHabilitado
      let motivo = '';
      if (e.motivo) motivo = `<Motivo>${esc(e.motivo)}</Motivo>`;
      else if (e.outro_motivo) motivo = `<OutroMotivo>${esc(e.outro_motivo)}</OutroMotivo>`;
      return `<NaoHabilitado>${inner}${motivo}</NaoHabilitado>`;
    }
  }).join('\n        ');

  return `<ENADE>
        ${items}
      </ENADE>`;
}

// ============================================================
// GERAÇÃO DOS XMLs
// ============================================================

/**
 * @deprecated O XML Diploma é montado pela REGISTRADORA (UFMS), não pela emissora.
 * Mantido para referência e importação de diplomas legados.
 */
function gerarDiplomaDigital(dados: DadosDiploma): string {
  const idDip = gerarIdXML('Dip', 44, dados.diploma.id);
  const idVDip = gerarIdXML('VDip', 44, dados.diploma.id);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Diploma xmlns="${XSD_NAMESPACE}"
         xmlns:xsi="${XSI_NAMESPACE}">
  <infDiploma versao="${XSD_VERSAO}" id="${idVDip}" ambiente="Produção">
    <DadosDiploma id="${idDip}">
      ${gerarDiplomado(dados)}
      <DataConclusao>${fmtData(dados.diploma.data_conclusao)}</DataConclusao>
      ${gerarDadosCurso(dados)}
      ${gerarIesEmissora(dados)}
    </DadosDiploma>
  </infDiploma>
</Diploma>`;
}

/**
 * Gera DocumentoHistoricoEscolarFinal — histórico escolar completo
 * Root: <DocumentoHistoricoEscolarFinal> → infHistoricoEscolar(versao, ambiente) → Aluno, DadosCurso, IesEmissora, HistoricoEscolar, SegurancaHistorico
 */
function gerarHistoricoEscolar(dados: DadosDiploma): string {
  const h = dados.historico;

  // ElementosHistorico — sequência de Disciplinas + AtividadesComplementares + Estágios
  const elementosItems: string[] = [];
  for (const disc of h.disciplinas) {
    elementosItems.push(gerarDisciplina(disc));
  }
  if (h.atividades_complementares) {
    for (const ac of h.atividades_complementares) {
      elementosItems.push(gerarAtividadeComplementar(ac));
    }
  }
  if (h.estagios) {
    for (const est of h.estagios) {
      elementosItems.push(gerarEstagio(est));
    }
  }

  // CargaHoraria — TCargaHoraria (choice HoraAula | HoraRelogio)
  const chTag = h.tipo_carga_horaria === 'HoraAula' ? 'HoraAula' : 'HoraRelogio';

  // SituacaoAtualDiscente — para formados
  const sit = h.situacao_discente;
  const situacaoTag = `<SituacaoAtualDiscente>
        <Formado>
          <DataConclusaoCurso>${fmtData(sit.data_conclusao)}</DataConclusaoCurso>
          <DataColacaoGrau>${fmtData(sit.data_colacao_grau)}</DataColacaoGrau>
          <DataExpedicaoDiploma>${fmtData(sit.data_expedicao_diploma)}</DataExpedicaoDiploma>
        </Formado>
      </SituacaoAtualDiscente>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<DocumentoHistoricoEscolarFinal xmlns="${XSD_NAMESPACE}"
                                 xmlns:xsi="${XSI_NAMESPACE}">
  <infHistoricoEscolar versao="${XSD_VERSAO}" ambiente="Produção">
    ${gerarDiplomado(dados).replace('<Diplomado>', '<Aluno>').replace('</Diplomado>', '</Aluno>')}
    ${gerarDadosCursoMinimo(dados)}
    ${gerarIesEmissora(dados)}
    <HistoricoEscolar>
      <CodigoCurriculo>${esc(h.codigo_curriculo)}</CodigoCurriculo>
      <ElementosHistorico>
        ${elementosItems.join('\n        ')}
      </ElementosHistorico>
      <DataEmissaoHistorico>${fmtData(h.data_emissao)}</DataEmissaoHistorico>
      <HoraEmissaoHistorico>${esc(h.hora_emissao)}</HoraEmissaoHistorico>
      ${situacaoTag}
      ${gerarEnade(h.enade)}
      <CargaHorariaCursoIntegralizada><${chTag}>${h.carga_horaria_integralizada}</${chTag}></CargaHorariaCursoIntegralizada>
      <CargaHorariaCurso><${chTag}>${h.carga_horaria_curso}</${chTag}></CargaHorariaCurso>
      <IngressoCurso>
        <Data>${fmtData(h.data_ingresso)}</Data>
        <FormaAcesso>${esc(h.forma_acesso)}</FormaAcesso>
      </IngressoCurso>
    </HistoricoEscolar>
    <SegurancaHistorico>
      <CodigoValidacao>${esc(h.codigo_validacao_historico)}</CodigoValidacao>
    </SegurancaHistorico>
  </infHistoricoEscolar>
</DocumentoHistoricoEscolarFinal>`;
}

/**
 * Gera DocumentacaoAcademicaRegistro — dados privados, enviado à registradora
 * Root: <DocumentacaoAcademicaRegistro> → RegistroReq(versao, id) → DadosDiploma, DadosPrivadosDiplomado, DocumentacaoComprobatoria
 */
function gerarDocAcademicaRegistro(dados: DadosDiploma): string {
  const idReq = gerarIdXML('ReqDip', 44, dados.diploma.id);
  const idDip = gerarIdXML('Dip', 44, dados.diploma.id);
  const h = dados.historico;

  // Filiação — obrigatória
  const filiacaoItems = (dados.diplomado.filiacao || []).map((g: Genitor) =>
    `<Genitor>
            <Nome>${esc(g.nome)}</Nome>
            ${tagOpc('NomeSocial', g.nome_social)}
            <Sexo>${g.sexo}</Sexo>
          </Genitor>`
  ).join('\n          ');
  const filiacaoTag = filiacaoItems
    ? `<Filiacao>${filiacaoItems}</Filiacao>`
    : '<Filiacao><Genitor><Nome>-</Nome><Sexo>F</Sexo></Genitor></Filiacao>';

  // CargaHoraria tipo
  const chTag = h.tipo_carga_horaria === 'HoraAula' ? 'HoraAula' : 'HoraRelogio';

  // ElementosHistorico
  const elementosItems: string[] = [];
  for (const disc of h.disciplinas) {
    elementosItems.push(gerarDisciplina(disc));
  }
  if (h.atividades_complementares) {
    for (const ac of h.atividades_complementares) {
      elementosItems.push(gerarAtividadeComplementar(ac));
    }
  }
  if (h.estagios) {
    for (const est of h.estagios) {
      elementosItems.push(gerarEstagio(est));
    }
  }

  // SituacaoAtualDiscente
  const sit = h.situacao_discente;
  const situacaoTag = `<SituacaoAtualDiscente>
              <Formado>
                <DataConclusaoCurso>${fmtData(sit.data_conclusao)}</DataConclusaoCurso>
                <DataColacaoGrau>${fmtData(sit.data_colacao_grau)}</DataColacaoGrau>
                <DataExpedicaoDiploma>${fmtData(sit.data_expedicao_diploma)}</DataExpedicaoDiploma>
              </Formado>
            </SituacaoAtualDiscente>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<DocumentacaoAcademicaRegistro xmlns="${XSD_NAMESPACE}"
                                xmlns:xsi="${XSI_NAMESPACE}">
  <RegistroReq versao="${XSD_VERSAO}" id="${idReq}" ambiente="Produção">
    <DadosDiploma id="${idDip}">
      ${gerarDiplomado(dados)}
      <DataConclusao>${fmtData(dados.diploma.data_conclusao)}</DataConclusao>
      ${gerarDadosCurso(dados)}
      ${gerarIesEmissora(dados)}
    </DadosDiploma>
    <DadosPrivadosDiplomado>
      ${filiacaoTag}
      <HistoricoEscolar>
        <CodigoCurriculo>${esc(h.codigo_curriculo)}</CodigoCurriculo>
        <ElementosHistorico>
          ${elementosItems.join('\n          ')}
        </ElementosHistorico>
        <DataEmissaoHistorico>${fmtData(h.data_emissao)}</DataEmissaoHistorico>
        <HoraEmissaoHistorico>${esc(h.hora_emissao)}</HoraEmissaoHistorico>
        ${situacaoTag}
        ${gerarEnade(h.enade)}
        <CargaHorariaCursoIntegralizada><${chTag}>${h.carga_horaria_integralizada}</${chTag}></CargaHorariaCursoIntegralizada>
        <CargaHorariaCurso><${chTag}>${h.carga_horaria_curso}</${chTag}></CargaHorariaCurso>
        <IngressoCurso>
          <Data>${fmtData(h.data_ingresso)}</Data>
          <FormaAcesso>${esc(h.forma_acesso)}</FormaAcesso>
        </IngressoCurso>
      </HistoricoEscolar>
    </DadosPrivadosDiplomado>
    <DocumentacaoComprobatoria>
      <Documento tipo="DocumentoIdentidadeDoAluno"></Documento>
    </DocumentacaoComprobatoria>
  </RegistroReq>
</DocumentacaoAcademicaRegistro>`;
}

// ============================================================
// EXPORTS
// ============================================================

/**
 * Gera os XMLs de responsabilidade da EMISSORA (FIC):
 *   1. DocumentoHistoricoEscolarFinal — histórico escolar completo
 *   2. DocumentacaoAcademicaRegistro — dados privados + documentação comprobatória
 *
 * O XML do Diploma NÃO é gerado pela emissora — é montado pela registradora
 * após o registro. O campo diploma_digital retorna null para novos diplomas.
 */
export function gerarXMLs(dados: DadosDiploma): XMLsGerados {
  return {
    diploma_digital: null, // Montado pela registradora (UFMS)
    historico_escolar: gerarHistoricoEscolar(dados),
    doc_academica_registro: gerarDocAcademicaRegistro(dados),
  };
}

/**
 * Gera o XML Diploma apenas para fins de referência ou legado.
 * Em produção, este XML é montado pela REGISTRADORA.
 */
export function gerarDiplomaDigitalLegado(dados: DadosDiploma): string {
  return gerarDiplomaDigital(dados);
}
