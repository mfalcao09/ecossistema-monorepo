/**
 * Gate de criação de processo — validação que roda ANTES de transformar
 * uma sessão de extração em um `diploma_processos`.
 *
 * ORIGEM: Sessão 028 — Plano Técnico v2, Seção 9 ("Gates & Overrides").
 *
 * Princípio universal (sessão 022): TODA violação aqui pode ser sobrescrita
 * por um registro em `validacao_overrides` com justificativa humana. Este
 * módulo APENAS detecta violações — a decisão de bloquear ou permitir com
 * override é responsabilidade do orquestrador da API.
 */

import {
  avaliarComprobatoriosFIC,
  mensagemFaltanteFIC,
  type RegraComprobatorio,
  type TipoXsdComprobatorio,
} from './regras-fic';

// -----------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------

/** Código de violação — identificador estável usado pelo frontend e por overrides. */
export type CodigoViolacaoGate =
  | 'FIC_COMPROBATORIO_FALTANDO'
  | 'XSD_CAMPO_OBRIGATORIO'
  | 'PDFA_TAMANHO_INVALIDO'
  | 'DADOS_ALUNO_INCOMPLETOS'
  | 'DISCIPLINAS_AUSENTES';

/** Severidade da violação. */
export type SeveridadeViolacao = 'bloqueante' | 'aviso';

/** Uma violação concreta detectada pelo gate. */
export interface ViolacaoGate {
  codigo: CodigoViolacaoGate;
  severidade: SeveridadeViolacao;
  /** Mensagem amigável (pt-BR) para exibir ao operador. */
  mensagem: string;
  /** Campo/caminho afetado, quando aplicável (ex: 'aluno.cpf', 'disciplinas[3].nota'). */
  campo?: string;
  /** Detalhes extras (livre). */
  detalhes?: Record<string, unknown>;
}

/** Input do gate — tudo o que é necessário para validar. */
export interface InputGateCriacao {
  /** Dados do aluno extraídos (do rascunho da sessão). */
  aluno: {
    nome?: string | null;
    cpf?: string | null;
    rg?: string | null;
    data_nascimento?: string | null;
    naturalidade?: string | null;
    nacionalidade?: string | null;
  };

  /** Disciplinas extraídas (do histórico). */
  disciplinas: Array<{
    codigo?: string | null;
    nome?: string | null;
    carga_horaria?: number | null;
    nota?: number | null;
  }>;

  /** Arquivos anexados com seus destinos (extraído de processo_arquivos). */
  arquivosAnexados: Array<{
    tipo_xsd?: TipoXsdComprobatorio | null;
    destino_xml: boolean;
    destino_acervo: boolean;
    tamanho_bytes: number;
  }>;
}

/** Resultado do gate. */
export interface ResultadoGate {
  /** true se não há nenhuma violação bloqueante. */
  pode_prosseguir: boolean;
  violacoes: ViolacaoGate[];
  /** Só as bloqueantes — atalho para UI. */
  bloqueantes: ViolacaoGate[];
  /** Só as de aviso. */
  avisos: ViolacaoGate[];
  /** Resumo do gate FIC (para UI mostrar check ✅/❌ em cada regra). */
  fic_comprobatorios: {
    atendidas: RegraComprobatorio[];
    faltantes: RegraComprobatorio[];
  };
}

// -----------------------------------------------------------------------
// Limites conhecidos (XSD v1.05 + FIC)
// -----------------------------------------------------------------------

/** Tamanho máximo de PDF/A embutido em base64 no XML (aprox 15MB base64 ~= 11MB raw). */
export const PDFA_TAMANHO_MAX_BYTES = 15 * 1024 * 1024;

/** Tamanho mínimo razoável para não ser arquivo vazio/corrompido. */
export const PDFA_TAMANHO_MIN_BYTES = 1024; // 1 KB

// -----------------------------------------------------------------------
// Validadores atômicos
// -----------------------------------------------------------------------

function validarDadosAluno(
  aluno: InputGateCriacao['aluno'],
): ViolacaoGate[] {
  const violacoes: ViolacaoGate[] = [];
  const camposObrigatorios: Array<[keyof typeof aluno, string]> = [
    ['nome', 'Nome do aluno'],
    ['cpf', 'CPF do aluno'],
    ['data_nascimento', 'Data de nascimento'],
    ['naturalidade', 'Naturalidade'],
    ['nacionalidade', 'Nacionalidade'],
  ];

  for (const [campo, label] of camposObrigatorios) {
    const valor = aluno[campo];
    if (!valor || String(valor).trim() === '') {
      violacoes.push({
        codigo: 'DADOS_ALUNO_INCOMPLETOS',
        severidade: 'bloqueante',
        mensagem: `Campo obrigatório ausente: ${label}`,
        campo: `aluno.${campo}`,
      });
    }
  }

  return violacoes;
}

function validarDisciplinas(
  disciplinas: InputGateCriacao['disciplinas'],
): ViolacaoGate[] {
  const violacoes: ViolacaoGate[] = [];

  if (disciplinas.length === 0) {
    violacoes.push({
      codigo: 'DISCIPLINAS_AUSENTES',
      severidade: 'bloqueante',
      mensagem:
        'Nenhuma disciplina encontrada no histórico. É obrigatório importar o histórico antes de criar o processo.',
    });
    return violacoes;
  }

  disciplinas.forEach((d, idx) => {
    if (!d.nome || d.nome.trim() === '') {
      violacoes.push({
        codigo: 'XSD_CAMPO_OBRIGATORIO',
        severidade: 'bloqueante',
        mensagem: `Disciplina #${idx + 1}: nome ausente`,
        campo: `disciplinas[${idx}].nome`,
      });
    }
    if (d.carga_horaria == null || d.carga_horaria <= 0) {
      violacoes.push({
        codigo: 'XSD_CAMPO_OBRIGATORIO',
        severidade: 'aviso',
        mensagem: `Disciplina #${idx + 1} (${d.nome ?? 'sem nome'}): carga horária ausente ou inválida`,
        campo: `disciplinas[${idx}].carga_horaria`,
      });
    }
  });

  return violacoes;
}

function validarComprobatoriosFIC(
  arquivosAnexados: InputGateCriacao['arquivosAnexados'],
): {
  violacoes: ViolacaoGate[];
  atendidas: RegraComprobatorio[];
  faltantes: RegraComprobatorio[];
} {
  // Todos os arquivos com tipo_xsd definido contam para a regra FIC.
  // A regra FIC é sobre TER o documento — o flag destino_xml controla
  // apenas se o doc vai embutido no XML, que é uma etapa posterior.
  const tiposAnexados = arquivosAnexados
    .filter((a) => a.tipo_xsd)
    .map((a) => a.tipo_xsd as TipoXsdComprobatorio);

  const { atendidas, faltantes } = avaliarComprobatoriosFIC(tiposAnexados);

  const violacoes: ViolacaoGate[] = faltantes.map((regra) => ({
    codigo: 'FIC_COMPROBATORIO_FALTANDO',
    severidade: 'bloqueante',
    mensagem: mensagemFaltanteFIC(regra),
    detalhes: { regra },
  }));

  return { violacoes, atendidas, faltantes };
}

function validarTamanhosPDFA(
  arquivosAnexados: InputGateCriacao['arquivosAnexados'],
): ViolacaoGate[] {
  const violacoes: ViolacaoGate[] = [];

  arquivosAnexados
    .filter((a) => a.destino_xml)
    .forEach((a, idx) => {
      if (a.tamanho_bytes > PDFA_TAMANHO_MAX_BYTES) {
        violacoes.push({
          codigo: 'PDFA_TAMANHO_INVALIDO',
          severidade: 'bloqueante',
          mensagem: `Arquivo #${idx + 1} (${a.tipo_xsd ?? 'sem tipo'}) excede o tamanho máximo de ${PDFA_TAMANHO_MAX_BYTES / 1024 / 1024}MB para embutir no XML.`,
          detalhes: { tamanho_bytes: a.tamanho_bytes, limite: PDFA_TAMANHO_MAX_BYTES },
        });
      }
      if (a.tamanho_bytes < PDFA_TAMANHO_MIN_BYTES) {
        violacoes.push({
          codigo: 'PDFA_TAMANHO_INVALIDO',
          severidade: 'aviso',
          mensagem: `Arquivo #${idx + 1} (${a.tipo_xsd ?? 'sem tipo'}) tem apenas ${a.tamanho_bytes} bytes — pode estar vazio ou corrompido.`,
          detalhes: { tamanho_bytes: a.tamanho_bytes, limite: PDFA_TAMANHO_MIN_BYTES },
        });
      }
    });

  return violacoes;
}

// -----------------------------------------------------------------------
// Gate principal
// -----------------------------------------------------------------------

/**
 * Executa o gate de criação de processo.
 *
 * Ordem de validação:
 *   1. Dados do aluno
 *   2. Disciplinas do histórico
 *   3. Comprobatórios FIC (regra mais estrita que XSD)
 *   4. Tamanhos de PDF/A
 *
 * Retorna TODAS as violações encontradas (não para na primeira).
 */
export function validarGateCriacaoProcesso(
  input: InputGateCriacao,
): ResultadoGate {
  const violacoes: ViolacaoGate[] = [];

  violacoes.push(...validarDadosAluno(input.aluno));
  violacoes.push(...validarDisciplinas(input.disciplinas));

  const fic = validarComprobatoriosFIC(input.arquivosAnexados);
  violacoes.push(...fic.violacoes);

  violacoes.push(...validarTamanhosPDFA(input.arquivosAnexados));

  const bloqueantes = violacoes.filter((v) => v.severidade === 'bloqueante');
  const avisos = violacoes.filter((v) => v.severidade === 'aviso');

  return {
    pode_prosseguir: bloqueantes.length === 0,
    violacoes,
    bloqueantes,
    avisos,
    fic_comprobatorios: {
      atendidas: fic.atendidas,
      faltantes: fic.faltantes,
    },
  };
}
