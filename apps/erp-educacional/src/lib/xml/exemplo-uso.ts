/**
 * Exemplo de uso do motor de geração XML
 * Conforme XSD v1.05 — Portaria MEC 70/2025
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { gerarXMLs } from './gerador';
import { montarDadosDiploma, gerarCodigoValidacaoHistorico } from './montador';
import {
  validarDiplomaDigital,
  validarHistoricoEscolar,
  validarDocAcademicaRegistro,
} from './validador';
import { DadosDiploma } from './tipos';

/**
 * Exemplo 1: Gerar XMLs a partir de um diploma no banco
 */
export async function gerarXMLsPorDiploma(
  supabase: SupabaseClient,
  diplomaId: string
) {
  try {
    // 1. Busca e monta dados
    console.log('Montando dados do diploma...');
    const dadosDiploma = await montarDadosDiploma(supabase, diplomaId);

    // 2. Gera os 2 XMLs (FIC é emissora, não registradora)
    console.log('Gerando XMLs...');
    const xmls = gerarXMLs(dadosDiploma);

    // 3. Valida cada XML
    console.log('Validando XMLs...');

    if (!xmls.historico_escolar || !xmls.doc_academica_registro) {
      throw new Error('Falha ao gerar um ou mais XMLs — resultado nulo');
    }

    const validHistorico = validarHistoricoEscolar(xmls.historico_escolar);
    const validDocAcad = validarDocAcademicaRegistro(xmls.doc_academica_registro);

    // 4. Log dos resultados
    console.log('\n=== DocumentoHistoricoEscolarFinal ===');
    console.log(`Válido: ${validHistorico.valido}`);
    if (validHistorico.erros.length > 0) {
      console.error('Erros:', validHistorico.erros);
    }

    console.log('\n=== DocumentacaoAcademicaRegistro ===');
    console.log(`Válido: ${validDocAcad.valido}`);
    if (validDocAcad.erros.length > 0) {
      console.error('Erros:', validDocAcad.erros);
    }

    if (validHistorico.valido && validDocAcad.valido) {
      return xmls;
    } else {
      throw new Error('Um ou mais XMLs contêm erros de validação');
    }
  } catch (error) {
    console.error('Erro ao gerar XMLs:', error);
    throw error;
  }
}

/**
 * Exemplo 2: Salvar XMLs em arquivo (Node.js)
 */
export async function salvarXMLsEmArquivos(
  xmls: ReturnType<typeof gerarXMLs>,
  diplomaId: string,
  diretorio: string = './xmls'
) {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseFilename = `diploma_${diplomaId}_${timestamp}`;

  console.log(`Salvando XMLs em ${diretorio}:`);
  console.log(`  - ${baseFilename}_historico_escolar.xml`);
  console.log(`  - ${baseFilename}_doc_academica_registro.xml`);

  return {
    historico_escolar: `${baseFilename}_historico_escolar.xml`,
    doc_academica_registro: `${baseFilename}_doc_academica_registro.xml`,
  };
}

/**
 * Exemplo 3: Gerar código de validação do histórico (SHA256 Anexo III IN 05)
 * O código do DIPLOMA é gerado pela registradora — não temos função para isso.
 */
export function exemploGerarCodigos() {
  console.log('Código de validação do histórico (exemplo):');
  const codigo = gerarCodigoValidacaoHistorico({
    ra: '202400001',
    cpf: '12345678909',
    codigoCursoEMEC: '123456',
    cnpjEmissora: '12345678000190',
    codigoMecEmissora: '1606',
    dataEmissaoHistorico: '2026-04-06',
    horaEmissaoHistorico: '14:30',
  });
  console.log(`  ${codigo}`);
}

/**
 * Exemplo 4: Validar um XML manualmente
 */
export function validarXMLManual(xmlContent: string) {
  console.log('Validando XML...\n');

  const resultado = validarHistoricoEscolar(xmlContent);

  if (resultado.valido) {
    console.log('✓ XML é válido');
  } else {
    console.error('✗ XML contém erros:');
    resultado.erros.forEach((erro) => console.error(`  - ${erro}`));
  }

  if (resultado.avisos.length > 0) {
    console.warn('\nAvisos:');
    resultado.avisos.forEach((aviso) => console.warn(`  - ${aviso}`));
  }

  return resultado;
}

/**
 * Exemplo 5: Criar dados manualmente para testes (sem banco)
 * Conforme interface DadosDiploma do XSD v1.05
 */
export function exemploMontarDadosManual(): DadosDiploma {
  return {
    diplomado: {
      ra: 'RA202501001',
      nome: 'João Silva Santos',
      sexo: 'M',
      nacionalidade: 'Brasileira',
      codigo_municipio_ibge: '3550308',
      naturalidade_municipio: 'São Paulo',
      naturalidade_uf: 'SP',
      cpf: '12345678901',
      data_nascimento: '1995-05-15',
      rg_numero: '123456789',
      rg_orgao_expedidor: 'SSP',
      rg_uf: 'SP',
      filiacao: [
        { nome: 'Maria Silva', sexo: 'F' },
        { nome: 'Pedro Santos', sexo: 'M' },
      ],
    },

    curso: {
      nome: 'Enfermagem',
      codigo_emec: '12345',
      modalidade: 'Presencial',
      titulo_conferido: 'Bacharel em Enfermagem',
      grau_conferido: 'Bacharelado',
      endereco: {
        logradouro: 'Avenida Principal',
        numero: '123',
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
        logradouro: 'Avenida Principal',
        numero: '123',
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
      id: 'uuid-1234-5678-9012',
      // Em produção, o código do diploma é gerado pela registradora (UFMS)
      codigo_validacao: '',
      data_colacao_grau: '2025-12-15',
      data_conclusao: '2025-12-10',
      // Bug #E (Onda 2 / Caminho C): data_expedicao removida do tipo —
      // DataExpedicaoDiploma é derivada automaticamente no histórico builder.
    },

    historico: {
      codigo_curriculo: 'ENF-2021',
      codigo_validacao_historico: gerarCodigoValidacaoHistorico({
        ra: '202100001',
        cpf: '12345678909',
        codigoCursoEMEC: '123456',
        cnpjEmissora: '12345678000190',
        codigoMecEmissora: '1606',
        dataEmissaoHistorico: '2025-12-15',
        horaEmissaoHistorico: '10:00',
      }),
      data_emissao: '2025-12-15',
      hora_emissao: '10:00:00',
      carga_horaria_curso: 4000,
      carga_horaria_integralizada: 4000,
      tipo_carga_horaria: 'HoraRelogio',
      data_ingresso: '2021-02-01',
      forma_acesso: 'Enem',
      situacao_discente: {
        tipo: 'Formado',
        data_conclusao: '2025-12-10',
        data_colacao_grau: '2025-12-15',
      },
      disciplinas: [
        {
          codigo: 'ENF001',
          nome: 'Fundamentos de Enfermagem',
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
              nome: 'Dr. Carlos Silva',
              titulacao: 'Doutorado',
              cpf: '98765432100',
            },
          ],
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
      {
        nome: 'FIC - Faculdades Integradas de Cassilândia',
        cpf: '03051773000102',
        cargo: 'Institucional',
        tipo_certificado: 'eCNPJ',
        ordem_assinatura: 3,
      },
    ],
  };
}
