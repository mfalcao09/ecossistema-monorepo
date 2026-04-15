import { IssueAuditoria, DadosDiplomadoAuditoria } from '../tipos'

/** Valida os campos obrigatórios de TDadosDiplomado (XSD v1.05) */
export function checkDiplomado(d: DadosDiplomadoAuditoria): IssueAuditoria[] {
  const issues: IssueAuditoria[] = []

  // ── Nome ──────────────────────────────────────────────────────────────────
  if (!d.nome?.trim()) {
    issues.push({
      campo: 'nome',
      mensagem: 'Nome completo do diplomando não preenchido.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.nome,
    })
  }

  // ── CPF ───────────────────────────────────────────────────────────────────
  if (!d.cpf?.trim()) {
    issues.push({
      campo: 'cpf',
      mensagem: 'CPF do diplomando não preenchido.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.cpf,
    })
  } else {
    const cpfLimpo = d.cpf.replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      issues.push({
        campo: 'cpf',
        mensagem: `CPF inválido (deve ter 11 dígitos, encontrado: "${d.cpf}").`,
        severidade: 'critico',
        acao: 'editar_diplomado',
        valor_atual: d.cpf,
      })
    }
  }

  // ── Sexo ──────────────────────────────────────────────────────────────────
  if (!d.sexo?.trim()) {
    issues.push({
      campo: 'sexo',
      mensagem: 'Sexo do diplomando não preenchido (XSD exige M ou F).',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.sexo,
    })
  }

  // ── Nacionalidade ─────────────────────────────────────────────────────────
  if (!d.nacionalidade?.trim()) {
    issues.push({
      campo: 'nacionalidade',
      mensagem: 'Nacionalidade não preenchida.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.nacionalidade,
    })
  }

  // ── Naturalidade (3 campos obrigatórios para brasileiros) ─────────────────
  const temNatMunicipio = d.naturalidade_municipio?.trim()
  const temNatUf = d.naturalidade_uf?.trim()
  const temCodIBGE = d.codigo_municipio_ibge?.trim()

  if (!temNatMunicipio) {
    issues.push({
      campo: 'naturalidade_municipio',
      mensagem: 'Município de naturalidade não preenchido.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.naturalidade_municipio,
    })
  }
  if (!temNatUf) {
    issues.push({
      campo: 'naturalidade_uf',
      mensagem: 'UF de naturalidade não preenchida.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.naturalidade_uf,
    })
  }
  if (!temCodIBGE) {
    issues.push({
      campo: 'codigo_municipio_ibge',
      mensagem: 'Código IBGE do município de naturalidade não preenchido (XSD exige 7 dígitos).',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.codigo_municipio_ibge,
    })
  } else if (!/^\d{7}$/.test(d.codigo_municipio_ibge!.trim())) {
    issues.push({
      campo: 'codigo_municipio_ibge',
      mensagem: `Código IBGE inválido: "${d.codigo_municipio_ibge}". XSD exige exatamente 7 dígitos numéricos.`,
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.codigo_municipio_ibge,
    })
  }

  // ── RG ────────────────────────────────────────────────────────────────────
  if (!d.rg_numero?.trim()) {
    issues.push({
      campo: 'rg_numero',
      mensagem: 'Número do RG não preenchido. O XSD exige RG ou Outro Documento de Identificação.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.rg_numero,
    })
  } else {
    // Se tem RG número, precisa ter órgão e UF
    if (!d.rg_orgao_expedidor?.trim()) {
      issues.push({
        campo: 'rg_orgao_expedidor',
        mensagem: 'Órgão expedidor do RG não preenchido (ex: SSP/MS).',
        severidade: 'critico',
        acao: 'editar_diplomado',
        valor_atual: d.rg_orgao_expedidor,
      })
    }
    if (!d.rg_uf?.trim()) {
      issues.push({
        campo: 'rg_uf',
        mensagem: 'UF do RG não preenchida.',
        severidade: 'critico',
        acao: 'editar_diplomado',
        valor_atual: d.rg_uf,
      })
    }
  }

  // ── Data de nascimento ────────────────────────────────────────────────────
  if (!d.data_nascimento?.trim()) {
    issues.push({
      campo: 'data_nascimento',
      mensagem: 'Data de nascimento não preenchida.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: d.data_nascimento,
    })
  }

  return issues
}
