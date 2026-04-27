/**
 * Builder do Histórico Escolar — THistoricoEscolar do XSD v1.05
 *
 * Contém os sub-builders para:
 * - Disciplinas (TEntradaHistoricoDisciplina)
 * - Atividades Complementares (TEntradaHistoricoAtividadeComplementar)
 * - Estágios (TEntradaHistoricoEstagio)
 * - ENADE (TEnade)
 * - Situação do Discente
 * - Carga Horária
 * - Ingresso no Curso
 */

import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import {
  DadosDiploma,
  Disciplina,
  AtividadeComplementar,
  Estagio,
  EnadeInfo,
  CargaHorariaComEtiqueta,
  CargaHorariaRelogioComEtiqueta,
  DocenteInfo,
} from "../tipos";
import { fmtData, eleOpc, gerarDataExpedicaoXML } from "./base.builder";
import { limparNum } from "./base.builder";

// ============================================================
// ENUM DE VALIDAÇÃO — TConceito (XSD v1.05 tiposBasicos)
// ============================================================
// Disciplinas de estágio ou atividades podem chegar com conceito
// "Cumpriu", "Aprovado" etc. — valores não reconhecidos pelo enum
// TConceitoAvaliacao do XSD. Nesses casos, o builder rota para
// <ConceitoEspecificoDoCurso> (TString50), que aceita texto livre.
const CONCEITOS_VALIDOS = new Set([
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "E+",
  "E",
  "E-",
  "F+",
  "F",
  "F-",
]);

// ============================================================
// SUB-BUILDERS
// ============================================================

/** Adiciona bloco <Docentes> ou docentes inline */
function buildDocentes(
  parent: XMLBuilder,
  docentes: DocenteInfo[],
  wrapperTag?: string,
): void {
  const wrapper = wrapperTag ? parent.ele(wrapperTag) : parent.ele("Docentes");

  if (!docentes || docentes.length === 0) {
    // XSD exige ao menos 1 docente — placeholder
    const doc = wrapper.ele("Docente");
    doc.ele("Nome").txt("-");
    doc.ele("Titulacao").txt("Graduação");
    return;
  }

  for (const d of docentes) {
    const doc = wrapper.ele("Docente");
    doc.ele("Nome").txt(d.nome || "");
    doc.ele("Titulacao").txt(d.titulacao || "Graduação");
    eleOpc(doc, "Lattes", d.lattes);
    eleOpc(doc, "CPF", d.cpf ? limparNum(d.cpf) : undefined);
  }
}

/** Adiciona blocos <CargaHoraria> com etiqueta */
function buildCargaHorariaEtiqueta(
  parent: XMLBuilder,
  chs: CargaHorariaComEtiqueta[],
): void {
  for (const ch of chs) {
    const chNode = parent.ele("CargaHoraria");
    if (ch.etiqueta) {
      chNode.att("etiqueta", ch.etiqueta);
    }
    if (ch.tipo === "HoraAula") {
      chNode.ele("HoraAula").txt(String(ch.valor));
    } else {
      chNode.ele("HoraRelogio").txt(String(ch.valor));
    }
  }
}

/** Adiciona blocos <CargaHorariaEmHoraRelogio> com etiqueta */
function buildCargaHorariaRelogioEtiqueta(
  parent: XMLBuilder,
  chs: CargaHorariaRelogioComEtiqueta[],
): void {
  for (const ch of chs) {
    const chNode = parent.ele("CargaHorariaEmHoraRelogio");
    if (ch.etiqueta) {
      chNode.att("etiqueta", ch.etiqueta);
    }
    chNode.txt(String(ch.valor));
  }
}

/** Adiciona bloco <Disciplina> — TEntradaHistoricoDisciplina */
function buildDisciplina(parent: XMLBuilder, disc: Disciplina): void {
  const disciplina = parent.ele("Disciplina");

  disciplina.ele("CodigoDisciplina").txt(disc.codigo || "");
  disciplina.ele("NomeDisciplina").txt(disc.nome || "");
  disciplina.ele("PeriodoLetivo").txt(disc.periodo_letivo || "");

  // CargaHoraria+ (obrigatório, ao menos 1)
  buildCargaHorariaEtiqueta(disciplina, disc.carga_horaria);

  // Nota / Conceito (choice — opcional)
  if (disc.nota !== undefined && disc.nota !== null) {
    disciplina.ele("Nota").txt(disc.nota.toFixed(2));
  } else if (disc.nota_ate_cem !== undefined && disc.nota_ate_cem !== null) {
    disciplina.ele("NotaAteCem").txt(disc.nota_ate_cem.toFixed(2));
  } else if (disc.conceito) {
    // XSD TConceito restringe a {A+,A,A-,...,F-}. Valores fora do enum
    // (ex: "Cumpriu", "Aprovado") devem ir para ConceitoEspecificoDoCurso
    // (TString50) que aceita texto livre — caso contrário o XSD rejeita.
    if (CONCEITOS_VALIDOS.has(disc.conceito)) {
      disciplina.ele("Conceito").txt(disc.conceito);
    } else {
      disciplina
        .ele("ConceitoEspecificoDoCurso")
        .txt(disc.conceito.slice(0, 50));
    }
  } else if (disc.conceito_rm) {
    disciplina.ele("ConceitoRM").txt(disc.conceito_rm);
  } else if (disc.conceito_especifico) {
    disciplina.ele("ConceitoEspecificoDoCurso").txt(disc.conceito_especifico);
  }

  // Situação (choice — obrigatório)
  if (disc.situacao === "Aprovado") {
    const aprovado = disciplina.ele("Aprovado");
    if (disc.forma_integralizacao) {
      aprovado.ele("FormaIntegralizacao").txt(disc.forma_integralizacao);
    } else if (disc.outra_forma_integralizacao) {
      aprovado
        .ele("OutraFormaIntegralizacao")
        .txt(disc.outra_forma_integralizacao);
    }
    // Se nenhuma forma, <Aprovado/> fica vazio (self-closing)
  } else if (disc.situacao === "Pendente") {
    disciplina.ele("Pendente");
  } else {
    disciplina.ele("Reprovado");
  }

  // Docentes (obrigatório)
  buildDocentes(disciplina, disc.docentes);
}

/** Adiciona bloco <AtividadeComplementar> — TEntradaHistoricoAtividadeComplementar */
function buildAtividadeComplementar(
  parent: XMLBuilder,
  ac: AtividadeComplementar,
): void {
  const atividade = parent.ele("AtividadeComplementar");

  atividade.ele("CodigoAtividadeComplementar").txt(ac.codigo || "");
  atividade.ele("DataInicio").txt(fmtData(ac.data_inicio));
  atividade.ele("DataFim").txt(fmtData(ac.data_fim));
  eleOpc(
    atividade,
    "DataRegistro",
    ac.data_registro ? fmtData(ac.data_registro) : undefined,
  );
  atividade.ele("TipoAtividadeComplementar").txt(ac.tipo || "");
  eleOpc(atividade, "Descricao", ac.descricao);

  buildCargaHorariaRelogioEtiqueta(atividade, ac.carga_horaria_relogio);
  buildDocentes(
    atividade,
    ac.docentes_validacao,
    "DocentesResponsaveisPelaValidacao",
  );
}

/** Adiciona bloco <Estagio> — TEntradaHistoricoEstagio */
function buildEstagio(parent: XMLBuilder, est: Estagio): void {
  const estagio = parent.ele("Estagio");

  estagio
    .ele("CodigoUnidadeCurricular")
    .txt(est.codigo_unidade_curricular || "");
  estagio.ele("DataInicio").txt(fmtData(est.data_inicio));
  estagio.ele("DataFim").txt(fmtData(est.data_fim));

  // Concedente (opcional)
  if (est.concedente) {
    const concedente = estagio.ele("Concedente");
    if (est.concedente.tipo === "PJ") {
      concedente.ele("RazaoSocial").txt(est.concedente.razao_social || "");
      eleOpc(concedente, "NomeFantasia", est.concedente.nome_fantasia);
      concedente.ele("CNPJ").txt(limparNum(est.concedente.cnpj));
    } else {
      concedente.ele("Nome").txt(est.concedente.nome || "");
      concedente.ele("CPF").txt(limparNum(est.concedente.cpf));
    }
  }

  eleOpc(estagio, "Descricao", est.descricao);
  buildCargaHorariaRelogioEtiqueta(estagio, est.carga_horaria_relogio);
  buildDocentes(estagio, est.docentes_orientadores, "DocentesOrientadores");
}

/** Adiciona bloco <ENADE> — TEnade */
function buildEnade(parent: XMLBuilder, infos: EnadeInfo[]): void {
  const enade = parent.ele("ENADE");

  if (!infos || infos.length === 0) {
    // ENADE vazio (self-closing)
    return;
  }

  for (const e of infos) {
    if (e.tipo === "Habilitado") {
      const hab = enade.ele("Habilitado");
      hab.ele("Condicao").txt(e.condicao || "");
      hab.ele("Edicao").txt(e.edicao || "");
    } else if (e.tipo === "Irregular") {
      const irr = enade.ele("Irregular");
      irr.ele("Condicao").txt(e.condicao || "");
      irr.ele("Edicao").txt(e.edicao || "");
    } else {
      // NaoHabilitado
      const naoHab = enade.ele("NaoHabilitado");
      naoHab.ele("Condicao").txt(e.condicao || "");
      naoHab.ele("Edicao").txt(e.edicao || "");
      // XSD TEnadeNaoHabilitado exige 1 de (Motivo | OutroMotivo) — minOccurs=1.
      // <Motivo> só aceita os 2 valores do enum TEnumMotivoNaoHabilitacaoAlunoEnadeHistorico.
      // Se não veio motivo estruturado, usa <OutroMotivo> (TString livre).
      const MOTIVOS_VALIDOS = new Set([
        "Estudante não habilitado ao Enade em razão do calendário do ciclo avaliativo",
        "Estudante não habilitado ao Enade em razão da natureza do projeto pedagógico do curso",
      ]);
      if (e.motivo && MOTIVOS_VALIDOS.has(e.motivo)) {
        naoHab.ele("Motivo").txt(e.motivo);
      } else if (e.motivo) {
        // Motivo preenchido mas não é enum válido → OutroMotivo
        naoHab.ele("OutroMotivo").txt(e.motivo);
      } else if (e.outro_motivo) {
        naoHab.ele("OutroMotivo").txt(e.outro_motivo);
      } else {
        // Fallback obrigatório — sem motivo no banco, usa OutroMotivo genérico
        naoHab.ele("OutroMotivo").txt("Não habilitado ao ENADE nesta edição");
      }
    }
  }
}

// ============================================================
// BUILDER PRINCIPAL DO HISTÓRICO
// ============================================================

/**
 * Adiciona bloco <HistoricoEscolar> completo ao parent
 * Sequence: CodigoCurriculo, ElementosHistorico, DataEmissaoHistorico,
 *           HoraEmissaoHistorico, SituacaoAtualDiscente, ENADE,
 *           CargaHorariaCursoIntegralizada, CargaHorariaCurso, IngressoCurso
 */
export function buildHistoricoEscolar(
  parent: XMLBuilder,
  dados: DadosDiploma,
): void {
  const h = dados.historico;
  const historico = parent.ele("HistoricoEscolar");

  // CodigoCurriculo
  historico.ele("CodigoCurriculo").txt(h.codigo_curriculo || "");

  // ElementosHistorico — Disciplinas + AtividadesComplementares + Estágios
  const elementos = historico.ele("ElementosHistorico");

  for (const disc of h.disciplinas) {
    buildDisciplina(elementos, disc);
  }
  if (h.atividades_complementares) {
    for (const ac of h.atividades_complementares) {
      buildAtividadeComplementar(elementos, ac);
    }
  }
  if (h.estagios) {
    for (const est of h.estagios) {
      buildEstagio(elementos, est);
    }
  }

  // DataEmissaoHistorico, HoraEmissaoHistorico
  historico.ele("DataEmissaoHistorico").txt(fmtData(h.data_emissao));
  historico.ele("HoraEmissaoHistorico").txt(h.hora_emissao || "");

  // SituacaoAtualDiscente
  const sit = h.situacao_discente;
  const situacao = historico.ele("SituacaoAtualDiscente");
  const formado = situacao.ele("Formado");
  formado.ele("DataConclusaoCurso").txt(fmtData(sit.data_conclusao));
  formado.ele("DataColacaoGrau").txt(fmtData(sit.data_colacao_grau));
  // Bug #E — fix 2026-04-07 (Onda 2 / Caminho C):
  // DataExpedicaoDiploma é SEMPRE derivada da data de geração do XML
  // (per IN 05 — é a data em que a IES expede o diploma). NÃO vem do
  // payload — quem chamar o motor não tem como passar valor manual,
  // garantindo trava por design contra o bug antigo de campo opcional.
  formado.ele("DataExpedicaoDiploma").txt(gerarDataExpedicaoXML());

  // ENADE
  buildEnade(historico, h.enade);

  // CargaHoraria — tipo HoraAula ou HoraRelogio
  const chTag =
    h.tipo_carga_horaria === "HoraAula" ? "HoraAula" : "HoraRelogio";

  const chInteg = historico.ele("CargaHorariaCursoIntegralizada");
  chInteg.ele(chTag).txt(String(h.carga_horaria_integralizada));

  const chCurso = historico.ele("CargaHorariaCurso");
  chCurso.ele(chTag).txt(String(h.carga_horaria_curso));

  // IngressoCurso
  const ingresso = historico.ele("IngressoCurso");
  ingresso.ele("Data").txt(fmtData(h.data_ingresso));
  ingresso.ele("FormaAcesso").txt(h.forma_acesso || "");
}
