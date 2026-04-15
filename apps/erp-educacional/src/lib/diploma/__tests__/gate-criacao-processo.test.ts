/**
 * Unit tests — gate de criação de processo.
 *
 * Origem: Sessão 028 Sprint 1 — Plano Técnico v2.
 * Executar com: npx vitest run src/lib/diploma/__tests__/gate-criacao-processo.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validarGateCriacaoProcesso,
  PDFA_TAMANHO_MAX_BYTES,
  type InputGateCriacao,
} from '../gate-criacao-processo';

function inputValido(): InputGateCriacao {
  return {
    aluno: {
      nome: 'Fulano de Tal',
      cpf: '12345678900',
      rg: '1234567',
      data_nascimento: '2000-01-01',
      naturalidade: 'Cassilândia/MS',
      nacionalidade: 'Brasileira',
    },
    disciplinas: [
      { codigo: 'DIR001', nome: 'Direito Constitucional', carga_horaria: 80, nota: 9.0 },
      { codigo: 'DIR002', nome: 'Direito Civil I', carga_horaria: 80, nota: 8.5 },
    ],
    arquivosAnexados: [
      {
        tipo_xsd: 'DocumentoIdentidadeDoAluno',
        destino_xml: true,
        destino_acervo: false,
        tamanho_bytes: 200_000,
      },
      {
        tipo_xsd: 'ProvaConclusaoEnsinoMedio',
        destino_xml: true,
        destino_acervo: false,
        tamanho_bytes: 500_000,
      },
      {
        tipo_xsd: 'CertidaoNascimento',
        destino_xml: true,
        destino_acervo: false,
        tamanho_bytes: 150_000,
      },
      {
        tipo_xsd: 'TituloEleitor',
        destino_xml: true,
        destino_acervo: false,
        tamanho_bytes: 100_000,
      },
    ],
  };
}

describe('validarGateCriacaoProcesso — caminho feliz', () => {
  it('input 100% válido → pode_prosseguir = true, zero bloqueantes', () => {
    const r = validarGateCriacaoProcesso(inputValido());
    expect(r.pode_prosseguir).toBe(true);
    expect(r.bloqueantes).toHaveLength(0);
    expect(r.fic_comprobatorios.faltantes).toHaveLength(0);
    expect(r.fic_comprobatorios.atendidas).toHaveLength(4);
  });
});

describe('validarGateCriacaoProcesso — dados do aluno', () => {
  it('sem CPF → bloqueante DADOS_ALUNO_INCOMPLETOS', () => {
    const input = inputValido();
    input.aluno.cpf = null;
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(false);
    const viol = r.bloqueantes.find((v) => v.campo === 'aluno.cpf');
    expect(viol).toBeDefined();
    expect(viol?.codigo).toBe('DADOS_ALUNO_INCOMPLETOS');
  });

  it('string vazia conta como ausente', () => {
    const input = inputValido();
    input.aluno.nome = '   ';
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(false);
    expect(r.bloqueantes.some((v) => v.campo === 'aluno.nome')).toBe(true);
  });

  it('múltiplos campos ausentes → múltiplas violações (não para na primeira)', () => {
    const input = inputValido();
    input.aluno.cpf = null;
    input.aluno.nome = null;
    input.aluno.nacionalidade = null;
    const r = validarGateCriacaoProcesso(input);
    const camposComFalha = r.bloqueantes
      .filter((v) => v.codigo === 'DADOS_ALUNO_INCOMPLETOS')
      .map((v) => v.campo);
    expect(camposComFalha).toContain('aluno.nome');
    expect(camposComFalha).toContain('aluno.cpf');
    expect(camposComFalha).toContain('aluno.nacionalidade');
  });
});

describe('validarGateCriacaoProcesso — disciplinas', () => {
  it('lista vazia → bloqueante DISCIPLINAS_AUSENTES', () => {
    const input = inputValido();
    input.disciplinas = [];
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(false);
    expect(r.bloqueantes.some((v) => v.codigo === 'DISCIPLINAS_AUSENTES')).toBe(true);
  });

  it('disciplina sem nome → bloqueante XSD_CAMPO_OBRIGATORIO', () => {
    const input = inputValido();
    input.disciplinas[0].nome = null;
    const r = validarGateCriacaoProcesso(input);
    expect(r.bloqueantes.some((v) => v.campo === 'disciplinas[0].nome')).toBe(true);
  });

  it('disciplina sem carga horária → aviso, não bloqueante', () => {
    const input = inputValido();
    input.disciplinas[1].carga_horaria = null;
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(true); // outros estão ok
    expect(
      r.avisos.some((v) => v.campo === 'disciplinas[1].carga_horaria'),
    ).toBe(true);
  });
});

describe('validarGateCriacaoProcesso — comprobatórios FIC', () => {
  it('sem RG anexado → bloqueante FIC_COMPROBATORIO_FALTANDO', () => {
    const input = inputValido();
    input.arquivosAnexados = input.arquivosAnexados.filter(
      (a) => a.tipo_xsd !== 'DocumentoIdentidadeDoAluno',
    );
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(false);
    expect(
      r.bloqueantes.some(
        (v) => v.codigo === 'FIC_COMPROBATORIO_FALTANDO' && v.mensagem.includes('RG'),
      ),
    ).toBe(true);
  });

  it('arquivo anexado com destino_xml=false não conta para FIC', () => {
    const input = inputValido();
    const rg = input.arquivosAnexados.find(
      (a) => a.tipo_xsd === 'DocumentoIdentidadeDoAluno',
    )!;
    rg.destino_xml = false;
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(false);
    expect(r.fic_comprobatorios.faltantes).toHaveLength(1);
  });

  it('Certidão de Casamento em vez de Nascimento → atende alternativa', () => {
    const input = inputValido();
    const cert = input.arquivosAnexados.find(
      (a) => a.tipo_xsd === 'CertidaoNascimento',
    )!;
    cert.tipo_xsd = 'CertidaoCasamento';
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(true);
  });
});

describe('validarGateCriacaoProcesso — tamanhos PDF/A', () => {
  it('arquivo > 15MB → bloqueante PDFA_TAMANHO_INVALIDO', () => {
    const input = inputValido();
    input.arquivosAnexados[0].tamanho_bytes = PDFA_TAMANHO_MAX_BYTES + 1;
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(false);
    expect(r.bloqueantes.some((v) => v.codigo === 'PDFA_TAMANHO_INVALIDO')).toBe(true);
  });

  it('arquivo < 1KB → aviso, não bloqueante', () => {
    const input = inputValido();
    input.arquivosAnexados[0].tamanho_bytes = 512;
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(true);
    expect(r.avisos.some((v) => v.codigo === 'PDFA_TAMANHO_INVALIDO')).toBe(true);
  });

  it('arquivo com destino_xml=false não é validado por tamanho', () => {
    const input = inputValido();
    input.arquivosAnexados.push({
      tipo_xsd: null,
      destino_xml: false,
      destino_acervo: true,
      tamanho_bytes: 50 * 1024 * 1024, // 50MB, fora do XML
    });
    const r = validarGateCriacaoProcesso(input);
    expect(r.pode_prosseguir).toBe(true);
  });
});

describe('validarGateCriacaoProcesso — resultado agregado', () => {
  it('bloqueantes + avisos são separados corretamente', () => {
    const input = inputValido();
    input.aluno.cpf = null; // bloqueante
    input.disciplinas[0].carga_horaria = null; // aviso
    const r = validarGateCriacaoProcesso(input);
    expect(r.bloqueantes.length).toBeGreaterThan(0);
    expect(r.avisos.length).toBeGreaterThan(0);
    // total = bloqueantes + avisos
    expect(r.violacoes.length).toBe(r.bloqueantes.length + r.avisos.length);
  });
});
