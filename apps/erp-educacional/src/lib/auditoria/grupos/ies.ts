import { IssueAuditoria, DadosIesAuditoria } from '../tipos'

/** Valida os campos obrigatórios de TDadosIesEmissora (XSD v1.05) */
export function checkIes(ies: DadosIesAuditoria): IssueAuditoria[] {
  const issues: IssueAuditoria[] = []

  // ── Identificação da IES ──────────────────────────────────────────────────
  if (!ies.nome?.trim()) {
    issues.push({
      campo: 'ies_nome',
      mensagem: 'Nome da IES emissora não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.nome,
    })
  }

  if (!ies.codigo_mec?.trim()) {
    issues.push({
      campo: 'ies_codigo_mec',
      mensagem: 'Código MEC da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.codigo_mec,
    })
  }

  if (!ies.cnpj?.trim()) {
    issues.push({
      campo: 'ies_cnpj',
      mensagem: 'CNPJ da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.cnpj,
    })
  } else {
    const cnpjLimpo = ies.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) {
      issues.push({
        campo: 'ies_cnpj',
        mensagem: `CNPJ inválido (deve ter 14 dígitos, encontrado: "${ies.cnpj}").`,
        severidade: 'critico',
        acao: 'editar_ies',
        valor_atual: ies.cnpj,
      })
    }
  }

  // ── Endereço ──────────────────────────────────────────────────────────────
  if (!ies.endereco_logradouro?.trim()) {
    issues.push({
      campo: 'ies_endereco_logradouro',
      mensagem: 'Logradouro do endereço da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.endereco_logradouro,
    })
  }

  if (!ies.endereco_numero?.trim()) {
    issues.push({
      campo: 'ies_endereco_numero',
      mensagem: 'Número do endereço da IES não preenchido.',
      severidade: 'aviso',
      acao: 'editar_ies',
      valor_atual: ies.endereco_numero,
    })
  }

  if (!ies.endereco_bairro?.trim()) {
    issues.push({
      campo: 'ies_endereco_bairro',
      mensagem: 'Bairro do endereço da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.endereco_bairro,
    })
  }

  if (!ies.endereco_cep?.trim()) {
    issues.push({
      campo: 'ies_endereco_cep',
      mensagem: 'CEP do endereço da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.endereco_cep,
    })
  } else {
    const cepLimpo = ies.endereco_cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) {
      issues.push({
        campo: 'ies_endereco_cep',
        mensagem: `CEP inválido: "${ies.endereco_cep}". Deve ter 8 dígitos.`,
        severidade: 'critico',
        acao: 'editar_ies',
        valor_atual: ies.endereco_cep,
      })
    }
  }

  if (!ies.endereco_municipio?.trim()) {
    issues.push({
      campo: 'ies_endereco_municipio',
      mensagem: 'Município do endereço da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.endereco_municipio,
    })
  }

  if (!ies.endereco_uf?.trim()) {
    issues.push({
      campo: 'ies_endereco_uf',
      mensagem: 'UF do endereço da IES não preenchida.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.endereco_uf,
    })
  }

  if (!ies.endereco_codigo_ibge?.trim()) {
    issues.push({
      campo: 'ies_endereco_codigo_ibge',
      mensagem: 'Código IBGE do município da IES não preenchido (XSD exige 7 dígitos).',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.endereco_codigo_ibge,
    })
  } else if (!/^\d{7}$/.test(ies.endereco_codigo_ibge.trim())) {
    issues.push({
      campo: 'ies_endereco_codigo_ibge',
      mensagem: `Código IBGE da IES inválido: "${ies.endereco_codigo_ibge}". XSD exige exatamente 7 dígitos.`,
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.endereco_codigo_ibge,
    })
  }

  // ── Credenciamento ────────────────────────────────────────────────────────
  if (!ies.tipo_credenciamento?.trim()) {
    issues.push({
      campo: 'ies_tipo_credenciamento',
      mensagem: 'Tipo do ato de credenciamento da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.tipo_credenciamento,
    })
  }

  if (!ies.numero_credenciamento?.trim()) {
    issues.push({
      campo: 'ies_numero_credenciamento',
      mensagem: 'Número do ato de credenciamento da IES não preenchido.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.numero_credenciamento,
    })
  }

  if (!ies.data_credenciamento?.trim()) {
    issues.push({
      campo: 'ies_data_credenciamento',
      mensagem: 'Data do ato de credenciamento da IES não preenchida.',
      severidade: 'critico',
      acao: 'editar_ies',
      valor_atual: ies.data_credenciamento,
    })
  }

  return issues
}
