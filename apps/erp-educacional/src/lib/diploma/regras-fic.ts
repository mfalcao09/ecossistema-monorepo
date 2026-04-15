/**
 * Regras de negócio específicas da FIC (Faculdades Integradas de Cassilândia).
 *
 * ORIGEM: Sessão 028 — Plano Técnico v2, seção 5 + 9 (gate de criação de processo).
 * Motivo: FIC é MAIS ESTRITA que o XSD v1.05. O XSD exige no mínimo 1 documento
 * comprobatório; a FIC exige obrigatoriamente 4 tipos (ou 3 + alternativa).
 *
 * Princípio universal (sessão 022): toda regra aqui pode ser sobrescrita por
 * `validacao_overrides` com justificativa humana.
 */

/** Tipos XSD v1.05 válidos para <Documento> comprobatório. */
export const TIPOS_XSD_COMPROBATORIO = [
  'DocumentoIdentidadeDoAluno',
  'ProvaConclusaoEnsinoMedio',
  'ProvaColacao',
  'ComprovacaoEstagioCurricular',
  'CertidaoNascimento',
  'CertidaoCasamento',
  'TituloEleitor',
  'AtoNaturalizacao',
  'Outros',
] as const;

export type TipoXsdComprobatorio = (typeof TIPOS_XSD_COMPROBATORIO)[number];

/**
 * Regra de comprobatório FIC.
 * - `simples`: exige exatamente o `tipo`.
 * - `alternativa`: exige pelo menos UM dos `tipos`.
 */
export type RegraComprobatorio =
  | {
      kind: 'simples';
      tipo: TipoXsdComprobatorio;
      nome_amigavel: string;
    }
  | {
      kind: 'alternativa';
      tipos: TipoXsdComprobatorio[];
      nome_amigavel: string;
    };

/**
 * LISTA OFICIAL de comprobatórios obrigatórios da FIC.
 * Confirmado por Marcelo em 07/04/2026:
 *   1. RG (DocumentoIdentidadeDoAluno)
 *   2. Histórico do Ensino Médio (ProvaConclusaoEnsinoMedio)
 *   3. Certidão de Nascimento OU Casamento (alternativa)
 *   4. Título de Eleitor (TituloEleitor)
 */
export const COMPROBATORIOS_OBRIGATORIOS_FIC: RegraComprobatorio[] = [
  {
    kind: 'simples',
    tipo: 'DocumentoIdentidadeDoAluno',
    nome_amigavel: 'RG do aluno',
  },
  {
    kind: 'simples',
    tipo: 'ProvaConclusaoEnsinoMedio',
    nome_amigavel: 'Histórico do Ensino Médio',
  },
  {
    kind: 'alternativa',
    tipos: ['CertidaoNascimento', 'CertidaoCasamento'],
    nome_amigavel: 'Certidão de Nascimento OU Casamento',
  },
  {
    kind: 'simples',
    tipo: 'TituloEleitor',
    nome_amigavel: 'Título de Eleitor',
  },
];

/**
 * Verifica quais regras FIC estão atendidas dado um conjunto de tipos
 * anexados ao processo (lista de `tipo_xsd` de `processo_arquivos`
 * com `destino_xml = true`).
 *
 * @param tiposAnexados — lista de tipos XSD já anexados com destino XML
 * @returns objeto com `atendidas` e `faltantes` (subset de COMPROBATORIOS_OBRIGATORIOS_FIC)
 */
export function avaliarComprobatoriosFIC(tiposAnexados: TipoXsdComprobatorio[]): {
  atendidas: RegraComprobatorio[];
  faltantes: RegraComprobatorio[];
} {
  const setAnexados = new Set(tiposAnexados);
  const atendidas: RegraComprobatorio[] = [];
  const faltantes: RegraComprobatorio[] = [];

  for (const regra of COMPROBATORIOS_OBRIGATORIOS_FIC) {
    const ok =
      regra.kind === 'simples'
        ? setAnexados.has(regra.tipo)
        : regra.tipos.some((t) => setAnexados.has(t));
    (ok ? atendidas : faltantes).push(regra);
  }

  return { atendidas, faltantes };
}

/**
 * Helper para mensagem amigável quando uma regra está faltando.
 */
export function mensagemFaltanteFIC(regra: RegraComprobatorio): string {
  if (regra.kind === 'simples') {
    return `Falta: ${regra.nome_amigavel} (tipo XSD: ${regra.tipo})`;
  }
  return `Falta: ${regra.nome_amigavel} (um dos tipos: ${regra.tipos.join(' ou ')})`;
}
