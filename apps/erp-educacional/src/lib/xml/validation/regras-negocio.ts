/**
 * Regras de negócio do motor XML — guardrails com suporte a override humano.
 *
 * Princípio fundamental (decisão Marcelo 2026-04-07):
 *   "A confirmação humana pode sobrescrever qualquer regra de negócio."
 *
 * NÃO confundir com validação de schema XSD obrigatório (minOccurs, enum,
 * tipo). Schema XSD não pode ser sobrescrito porque o XML não passa na
 * validação da registradora. Aqui validamos apenas regras semânticas
 * próprias da FIC.
 *
 * Padrão de uso no montador:
 *   const violacoes = avaliarRegrasNegocio(dadosDiploma);
 *   if (violacoes.length > 0) {
 *     throw new ValidacaoNegocioError(violacoes);
 *   }
 *
 * No route handler:
 *   - Captura ValidacaoNegocioError
 *   - Retorna 422 com payload estruturado
 *   - Frontend mostra modal com justificativa obrigatória
 *   - Operador confirma → re-chamada com `overrides` no body
 *   - Route grava em `validacao_overrides` e re-monta com flag `pular_regras`
 */

import type { DadosDiploma } from '../tipos';

/**
 * Códigos das regras de negócio. Convenção SCREAMING_SNAKE_CASE descritivo.
 * Cada código é gravado em validacao_overrides.regra_codigo quando há override.
 */
export const REGRAS_NEGOCIO = {
  CARGA_HORARIA_INTEGRALIZADA_MENOR_QUE_TOTAL:
    'CARGA_HORARIA_INTEGRALIZADA_MENOR_QUE_TOTAL',
  /**
   * DocumentacaoComprobatoria vazia — processo não tem nenhum comprobatório
   * ativo selecionado. Bloqueia geração do XML DocAcademicaRegistro.
   *
   * Esta regra NÃO é avaliada por `avaliarRegrasNegocio` (que olha apenas
   * `DadosDiploma`). É avaliada pelo route handler após carregar os
   * comprobatórios via `obterTodosPdfABase64DoProcesso`. Está listada aqui
   * apenas para que o override passe pelo mesmo fluxo de auditoria
   * (tabela `validacao_overrides`).
   */
  DOCUMENTACAO_COMPROBATORIA_VAZIA: 'DOCUMENTACAO_COMPROBATORIA_VAZIA',
} as const;

export type CodigoRegra =
  (typeof REGRAS_NEGOCIO)[keyof typeof REGRAS_NEGOCIO];

export interface ViolacaoRegra {
  /** Código identificador da regra (vai para validacao_overrides.regra_codigo) */
  codigo: CodigoRegra;
  /** Mensagem em pt-BR para exibir ao operador */
  mensagem: string;
  /** Snapshot dos valores originais (vai para validacao_overrides.valores_originais) */
  valores_originais: Record<string, unknown>;
  /** Severidade — 'erro' bloqueia (com opção de override), 'aviso' apenas alerta */
  severidade: 'erro' | 'aviso';
}

/**
 * Erro lançado pelo montador quando há violações de regra de negócio.
 * O route handler captura e retorna 422 com payload estruturado.
 */
export class ValidacaoNegocioError extends Error {
  public readonly violacoes: ViolacaoRegra[];

  constructor(violacoes: ViolacaoRegra[]) {
    const codigos = violacoes.map((v) => v.codigo).join(', ');
    super(`Validação de regra de negócio falhou: ${codigos}`);
    this.name = 'ValidacaoNegocioError';
    this.violacoes = violacoes;
  }
}

/**
 * Avalia todas as regras de negócio sobre os dados montados.
 * Retorna lista de violações (vazia se tudo OK).
 *
 * @param dados Dados do diploma já montados (saída do montador)
 * @param regrasIgnoradas Lista de códigos de regra a pular (após override aprovado)
 */
export function avaliarRegrasNegocio(
  dados: DadosDiploma,
  regrasIgnoradas: CodigoRegra[] = []
): ViolacaoRegra[] {
  const violacoes: ViolacaoRegra[] = [];

  // ── Regra: carga_horaria_integralizada >= carga_horaria_curso ────────────
  // Justificativa: aluno formado integralizou >= o necessário para colar grau.
  // Bug #H — divergência observada na extração de PDFs antigos da FIC.
  if (
    !regrasIgnoradas.includes(
      REGRAS_NEGOCIO.CARGA_HORARIA_INTEGRALIZADA_MENOR_QUE_TOTAL
    )
  ) {
    const integralizada = dados.historico?.carga_horaria_integralizada ?? 0;
    const total = dados.historico?.carga_horaria_curso ?? 0;

    if (integralizada > 0 && total > 0 && integralizada < total) {
      violacoes.push({
        codigo: REGRAS_NEGOCIO.CARGA_HORARIA_INTEGRALIZADA_MENOR_QUE_TOTAL,
        severidade: 'erro',
        mensagem:
          `Carga horária integralizada (${integralizada}h) é menor que ` +
          `a carga horária total do curso (${total}h). Um aluno formado ` +
          `deveria ter integralizado pelo menos a carga horária mínima ` +
          `do curso. Verifique o histórico ou confirme se há justificativa ` +
          `(grade antiga, dispensa aprovada, etc.).`,
        valores_originais: {
          carga_horaria_integralizada: integralizada,
          carga_horaria_curso: total,
          diferenca: total - integralizada,
        },
      });
    }
  }

  return violacoes;
}
