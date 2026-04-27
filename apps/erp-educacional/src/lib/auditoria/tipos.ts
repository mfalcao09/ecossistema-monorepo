/**
 * Tipos da Auditoria de Requisitos XSD v1.05
 *
 * Antes de gerar os 2 XMLs (HistoricoEscolarDigital + DocumentacaoAcademicaRegistro),
 * o sistema audita todos os campos obrigatórios pelo XSD v1.05 do MEC.
 *
 * Severidades:
 *   critico  → XSD vai rejeitar garantidamente. Gerar XML resultará em arquivo inválido.
 *   aviso    → pode causar rejeição pela registradora, mas não necessariamente falha XSD.
 *   info     → melhora qualidade/completude, mas não bloqueia tecnicamente.
 */

export type Severidade = "critico" | "aviso" | "info";
export type StatusGrupo = "ok" | "com_erros" | "com_avisos" | "sem_dados";

/** Ação sugerida — determina qual botão/link mostrar na UI */
export type AcaoCorrecao =
  | "editar_diplomado" // vai para /diploma/diplomados/[id]/editar
  | "editar_curso" // vai para /cadastro/cursos/[id]/editar
  | "editar_ies" // vai para /diploma/configuracoes
  | "editar_historico" // edita dados do diploma (data ingresso, código currículo...)
  | "preencher_docentes" // abre modal de preenchimento de docentes
  | "adicionar_comprobatorio" // abre gate de comprobatórios
  | "configurar_enade" // configura ENADE do diploma
  | "nenhuma"; // problema estrutural sem ação direta disponível

export interface IssueAuditoria {
  /** Campo ou grupo de campos com problema */
  campo: string;
  /** Mensagem em português claro, para secretária não técnica */
  mensagem: string;
  severidade: Severidade;
  /** Qual ação o botão de correção deve disparar */
  acao: AcaoCorrecao;
  /** Valor atual (para debug / exibição na UI) */
  valor_atual?: unknown;
}

export interface GrupoAuditoria {
  id: GrupoId;
  nome: string;
  descricao: string;
  status: StatusGrupo;
  issues: IssueAuditoria[];
}

export type GrupoId =
  | "diplomado"
  | "filiacao"
  | "curso"
  | "ies"
  | "historico"
  | "comprobatorios";

export interface RespostaAuditoria {
  /** false se houver pelo menos 1 issue crítico */
  pode_gerar_xml: boolean;
  /** ISO timestamp da auditoria (para cache) */
  auditado_em: string;
  grupos: GrupoAuditoria[];
  totais: {
    criticos: number;
    avisos: number;
    infos: number;
    total: number;
  };
  /**
   * Sessão 2026-04-27: quando hidratado do histórico, indica se o diploma
   * foi modificado depois da última auditoria. UI mostra hint suave em vez
   * do alerta "Auditoria não realizada" — o operador decide se re-audita.
   */
  desatualizada?: boolean;
}

// ── Dados de entrada da auditoria ────────────────────────────────────────────

export interface DadosDiplomadoAuditoria {
  id: string;
  nome: string | null;
  cpf: string | null;
  /** Sessão 2026-04-27: RA é obrigatório pelo gerarCodigoValidacaoHistorico
   * (XSD v1.05 IN 05/2024). Se vazio, geração de XML falha mesmo com
   * pode_gerar_xml=true — adicionado check crítico em grupos/diplomado.ts. */
  ra: string | null;
  sexo: string | null;
  nacionalidade: string | null;
  naturalidade_municipio: string | null;
  naturalidade_uf: string | null;
  codigo_municipio_ibge: string | null;
  rg_numero: string | null;
  rg_orgao_expedidor: string | null;
  rg_uf: string | null;
  data_nascimento: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
}

export interface DadosCursoAuditoria {
  id: string;
  nome: string | null;
  codigo_emec: string | null;
  grau: string | null;
  carga_horaria_total: number | null;
  // Autorizacao
  tipo_autorizacao: string | null;
  numero_autorizacao: string | null;
  data_autorizacao: string | null;
  // Reconhecimento
  tipo_reconhecimento: string | null;
  numero_reconhecimento: string | null;
  data_reconhecimento: string | null;
}

export interface DadosIesAuditoria {
  nome: string | null;
  codigo_mec: string | null;
  cnpj: string | null;
  // Endereço
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cep: string | null;
  endereco_municipio: string | null;
  endereco_uf: string | null;
  endereco_codigo_ibge: string | null;
  // Credenciamento
  tipo_credenciamento: string | null;
  numero_credenciamento: string | null;
  data_credenciamento: string | null;
}

export interface DadosDisciplinaAuditoria {
  id: string;
  codigo: string | null;
  nome: string;
  periodo: string | null;
  situacao: string;
  carga_horaria_aula: number | null;
  carga_horaria_relogio: number | null;
  docente_nome: string | null;
  docente_titulacao: string | null;
}

export interface DadosHistoricoAuditoria {
  diploma_id: string;
  codigo_curriculo: string | null;
  data_ingresso: string | null;
  forma_acesso: string | null;
  data_conclusao: string | null;
  data_colacao_grau: string | null;
  data_expedicao: string | null;
  carga_horaria_integralizada: number | null;
  enade_presente: boolean;
  disciplinas: DadosDisciplinaAuditoria[];
}

export interface DadosComprobatorioAuditoria {
  id: string;
  tipo_xsd: string | null;
  arquivo_storage_path: string | null;
  tem_arquivo: boolean;
}

export interface InputAuditoria {
  diplomado: DadosDiplomadoAuditoria;
  curso: DadosCursoAuditoria;
  ies: DadosIesAuditoria;
  historico: DadosHistoricoAuditoria;
  comprobatorios: DadosComprobatorioAuditoria[];
}
