import { IssueAuditoria, DadosDiplomadoAuditoria } from '../tipos'

/**
 * Valida filiação (TDadosPrivadosDiplomado.Filiacao — DocumentacaoAcademica XML).
 * O XSD exige pelo menos 1 Genitor com Nome preenchido.
 * Usamos nome_pai / nome_mae da tabela diplomados como proxy:
 * se ambos estiverem vazios, não há nenhum genitor → XML inválido.
 */
export function checkFiliacao(d: DadosDiplomadoAuditoria): IssueAuditoria[] {
  const issues: IssueAuditoria[] = []

  const temPai = d.nome_pai?.trim()
  const temMae = d.nome_mae?.trim()

  if (!temPai && !temMae) {
    issues.push({
      campo: 'filiacao',
      mensagem:
        'Nenhum genitor informado. O XSD exige ao menos um nome (pai ou mãe) no grupo Filiação.',
      severidade: 'critico',
      acao: 'editar_diplomado',
      valor_atual: { nome_pai: d.nome_pai, nome_mae: d.nome_mae },
    })
  }

  return issues
}
