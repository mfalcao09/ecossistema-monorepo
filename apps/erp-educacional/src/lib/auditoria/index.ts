import {
  InputAuditoria,
  RespostaAuditoria,
  GrupoAuditoria,
  GrupoId,
  IssueAuditoria,
  StatusGrupo,
} from './tipos'
import { checkDiplomado } from './grupos/diplomado'
import { checkFiliacao } from './grupos/filiacao'
import { checkCurso } from './grupos/curso'
import { checkIes } from './grupos/ies'
import { checkHistorico } from './grupos/historico'
import { checkComprobatorios } from './grupos/comprobatorios'

// ── Metadados dos grupos ─────────────────────────────────────────────────────

const META_GRUPOS: Record<GrupoId, { nome: string; descricao: string }> = {
  diplomado: {
    nome: 'Dados do Diplomando',
    descricao: 'Nome, CPF, RG, data de nascimento, sexo, nacionalidade e naturalidade.',
  },
  filiacao: {
    nome: 'Filiação',
    descricao: 'Nome do pai e/ou mãe (mínimo 1 genitor exigido pelo XSD na DocumentacaoAcademica).',
  },
  curso: {
    nome: 'Dados do Curso',
    descricao: 'Nome, código e-MEC, grau, carga horária, atos de autorização e reconhecimento.',
  },
  ies: {
    nome: 'Dados da IES',
    descricao: 'Nome, CNPJ, código MEC, endereço completo e ato de credenciamento.',
  },
  historico: {
    nome: 'Histórico Escolar',
    descricao:
      'Currículo, ingresso, disciplinas, docentes, carga horária integralizada, datas de conclusão/colação/expedição.',
  },
  comprobatorios: {
    nome: 'Documentação Comprobatória',
    descricao: 'Documentos digitalizados em PDF/A vinculados ao processo (mínimo FIC: RG, Histórico EM, Certidão, Título).',
  },
}

// ── Helper: calcular StatusGrupo a partir das issues ───────────────────────

function calcularStatus(issues: IssueAuditoria[]): StatusGrupo {
  if (issues.length === 0) return 'ok'
  if (issues.some((i) => i.severidade === 'critico')) return 'com_erros'
  return 'com_avisos'
}

// ── Orquestrador principal ────────────────────────────────────────────────────

export function executarAuditoria(input: InputAuditoria): RespostaAuditoria {
  const gruposOrdenados: GrupoId[] = [
    'diplomado',
    'filiacao',
    'curso',
    'ies',
    'historico',
    'comprobatorios',
  ]

  const grupos: GrupoAuditoria[] = gruposOrdenados.map((id) => {
    let issues: IssueAuditoria[] = []

    switch (id) {
      case 'diplomado':
        issues = checkDiplomado(input.diplomado)
        break
      case 'filiacao':
        issues = checkFiliacao(input.diplomado)
        break
      case 'curso':
        issues = checkCurso(input.curso)
        break
      case 'ies':
        issues = checkIes(input.ies)
        break
      case 'historico':
        issues = checkHistorico(input.historico)
        break
      case 'comprobatorios':
        issues = checkComprobatorios(input.comprobatorios)
        break
    }

    const meta = META_GRUPOS[id]
    return {
      id,
      nome: meta.nome,
      descricao: meta.descricao,
      status: calcularStatus(issues),
      issues,
    }
  })

  // ── Totais ─────────────────────────────────────────────────────────────────
  const todasIssues = grupos.flatMap((g) => g.issues)
  const criticos = todasIssues.filter((i) => i.severidade === 'critico').length
  const avisos = todasIssues.filter((i) => i.severidade === 'aviso').length
  const infos = todasIssues.filter((i) => i.severidade === 'info').length

  return {
    pode_gerar_xml: criticos === 0,
    auditado_em: new Date().toISOString(),
    grupos,
    totais: {
      criticos,
      avisos,
      infos,
      total: todasIssues.length,
    },
  }
}
