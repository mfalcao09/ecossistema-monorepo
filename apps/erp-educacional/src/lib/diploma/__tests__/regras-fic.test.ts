/**
 * Unit tests — regras FIC (comprobatórios obrigatórios).
 *
 * Origem: Sessão 028 Sprint 1 — Plano Técnico v2.
 * Executar com: npx vitest run src/lib/diploma/__tests__/regras-fic.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  avaliarComprobatoriosFIC,
  mensagemFaltanteFIC,
  COMPROBATORIOS_OBRIGATORIOS_FIC,
  type TipoXsdComprobatorio,
  type RegraComprobatorio,
} from '../regras-fic';

describe('COMPROBATORIOS_OBRIGATORIOS_FIC', () => {
  it('tem exatamente 4 regras conforme confirmado por Marcelo (07/04/2026)', () => {
    expect(COMPROBATORIOS_OBRIGATORIOS_FIC).toHaveLength(4);
  });

  it('regras simples: RG + Histórico EM + Título Eleitor', () => {
    const simples = COMPROBATORIOS_OBRIGATORIOS_FIC.filter(
      (r) => r.kind === 'simples',
    );
    expect(simples).toHaveLength(3);
    expect(simples.map((r) => (r.kind === 'simples' ? r.tipo : ''))).toEqual([
      'DocumentoIdentidadeDoAluno',
      'ProvaConclusaoEnsinoMedio',
      'TituloEleitor',
    ]);
  });

  it('regra alternativa: Certidão Nascimento OU Casamento', () => {
    const alternativas = COMPROBATORIOS_OBRIGATORIOS_FIC.filter(
      (r) => r.kind === 'alternativa',
    );
    expect(alternativas).toHaveLength(1);
    const alt = alternativas[0];
    expect(alt.kind).toBe('alternativa');
    if (alt.kind === 'alternativa') {
      expect(alt.tipos.sort()).toEqual(['CertidaoCasamento', 'CertidaoNascimento']);
    }
  });
});

describe('avaliarComprobatoriosFIC', () => {
  it('lista vazia → todas as 4 regras faltantes', () => {
    const r = avaliarComprobatoriosFIC([]);
    expect(r.atendidas).toHaveLength(0);
    expect(r.faltantes).toHaveLength(4);
  });

  it('lista completa com Certidão de Nascimento → 0 faltantes', () => {
    const tipos: TipoXsdComprobatorio[] = [
      'DocumentoIdentidadeDoAluno',
      'ProvaConclusaoEnsinoMedio',
      'CertidaoNascimento',
      'TituloEleitor',
    ];
    const r = avaliarComprobatoriosFIC(tipos);
    expect(r.atendidas).toHaveLength(4);
    expect(r.faltantes).toHaveLength(0);
  });

  it('lista completa com Certidão de Casamento → 0 faltantes (alternativa)', () => {
    const tipos: TipoXsdComprobatorio[] = [
      'DocumentoIdentidadeDoAluno',
      'ProvaConclusaoEnsinoMedio',
      'CertidaoCasamento',
      'TituloEleitor',
    ];
    const r = avaliarComprobatoriosFIC(tipos);
    expect(r.faltantes).toHaveLength(0);
  });

  it('com ambas certidões (nascimento E casamento) → alternativa atendida', () => {
    const tipos: TipoXsdComprobatorio[] = [
      'DocumentoIdentidadeDoAluno',
      'ProvaConclusaoEnsinoMedio',
      'CertidaoNascimento',
      'CertidaoCasamento',
      'TituloEleitor',
    ];
    const r = avaliarComprobatoriosFIC(tipos);
    expect(r.faltantes).toHaveLength(0);
  });

  it('sem RG → 1 faltante (RG)', () => {
    const r = avaliarComprobatoriosFIC([
      'ProvaConclusaoEnsinoMedio',
      'CertidaoNascimento',
      'TituloEleitor',
    ]);
    expect(r.faltantes).toHaveLength(1);
    const falta = r.faltantes[0];
    expect(falta.kind === 'simples' && falta.tipo).toBe('DocumentoIdentidadeDoAluno');
  });

  it('sem certidão (nem nascimento nem casamento) → alternativa faltante', () => {
    const r = avaliarComprobatoriosFIC([
      'DocumentoIdentidadeDoAluno',
      'ProvaConclusaoEnsinoMedio',
      'TituloEleitor',
    ]);
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0].kind).toBe('alternativa');
  });

  it('tipos extras (ex: Outros) não causam erro nem contam', () => {
    const r = avaliarComprobatoriosFIC([
      'DocumentoIdentidadeDoAluno',
      'ProvaConclusaoEnsinoMedio',
      'CertidaoNascimento',
      'TituloEleitor',
      'Outros',
      'ProvaColacao',
    ]);
    expect(r.faltantes).toHaveLength(0);
    expect(r.atendidas).toHaveLength(4);
  });

  it('duplicatas não contam duas vezes', () => {
    const r = avaliarComprobatoriosFIC([
      'DocumentoIdentidadeDoAluno',
      'DocumentoIdentidadeDoAluno',
      'DocumentoIdentidadeDoAluno',
    ]);
    expect(r.atendidas).toHaveLength(1);
    expect(r.faltantes).toHaveLength(3);
  });
});

describe('mensagemFaltanteFIC', () => {
  it('regra simples → mensagem com tipo XSD', () => {
    const regra: RegraComprobatorio = {
      kind: 'simples',
      tipo: 'TituloEleitor',
      nome_amigavel: 'Título de Eleitor',
    };
    const msg = mensagemFaltanteFIC(regra);
    expect(msg).toContain('Título de Eleitor');
    expect(msg).toContain('TituloEleitor');
  });

  it('regra alternativa → mensagem com todos os tipos', () => {
    const regra: RegraComprobatorio = {
      kind: 'alternativa',
      tipos: ['CertidaoNascimento', 'CertidaoCasamento'],
      nome_amigavel: 'Certidão de Nascimento OU Casamento',
    };
    const msg = mensagemFaltanteFIC(regra);
    expect(msg).toContain('CertidaoNascimento');
    expect(msg).toContain('CertidaoCasamento');
  });
});
