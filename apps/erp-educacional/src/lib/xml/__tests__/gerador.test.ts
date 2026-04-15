/**
 * Testes unitários do gerador XML
 * Conforme XSD v1.05 — Portaria MEC 70/2025
 * Pode ser executado com Vitest ou Jest
 */

import { gerarXMLs, type XMLsGerados } from '../gerador';
import {
  validarDiplomaDigital,
  validarHistoricoEscolar,
  validarDocAcademicaRegistro,
} from '../validador';
import { DadosDiploma } from '../tipos';
import { gerarCodigoValidacao, gerarCodigoValidacaoHistorico } from '../montador';
import type { DocumentoComprobatorioParaXml } from '@/lib/pdfa/converter-service';

// ── Mock de documento comprobatório (PDF/A fake para testes unitários) ──────
// Bug #F: `gerarXMLs` passou a exigir ao menos 1 documento (XSD minOccurs=1).
// Em testes unitários usamos um payload mínimo válido sem chamar o microserviço.
const mockDocumento: DocumentoComprobatorioParaXml = {
  ddc_id: '00000000-0000-0000-0000-000000000001',
  tipo_xsd: 'DocumentoIdentidadeDoAluno',
  observacao: null,
  pdfa: {
    base64: 'JVBERi0xLjQ=', // "%" em base64 — header mínimo de PDF fictício
    tamanho_bytes: 8,
    sha256: 'abc123def456',
    validation_ok: true,
    validation_errors: [],
    cached: false,
  },
  metadata_interna: {
    numero_documento: '123456789',
    orgao_emissor: 'SSP',
    uf_emissor: 'SP',
    data_expedicao: '2020-01-01',
  },
};
// Tupla [T, ...T[]] satisfaz DocumentosComprobatoriosNonEmpty
const mockDocumentos = [mockDocumento] as const;

// Dados de teste conforme DadosDiploma XSD v1.05
const dadosTeste: DadosDiploma = {
  diplomado: {
    ra: 'RA202401234',
    nome: 'Maria Oliveira Santos',
    sexo: 'F',
    nacionalidade: 'Brasileira',
    codigo_municipio_ibge: '3550308',
    naturalidade_municipio: 'São Paulo',
    naturalidade_uf: 'SP',
    cpf: '12345678901',
    data_nascimento: '1998-03-20',
    rg_numero: '123456789',
    rg_orgao_expedidor: 'SSP',
    rg_uf: 'SP',
    filiacao: [
      { nome: 'Ana Silva', sexo: 'F' },
      { nome: 'Carlos Santos', sexo: 'M' },
    ],
  },

  curso: {
    nome: 'Administração',
    codigo_emec: '11111',
    modalidade: 'Presencial',
    titulo_conferido: 'Bacharel em Administração',
    grau_conferido: 'Bacharelado',
    endereco: {
      logradouro: 'Avenida Brasil',
      numero: '1000',
      bairro: 'Centro',
      codigo_municipio: '5002902',
      nome_municipio: 'Cassilândia',
      uf: 'MS',
      cep: '79540000',
    },
    autorizacao: {
      tipo: 'Portaria',
      numero: '100',
      data: '2010-03-15',
      veiculo_publicacao: 'DOU',
      data_publicacao: '2010-03-20',
      secao_publicacao: '1',
      pagina_publicacao: '45',
    },
    reconhecimento: {
      tipo: 'Portaria',
      numero: '200',
      data: '2015-06-10',
      veiculo_publicacao: 'DOU',
      data_publicacao: '2015-06-15',
      secao_publicacao: '1',
      pagina_publicacao: '30',
    },
  },

  ies: {
    nome: 'Faculdades Integradas de Cassilândia',
    codigo_mec: '1606',
    cnpj: '03051773000102',
    endereco: {
      logradouro: 'Avenida Brasil',
      numero: '1000',
      bairro: 'Centro',
      codigo_municipio: '5002902',
      nome_municipio: 'Cassilândia',
      uf: 'MS',
      cep: '79540000',
    },
    credenciamento: {
      tipo: 'Portaria',
      numero: '70',
      data: '2000-01-15',
      veiculo_publicacao: 'DOU',
      data_publicacao: '2000-01-20',
      secao_publicacao: '1',
      pagina_publicacao: '10',
    },
  },

  ies_registradora: {
    nome: 'Universidade Federal de Mato Grosso do Sul',
    codigo_mec: '588',
    cnpj: '15461510000133',
  },

  diploma: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    // codigo_validacao é OPCIONAL e emitido pela REGISTRADORA — nunca pela emissora
    // (gerarCodigoValidacao() foi depreciada — commit 0c25a58)
    data_colacao_grau: '2025-12-15',
    data_conclusao: '2025-11-30',
    data_expedicao: '2025-12-20',
  },

  historico: {
    codigo_curriculo: 'ADM-2021',
    codigo_validacao_historico: gerarCodigoValidacaoHistorico({
      ra: 'RA202401234',
      cpf: '12345678901',
      codigoCursoEMEC: '11111',
      cnpjEmissora: '03051773000102',
      codigoMecEmissora: '1606',
      dataEmissaoHistorico: '2025-12-20',
      horaEmissaoHistorico: '14:30',
    }),
    data_emissao: '2025-12-20',
    hora_emissao: '14:30:00',
    carga_horaria_curso: 3000,
    carga_horaria_integralizada: 3000,
    tipo_carga_horaria: 'HoraRelogio',
    data_ingresso: '2021-02-01',
    forma_acesso: 'Enem',
    situacao_discente: {
      tipo: 'Formado',
      data_conclusao: '2025-11-30',
      data_colacao_grau: '2025-12-15',
      data_expedicao_diploma: '2025-12-20',
    },
    disciplinas: [
      {
        codigo: 'ADM001',
        nome: 'Introdução à Administração',
        periodo_letivo: '2021/1',
        carga_horaria: [
          { tipo: 'HoraRelogio', valor: 50 },
          { tipo: 'HoraAula', valor: 60 },
        ],
        nota: 8.5,
        situacao: 'Aprovado',
        forma_integralizacao: 'Cursado',
        docentes: [
          {
            nome: 'Prof. Dr. Roberto Lima',
            titulacao: 'Doutorado',
            cpf: '98765432109',
          },
        ],
      },
      {
        codigo: 'ADM002',
        nome: 'Gestão de Recursos Humanos',
        periodo_letivo: '2021/2',
        carga_horaria: [
          { tipo: 'HoraRelogio', valor: 50 },
          { tipo: 'HoraAula', valor: 60 },
        ],
        nota: 9.0,
        situacao: 'Aprovado',
        forma_integralizacao: 'Cursado',
        docentes: [],
      },
      {
        codigo: 'ADM003',
        nome: 'Gestão Financeira',
        periodo_letivo: '2022/1',
        carga_horaria: [
          { tipo: 'HoraRelogio', valor: 50 },
          { tipo: 'HoraAula', valor: 60 },
        ],
        nota: 7.8,
        situacao: 'Aprovado',
        forma_integralizacao: 'Cursado',
        docentes: [],
      },
    ],
    enade: [
      {
        tipo: 'Habilitado',
        condicao: 'Concluinte',
        edicao: '2024',
      },
    ],
  },

  assinantes: [
    {
      nome: 'Prof. Dr. Antonio Oliveira',
      cpf: '11122233344',
      cargo: 'Diretor Geral',
      tipo_certificado: 'eCPF',
      ordem_assinatura: 1,
    },
    {
      nome: 'Profa. Dra. Fernanda Costa',
      cpf: '55566677788',
      cargo: 'Secretária Acadêmica',
      tipo_certificado: 'eCPF',
      ordem_assinatura: 2,
    },
  ],
};

describe('Gerador XML — XSD v1.05', () => {
  describe('gerarXMLs', () => {
    it('deve gerar os XMLs sem erros', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);

      expect(xmls.historico_escolar).toBeDefined();
      expect(xmls.doc_academica_registro).toBeDefined();

      expect(typeof xmls.historico_escolar).toBe('string');
      expect(typeof xmls.doc_academica_registro).toBe('string');
    });

    it('DocumentoHistoricoEscolarFinal deve conter elementos raiz corretos', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);

      expect(xmls.historico_escolar).toContain('<?xml');
      expect(xmls.historico_escolar).toContain('DocumentoHistoricoEscolarFinal');
      expect(xmls.historico_escolar).toContain(
        'https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd'
      );
      expect(xmls.historico_escolar).toContain('versao="1.05"');
    });

    it('DocumentacaoAcademicaRegistro deve conter elementos raiz corretos', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);

      expect(xmls.doc_academica_registro).toContain('<?xml');
      expect(xmls.doc_academica_registro).toContain(
        'DocumentacaoAcademicaRegistro'
      );
      expect(xmls.doc_academica_registro).toContain('versao="1.05"');
    });

    it('Histórico deve conter dados do aluno', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);

      expect(xmls.historico_escolar).toContain('Maria Oliveira Santos');
      expect(xmls.historico_escolar).toContain('12345678901');
      expect(xmls.historico_escolar).toContain('1998-03-20');
    });

    it('Histórico deve conter todas as disciplinas', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);

      expect(xmls.historico_escolar).toContain('Introdução à Administração');
      expect(xmls.historico_escolar).toContain('Gestão de Recursos Humanos');
      expect(xmls.historico_escolar).toContain('Gestão Financeira');
    });

    it('deve escapar caracteres XML especiais', () => {
      const dadosComCaracteres: DadosDiploma = {
        ...dadosTeste,
        diplomado: {
          ...dadosTeste.diplomado,
          nome: 'João & Maria <Silva>',
        },
      };

      const xmls = gerarXMLs(dadosComCaracteres, mockDocumentos);

      expect(xmls.historico_escolar).toContain('João &amp; Maria &lt;Silva&gt;');
      expect(xmls.historico_escolar).not.toContain('João & Maria <Silva>');
    });

    it('deve conter ENADE no histórico', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);
      expect(xmls.historico_escolar).toContain('<ENADE>');
      expect(xmls.historico_escolar).toContain('Habilitado');
    });

    it('deve conter SituacaoAtualDiscente no histórico', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);
      expect(xmls.historico_escolar).toContain('<SituacaoAtualDiscente>');
      expect(xmls.historico_escolar).toContain('Formado');
    });

    it('deve conter CargaHoraria no histórico', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);
      expect(xmls.historico_escolar).toContain('<CargaHorariaCurso>');
      expect(xmls.historico_escolar).toContain('3000');
    });
  });
});

describe('Validador XML — XSD v1.05', () => {
  describe('validarHistoricoEscolar', () => {
    it('deve validar histórico correto como válido', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);
      const resultado = validarHistoricoEscolar(xmls.historico_escolar);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros.length).toBe(0);
    });

    it('deve advertir se não houver disciplinas', () => {
      const xmlsVazio = gerarXMLs({
        ...dadosTeste,
        historico: {
          ...dadosTeste.historico,
          disciplinas: [],
        },
      }, mockDocumentos);

      const resultado = validarHistoricoEscolar(xmlsVazio.historico_escolar);
      expect(resultado.avisos.some((a) => a.includes('disciplina'))).toBe(true);
    });
  });

  describe('validarDocAcademicaRegistro', () => {
    it('deve validar documentação acadêmica correta como válida', () => {
      const xmls = gerarXMLs(dadosTeste, mockDocumentos);
      const resultado = validarDocAcademicaRegistro(xmls.doc_academica_registro);

      expect(resultado.valido).toBe(true);
      expect(resultado.erros.length).toBe(0);
    });
  });
});

describe('Utilitários', () => {
  describe('gerarCodigoValidacao — DEPRECIADA', () => {
    // Commit 0c25a58: código do diploma é emitido pela REGISTRADORA, não pela emissora.
    // A função foi depreciada para evitar uso acidental. Testa-se aqui que ela lança.
    it('deve lançar erro indicando que é função da registradora', () => {
      expect(() => gerarCodigoValidacao()).toThrow(
        'gerarCodigoValidacao() está depreciado'
      );
    });
  });

  describe('gerarCodigoValidacaoHistorico', () => {
    const paramsBase = {
      ra: 'RA202401234',
      cpf: '12345678901',
      codigoCursoEMEC: '11111',
      cnpjEmissora: '03051773000102',
      codigoMecEmissora: '1606', // FIC — Faculdades Integradas de Cassilândia
      dataEmissaoHistorico: '2025-12-20',
      horaEmissaoHistorico: '14:30',
    };

    it('deve gerar código determinístico (mesmos params = mesmo código)', () => {
      const codigo1 = gerarCodigoValidacaoHistorico(paramsBase);
      const codigo2 = gerarCodigoValidacaoHistorico(paramsBase);
      expect(codigo1).toBe(codigo2); // SHA256 é determinístico
    });

    it('deve gerar código diferente para RAs diferentes', () => {
      const codigo1 = gerarCodigoValidacaoHistorico(paramsBase);
      const codigo2 = gerarCodigoValidacaoHistorico({ ...paramsBase, ra: 'RA999999999' });
      expect(codigo1).not.toBe(codigo2);
    });

    it('deve gerar código no formato codigoMEC.hex12', () => {
      const codigo = gerarCodigoValidacaoHistorico(paramsBase);
      // formato: "1606.XXXXXXXXXXXX" (codigoMEC da FIC = 1606)
      expect(codigo).toMatch(/^\d+\.[0-9a-f]{12}$/);
    });

    it('deve lançar erro se RA for vazio', () => {
      expect(() =>
        gerarCodigoValidacaoHistorico({ ...paramsBase, ra: '' })
      ).toThrow('obrigatórios');
    });
  });
});
