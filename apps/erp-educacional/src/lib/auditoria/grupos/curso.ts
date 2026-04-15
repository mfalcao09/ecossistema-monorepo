import { IssueAuditoria, DadosCursoAuditoria } from '../tipos'

/** Valida os campos obrigatórios de TDadosMinimoCurso (XSD v1.05) */
export function checkCurso(c: DadosCursoAuditoria): IssueAuditoria[] {
  const issues: IssueAuditoria[] = []

  // ── Nome do curso ─────────────────────────────────────────────────────────
  if (!c.nome?.trim()) {
    issues.push({
      campo: 'nome',
      mensagem: 'Nome do curso não preenchido.',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.nome,
    })
  }

  // ── Código e-MEC ──────────────────────────────────────────────────────────
  if (!c.codigo_emec?.trim()) {
    issues.push({
      campo: 'codigo_emec',
      mensagem: 'Código e-MEC do curso não preenchido.',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.codigo_emec,
    })
  }

  // ── Grau ──────────────────────────────────────────────────────────────────
  if (!c.grau?.trim()) {
    issues.push({
      campo: 'grau',
      mensagem: 'Grau do curso não preenchido (ex: Bacharelado, Licenciatura, Tecnológico).',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.grau,
    })
  }

  // ── Carga horária total ───────────────────────────────────────────────────
  if (c.carga_horaria_total == null || c.carga_horaria_total <= 0) {
    issues.push({
      campo: 'carga_horaria_total',
      mensagem: 'Carga horária total do curso não preenchida ou inválida.',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.carga_horaria_total,
    })
  }

  // ── Autorização (TDadosMinimoCurso exige Autorizacao obrigatória) ──────────
  if (!c.tipo_autorizacao?.trim()) {
    issues.push({
      campo: 'tipo_autorizacao',
      mensagem: 'Tipo de ato de autorização do curso não preenchido (XSD exige Autorizacao).',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.tipo_autorizacao,
    })
  }
  if (!c.numero_autorizacao?.trim()) {
    issues.push({
      campo: 'numero_autorizacao',
      mensagem: 'Número do ato de autorização do curso não preenchido.',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.numero_autorizacao,
    })
  }
  if (!c.data_autorizacao?.trim()) {
    issues.push({
      campo: 'data_autorizacao',
      mensagem: 'Data do ato de autorização do curso não preenchida.',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.data_autorizacao,
    })
  }

  // ── Reconhecimento (TDadosMinimoCurso exige Reconhecimento obrigatório) ───
  if (!c.tipo_reconhecimento?.trim()) {
    issues.push({
      campo: 'tipo_reconhecimento',
      mensagem: 'Tipo de ato de reconhecimento do curso não preenchido (XSD exige Reconhecimento).',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.tipo_reconhecimento,
    })
  }
  if (!c.numero_reconhecimento?.trim()) {
    issues.push({
      campo: 'numero_reconhecimento',
      mensagem: 'Número do ato de reconhecimento do curso não preenchido.',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.numero_reconhecimento,
    })
  }
  if (!c.data_reconhecimento?.trim()) {
    issues.push({
      campo: 'data_reconhecimento',
      mensagem: 'Data do ato de reconhecimento do curso não preenchida.',
      severidade: 'critico',
      acao: 'editar_curso',
      valor_atual: c.data_reconhecimento,
    })
  }

  return issues
}
