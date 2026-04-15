import { IssueAuditoria, DadosComprobatorioAuditoria } from '../tipos'

/**
 * Tipos mínimos exigidos pela FIC (mais restrito que o XSD v1.05 puro).
 * O XSD exige minOccurs=1 em DocumentacaoComprobatoria — a FIC exige estes 4 tipos.
 * ATENÇÃO: usar os valores exatos do enum tipo_documento_comprobatorio do banco.
 */
const TIPOS_MINIMOS_FIC = [
  { tipo: 'DocumentoIdentidadeDoAluno', label: 'RG' },
  { tipo: 'ProvaConclusaoEnsinoMedio', label: 'Histórico do Ensino Médio' },
  // Aceita qualquer um dos dois: cert. nascimento ou cert. casamento
  { tipo: 'CertidaoNascimento', label: 'Certidão de Nascimento ou Casamento' },
  { tipo: 'TituloEleitor', label: 'Título de Eleitor' },
] as const

/** Valida comprobatórios XSD v1.05 + regras FIC */
export function checkComprobatorios(
  comprobatorios: DadosComprobatorioAuditoria[]
): IssueAuditoria[] {
  const issues: IssueAuditoria[] = []

  // ── XSD: ao menos 1 comprobatório ──────────────────────────────────────────
  if (comprobatorios.length === 0) {
    issues.push({
      campo: 'comprobatorios',
      mensagem:
        'Nenhum documento comprobatório adicionado. O XSD v1.05 exige ao menos 1 comprobatório em DocumentacaoComprobatoria.',
      severidade: 'critico',
      acao: 'adicionar_comprobatorio',
      valor_atual: 0,
    })
    return issues // sem comprobatórios, demais checks são desnecessários
  }

  // Comprobatórios sem arquivo físico
  const semArquivo = comprobatorios.filter((c) => !c.tem_arquivo)
  if (semArquivo.length > 0) {
    issues.push({
      campo: 'comprobatorios_sem_arquivo',
      mensagem: `${semArquivo.length} comprobatório(s) cadastrado(s) sem arquivo PDF/A anexado. O XSD exige o conteúdo base64 do documento.`,
      severidade: 'critico',
      acao: 'adicionar_comprobatorio',
      valor_atual: semArquivo.map((c) => c.id),
    })
  }

  // Comprobatórios sem tipo_xsd definido
  const semTipo = comprobatorios.filter((c) => !c.tipo_xsd?.trim())
  if (semTipo.length > 0) {
    issues.push({
      campo: 'comprobatorios_sem_tipo',
      mensagem: `${semTipo.length} comprobatório(s) sem tipo XSD definido. Cada documento precisa de um tipo válido do enum TDocumentoComprobatorio.`,
      severidade: 'critico',
      acao: 'adicionar_comprobatorio',
      valor_atual: semTipo.map((c) => c.id),
    })
  }

  // ── Regras FIC: 4 tipos mínimos ───────────────────────────────────────────
  const tiposPresentes = new Set(
    comprobatorios.filter((c) => c.tipo_xsd).map((c) => c.tipo_xsd!)
  )

  // RG (enum XSD: DocumentoIdentidadeDoAluno)
  if (!tiposPresentes.has('DocumentoIdentidadeDoAluno')) {
    issues.push({
      campo: 'comprobatorio_rg',
      mensagem: 'Comprobatório de RG ausente. A FIC exige o documento de identidade do diplomando.',
      severidade: 'critico',
      acao: 'adicionar_comprobatorio',
    })
  }

  // Histórico do Ensino Médio (enum XSD: ProvaConclusaoEnsinoMedio)
  if (!tiposPresentes.has('ProvaConclusaoEnsinoMedio')) {
    issues.push({
      campo: 'comprobatorio_historico_em',
      mensagem:
        'Comprobatório de Histórico do Ensino Médio ausente. A FIC exige este documento obrigatoriamente.',
      severidade: 'critico',
      acao: 'adicionar_comprobatorio',
    })
  }

  // Certidão de Nascimento OU Casamento
  if (
    !tiposPresentes.has('CertidaoNascimento') &&
    !tiposPresentes.has('CertidaoCasamento')
  ) {
    issues.push({
      campo: 'comprobatorio_certidao',
      mensagem:
        'Certidão de Nascimento ou Casamento ausente. A FIC exige ao menos uma das duas.',
      severidade: 'critico',
      acao: 'adicionar_comprobatorio',
    })
  }

  // Título de Eleitor
  if (!tiposPresentes.has('TituloEleitor')) {
    issues.push({
      campo: 'comprobatorio_titulo_eleitor',
      mensagem:
        'Comprobatório de Título de Eleitor ausente. A FIC exige este documento obrigatoriamente.',
      severidade: 'critico',
      acao: 'adicionar_comprobatorio',
    })
  }

  return issues
}
