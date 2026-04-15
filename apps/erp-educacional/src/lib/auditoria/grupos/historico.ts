import { IssueAuditoria, DadosHistoricoAuditoria } from '../tipos'

/** Valida os campos obrigatórios de THistoricoEscolar + disciplinas (XSD v1.05) */
export function checkHistorico(h: DadosHistoricoAuditoria): IssueAuditoria[] {
  const issues: IssueAuditoria[] = []

  // ── Código do currículo ───────────────────────────────────────────────────
  // aviso (não critico): campo desejável mas pode não estar disponível antes da assinatura
  if (!h.codigo_curriculo?.trim()) {
    issues.push({
      campo: 'codigo_curriculo',
      mensagem: 'Código do currículo não preenchido. Verifique com a coordenação antes de gerar o XML.',
      severidade: 'aviso',
      acao: 'editar_historico',
      valor_atual: h.codigo_curriculo,
    })
  }

  // ── Ingresso ──────────────────────────────────────────────────────────────
  if (!h.data_ingresso?.trim()) {
    issues.push({
      campo: 'data_ingresso',
      mensagem: 'Data de ingresso no curso não preenchida.',
      severidade: 'critico',
      acao: 'editar_historico',
      valor_atual: h.data_ingresso,
    })
  }

  if (!h.forma_acesso?.trim()) {
    issues.push({
      campo: 'forma_acesso',
      mensagem: 'Forma de acesso ao curso não preenchida (XSD exige IngressoCurso.FormaAcesso).',
      severidade: 'critico',
      acao: 'editar_historico',
      valor_atual: h.forma_acesso,
    })
  }

  // ── Conclusão / Colação / Expedição ───────────────────────────────────────
  if (!h.data_conclusao?.trim()) {
    issues.push({
      campo: 'data_conclusao',
      mensagem: 'Data de conclusão do curso não preenchida (obrigatória para TSituacaoFormado).',
      severidade: 'critico',
      acao: 'editar_historico',
      valor_atual: h.data_conclusao,
    })
  }

  if (!h.data_colacao_grau?.trim()) {
    issues.push({
      campo: 'data_colacao_grau',
      mensagem: 'Data de colação de grau não preenchida (obrigatória para TSituacaoFormado).',
      severidade: 'critico',
      acao: 'editar_historico',
      valor_atual: h.data_colacao_grau,
    })
  }

  // data_expedicao é aviso (não critico): preenchida automaticamente no momento da assinatura do XML
  if (!h.data_expedicao?.trim()) {
    issues.push({
      campo: 'data_expedicao',
      mensagem: 'Data de expedição não preenchida — será definida automaticamente no momento da assinatura do XML.',
      severidade: 'aviso',
      acao: 'editar_historico',
      valor_atual: h.data_expedicao,
    })
  }

  // ── Carga horária integralizada ───────────────────────────────────────────
  if (h.carga_horaria_integralizada == null || h.carga_horaria_integralizada <= 0) {
    issues.push({
      campo: 'carga_horaria_integralizada',
      mensagem: 'Carga horária integralizada não preenchida ou inválida.',
      severidade: 'critico',
      acao: 'editar_historico',
      valor_atual: h.carga_horaria_integralizada,
    })
  }

  // ── Disciplinas ───────────────────────────────────────────────────────────
  if (h.disciplinas.length === 0) {
    issues.push({
      campo: 'disciplinas',
      mensagem:
        'Nenhuma disciplina cadastrada. O XSD exige ao menos um ElementoHistorico (disciplina) no histórico escolar.',
      severidade: 'critico',
      acao: 'editar_historico',
      valor_atual: 0,
    })
  } else {
    // Contar disciplinas sem docente e sem carga horária
    const semDocente: string[] = []
    const semCargaHoraria: string[] = []
    const semPeriodo: string[] = []

    for (const disc of h.disciplinas) {
      const label = disc.nome || disc.id

      if (!disc.docente_nome?.trim() || !disc.docente_titulacao?.trim()) {
        semDocente.push(label)
      }

      const temCH =
        (disc.carga_horaria_aula != null && disc.carga_horaria_aula > 0) ||
        (disc.carga_horaria_relogio != null && disc.carga_horaria_relogio > 0)
      if (!temCH) {
        semCargaHoraria.push(label)
      }

      if (!disc.periodo?.trim()) {
        semPeriodo.push(label)
      }
    }

    if (semDocente.length > 0) {
      issues.push({
        campo: 'disciplinas_docentes',
        mensagem: `${semDocente.length} disciplina(s) sem docente ou titulação preenchidos (XSD exige Nome+Titulação do docente em cada TEntradaHistoricoDisciplina): ${semDocente.slice(0, 3).join(', ')}${semDocente.length > 3 ? ` e mais ${semDocente.length - 3}` : ''}.`,
        severidade: 'critico',
        acao: 'preencher_docentes',
        valor_atual: semDocente,
      })
    }

    if (semCargaHoraria.length > 0) {
      issues.push({
        campo: 'disciplinas_carga_horaria',
        mensagem: `${semCargaHoraria.length} disciplina(s) sem carga horária preenchida (XSD exige ao menos 1 CargaHoraria): ${semCargaHoraria.slice(0, 3).join(', ')}${semCargaHoraria.length > 3 ? ` e mais ${semCargaHoraria.length - 3}` : ''}.`,
        severidade: 'critico',
        acao: 'editar_historico',
        valor_atual: semCargaHoraria,
      })
    }

    if (semPeriodo.length > 0) {
      issues.push({
        campo: 'disciplinas_periodo',
        mensagem: `${semPeriodo.length} disciplina(s) sem período letivo preenchido: ${semPeriodo.slice(0, 3).join(', ')}${semPeriodo.length > 3 ? ` e mais ${semPeriodo.length - 3}` : ''}.`,
        severidade: 'aviso',
        acao: 'editar_historico',
        valor_atual: semPeriodo,
      })
    }
  }

  return issues
}
