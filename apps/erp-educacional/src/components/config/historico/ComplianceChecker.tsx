'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  X,
  BookOpen,
  GraduationCap,
  FileText,
  Info,
} from 'lucide-react'
import { HistoricoColunaConfig, HistoricoCampoAlunoConfig, CAMPOS_ALUNO_OBRIGATORIOS_MEC } from '@/types/diploma-config'

// ══════════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════════

interface ComplianceCheckerProps {
  camposAluno: HistoricoCampoAlunoConfig[]
  colunas: HistoricoColunaConfig[]
  temTimbrado: boolean
  formatoNota: string | null
  agrupamento: string
  iesEmissoraId: string | null
  versaoXsd: string
  historicoExibirDocente: boolean
  historicoExibirTitulacao: boolean
  // Dados reais do cadastro da IES
  iesCredenciamento: string | null
  iesCredenciamentoData: string | null
}

interface ComplianceCheck {
  id: string
  label: string
  status: 'compliant' | 'warning' | 'error' | 'info'
  isMandatory: boolean
  message: string
  reference: string
}

type CategoryId = 'aluno' | 'colunas' | 'emissao' | 'visual'

interface Category {
  id: CategoryId
  icon: React.ReactNode
  label: string
  desc: string
}

const CATEGORIES: Category[] = [
  { id: 'aluno', icon: <Info size={15} />, label: 'Dados do Aluno', desc: 'Campos de identificação do aluno (XSD TDadosDiplomado)' },
  { id: 'colunas', icon: <BookOpen size={15} />, label: 'Colunas do Histórico', desc: 'Campos obrigatórios por disciplina (Art. 17, XI)' },
  { id: 'emissao', icon: <GraduationCap size={15} />, label: 'Campos na Emissão', desc: 'Serão validados na emissão do histórico' },
  { id: 'visual', icon: <FileText size={15} />, label: 'Visual & Layout', desc: 'Aparência e boas práticas' },
]

// ══════════════════════════════════════════════════════════════
// Componente
// ══════════════════════════════════════════════════════════════

export default function ComplianceChecker({
  camposAluno,
  colunas,
  temTimbrado,
  formatoNota,
  agrupamento,
  iesEmissoraId,
  versaoXsd,
  historicoExibirDocente,
  historicoExibirTitulacao,
  iesCredenciamento,
  iesCredenciamentoData,
}: ComplianceCheckerProps) {
  const [showDialog, setShowDialog] = useState(false)

  const checks: (ComplianceCheck & { category: CategoryId })[] = useMemo(() => {
    // ── Campos do Aluno ──
    const alunoVisiveis = camposAluno.filter(c => c.visivel).map(c => c.campo)
    const alunoFieldPresent = (campo: string) => alunoVisiveis.includes(campo)

    // ── Colunas de disciplina ──
    const visibleCampos = colunas.filter(c => c.visivel).map(c => c.campo)
    const campoVisivel = (campo: string) => visibleCampos.includes(campo)
    const temNota = campoVisivel('nota') || campoVisivel('nota_ate_cem') || campoVisivel('conceito') || campoVisivel('conceito_rm') || campoVisivel('conceito_especifico')
    const temCH = campoVisivel('carga_horaria_aula') || campoVisivel('carga_horaria_relogio')
    const temDocente = campoVisivel('docente_nome') || historicoExibirDocente
    const temTitulacao = campoVisivel('docente_titulacao') || historicoExibirTitulacao

    return [
      // ══════════════════════════════════════════════════════════
      // DADOS DO ALUNO — Campos de identificação (XSD TDadosDiplomado)
      // Checagem de EXISTÊNCIA do campo no modelo.
      // Conteúdo será preenchido na emissão do histórico.
      // ══════════════════════════════════════════════════════════
      {
        id: 'aluno-nome',
        category: 'aluno' as CategoryId,
        label: 'Nome do aluno',
        status: alunoFieldPresent('nome') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('nome')
          ? 'Campo presente no modelo'
          : 'Ative o campo "Nome do Aluno" — é obrigatório',
        reference: 'XSD TNome minOccurs=1',
      },
      {
        id: 'aluno-cpf',
        category: 'aluno' as CategoryId,
        label: 'CPF',
        status: alunoFieldPresent('cpf') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('cpf')
          ? 'Campo presente no modelo'
          : 'Ative o campo "CPF" — é obrigatório',
        reference: 'XSD TCpf minOccurs=1',
      },
      {
        id: 'aluno-data-nascimento',
        category: 'aluno' as CategoryId,
        label: 'Data de nascimento',
        status: alunoFieldPresent('data_nascimento') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('data_nascimento')
          ? 'Campo presente no modelo'
          : 'Ative o campo "Data de Nascimento" — é obrigatório',
        reference: 'XSD TData minOccurs=1',
      },
      {
        id: 'aluno-sexo',
        category: 'aluno' as CategoryId,
        label: 'Sexo',
        status: alunoFieldPresent('sexo') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('sexo')
          ? 'Campo presente no modelo'
          : 'Ative o campo "Sexo" — é obrigatório',
        reference: 'XSD TSexo minOccurs=1',
      },
      {
        id: 'aluno-nacionalidade',
        category: 'aluno' as CategoryId,
        label: 'Nacionalidade',
        status: alunoFieldPresent('nacionalidade') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('nacionalidade')
          ? 'Campo presente no modelo'
          : 'Ative o campo "Nacionalidade" — é obrigatório',
        reference: 'XSD TNacionalidade minOccurs=1',
      },
      {
        id: 'aluno-naturalidade',
        category: 'aluno' as CategoryId,
        label: 'Naturalidade',
        status: alunoFieldPresent('naturalidade') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('naturalidade')
          ? 'Campo presente no modelo'
          : 'Ative o campo "Naturalidade" — é obrigatório',
        reference: 'XSD TNaturalidade minOccurs=1',
      },
      {
        id: 'aluno-rg',
        category: 'aluno' as CategoryId,
        label: 'Documento de identificação (RG)',
        status: alunoFieldPresent('rg') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('rg')
          ? 'Campo presente no modelo'
          : 'Ative o campo "RG" — é obrigatório',
        reference: 'XSD TRg/OutroDocIdentificacao minOccurs=1',
      },
      {
        id: 'aluno-ra',
        category: 'aluno' as CategoryId,
        label: 'RA / Matrícula',
        status: alunoFieldPresent('ra') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('ra')
          ? 'Campo presente no modelo'
          : 'Ative o campo "RA / Matrícula" — é obrigatório',
        reference: 'XSD TId minOccurs=1',
      },
      {
        id: 'aluno-curso',
        category: 'aluno' as CategoryId,
        label: 'Curso',
        status: alunoFieldPresent('curso') ? 'compliant' : 'error',
        isMandatory: true,
        message: alunoFieldPresent('curso')
          ? 'Campo presente no modelo'
          : 'Ative o campo "Curso" — é obrigatório',
        reference: 'Art. 17, II',
      },
      {
        id: 'aluno-nome-social',
        category: 'aluno' as CategoryId,
        label: 'Nome social',
        status: alunoFieldPresent('nome_social') ? 'compliant' : 'warning',
        isMandatory: false,
        message: alunoFieldPresent('nome_social')
          ? 'Campo presente no modelo'
          : 'Recomendado — XSD permite (minOccurs=0)',
        reference: 'XSD NomeSocial minOccurs=0',
      },

      // ══════════════════════════════════════════════════════════
      // COLUNAS DO HISTÓRICO — Configuração verificável AGORA
      // Art. 17, XI: "relação das disciplinas cursadas, contendo
      // período, carga horária, notas ou conceitos, nomes dos
      // docentes e titulação"
      // ══════════════════════════════════════════════════════════
      {
        id: 'nome-disciplina',
        category: 'colunas' as CategoryId,
        label: 'Nome da disciplina',
        status: campoVisivel('nome') ? 'compliant' : 'error',
        isMandatory: true,
        message: campoVisivel('nome')
          ? 'Coluna "Disciplina" visível no modelo'
          : 'Ative a coluna "Disciplina" — é obrigatória',
        reference: 'Art. 17, XI · XSD NomeDisciplina minOccurs=1',
      },
      {
        id: 'carga-horaria',
        category: 'colunas' as CategoryId,
        label: 'Carga horária',
        status: temCH ? 'compliant' : 'error',
        isMandatory: true,
        message: temCH
          ? 'Coluna de carga horária visível no modelo'
          : 'Ative a coluna C.H. (Aula ou Relógio) — é obrigatória',
        reference: 'Art. 17, XI · XSD CargaHoraria minOccurs=1',
      },
      {
        id: 'periodo',
        category: 'colunas' as CategoryId,
        label: 'Período letivo',
        status: campoVisivel('periodo') ? 'compliant' : 'error',
        isMandatory: true,
        message: campoVisivel('periodo')
          ? 'Coluna "Período" visível no modelo'
          : 'Ative a coluna "Período" — é obrigatória',
        reference: 'Art. 17, XI · XSD PeriodoLetivo minOccurs=1',
      },
      {
        id: 'notas-conceitos',
        category: 'colunas' as CategoryId,
        label: 'Notas ou conceitos',
        status: temNota ? 'compliant' : 'error',
        isMandatory: true,
        message: temNota
          ? 'Coluna de nota/conceito visível no modelo'
          : 'Ative ao menos uma coluna de nota ou conceito — é obrigatória',
        reference: 'Art. 17, XI · XSD Nota/Conceito (choice)',
      },
      {
        id: 'situacao',
        category: 'colunas' as CategoryId,
        label: 'Situação final',
        status: campoVisivel('situacao') ? 'compliant' : 'error',
        isMandatory: true,
        message: campoVisivel('situacao')
          ? 'Coluna "Situação" visível no modelo'
          : 'Ative a coluna "Situação" — é obrigatória',
        reference: 'XSD Aprovado/Reprovado/Pendente minOccurs=1',
      },
      {
        id: 'docente-nome',
        category: 'colunas' as CategoryId,
        label: 'Nome do docente',
        status: temDocente ? 'compliant' : 'error',
        isMandatory: true,
        message: temDocente
          ? 'Coluna "Docente" habilitada no modelo'
          : 'Ative a coluna "Docente" — é obrigatória',
        reference: 'Art. 17, XI · XSD Docente.Nome minOccurs=1',
      },
      {
        id: 'docente-titulacao',
        category: 'colunas' as CategoryId,
        label: 'Titulação do docente',
        status: temTitulacao ? 'compliant' : 'error',
        isMandatory: true,
        message: temTitulacao
          ? 'Coluna "Titulação" habilitada no modelo'
          : 'Ative a coluna "Titulação" — é obrigatória',
        reference: 'Art. 17, XI · XSD Docente.Titulacao minOccurs=1',
      },
      {
        id: 'codigo-disciplina',
        category: 'colunas' as CategoryId,
        label: 'Código da disciplina',
        status: campoVisivel('codigo') ? 'compliant' : 'warning',
        isMandatory: false,
        message: campoVisivel('codigo')
          ? 'Coluna "Código" visível no modelo'
          : 'Recomendado — obrigatório no XSD mas não na Portaria',
        reference: 'XSD CodigoDisciplina minOccurs=1',
      },

      // ══════════════════════════════════════════════════════════
      // CAMPOS NA EMISSÃO — Validados na hora de emitir o histórico
      // O campo precisa EXISTIR no formulário. O conteúdo será
      // preenchido por processo no momento da emissão.
      // ══════════════════════════════════════════════════════════
      {
        id: 'enade',
        category: 'emissao' as CategoryId,
        label: 'Situação ENADE',
        status: 'info' as const,
        isMandatory: true,
        message: 'Campo obrigatório — será preenchido na emissão do histórico',
        reference: 'Art. 17, XV · XSD ENADE minOccurs=1',
      },
      {
        id: 'ch-total-curso',
        category: 'emissao' as CategoryId,
        label: 'Carga horária total do curso',
        status: 'info' as const,
        isMandatory: true,
        message: 'Campo obrigatório — será preenchido na emissão do histórico',
        reference: 'Art. 17, XII · XSD CargaHorariaCurso minOccurs=1',
      },
      {
        id: 'forma-ingresso',
        category: 'emissao' as CategoryId,
        label: 'Forma e data de ingresso',
        status: 'info' as const,
        isMandatory: true,
        message: 'Campo obrigatório — será preenchido na emissão do histórico',
        reference: 'Art. 17, XIII · XSD IngressoCurso minOccurs=1',
      },
      {
        id: 'datas-historico',
        category: 'emissao' as CategoryId,
        label: 'Datas (conclusão, colação, expedição)',
        status: 'info' as const,
        isMandatory: true,
        message: 'Campos obrigatórios — serão preenchidos na emissão do histórico',
        reference: 'Art. 17, XIV',
      },
      {
        id: 'processo-seletivo',
        category: 'emissao' as CategoryId,
        label: 'Mês/ano do processo seletivo',
        status: 'info' as const,
        isMandatory: true,
        message: 'Campo obrigatório — será preenchido na emissão do histórico',
        reference: 'Art. 17, X',
      },
      {
        id: 'ies-emissora',
        category: 'emissao' as CategoryId,
        label: 'IES emissora',
        status: iesEmissoraId ? 'compliant' : 'error',
        isMandatory: true,
        message: iesEmissoraId
          ? 'IES emissora já selecionada nas Configurações'
          : 'IES emissora DEVE ser selecionada nas Configurações',
        reference: 'Art. 17, I',
      },
      {
        id: 'ato-credenciamento',
        category: 'emissao' as CategoryId,
        label: 'Ato de credenciamento da IES',
        status: (iesCredenciamento && iesCredenciamentoData) ? 'compliant' : !iesEmissoraId ? 'info' : 'error',
        isMandatory: true,
        message: (iesCredenciamento && iesCredenciamentoData)
          ? `Portaria nº ${iesCredenciamento} de ${iesCredenciamentoData}`
          : !iesEmissoraId
            ? 'Selecione a IES emissora primeiro'
            : 'Preencher no Cadastro da IES (nº portaria + data)',
        reference: 'Art. 17, VIII',
      },
      {
        id: 'ato-reconhecimento',
        category: 'emissao' as CategoryId,
        label: 'Ato de reconhecimento do curso',
        status: 'info' as const,
        isMandatory: true,
        message: 'Será validado por curso na emissão do histórico',
        reference: 'Art. 17, IX',
      },

      // ══════════════════════════════════════════════════════════
      // VISUAL & LAYOUT — Recomendações
      // ══════════════════════════════════════════════════════════
      {
        id: 'formato-nota',
        category: 'visual' as CategoryId,
        label: 'Formato de nota configurado',
        status: formatoNota ? 'compliant' : 'warning',
        isMandatory: false,
        message: formatoNota
          ? `Formato: ${formatoNota}`
          : 'Recomendado definir para consistência',
        reference: 'Boa prática',
      },
      {
        id: 'versao-xsd',
        category: 'visual' as CategoryId,
        label: 'Versão XSD',
        status: (versaoXsd === 'v1.05' || versaoXsd === 'v1.06' || versaoXsd === '1.05' || versaoXsd === '1.06') ? 'compliant' : 'warning',
        isMandatory: false,
        message: versaoXsd
          ? `Configurado: ${versaoXsd}`
          : 'Definir nas Configurações → Regras e Fluxo',
        reference: 'IN SESU 5/2022',
      },
      {
        id: 'papel-timbrado',
        category: 'visual' as CategoryId,
        label: 'Papel timbrado',
        status: temTimbrado ? 'compliant' : 'warning',
        isMandatory: false,
        message: temTimbrado ? 'Carregado' : 'Recomendado adicionar',
        reference: 'Boa prática institucional',
      },
      {
        id: 'agrupamento',
        category: 'visual' as CategoryId,
        label: 'Agrupamento por período',
        status: agrupamento !== 'nenhum' ? 'compliant' : 'warning',
        isMandatory: false,
        message:
          agrupamento !== 'nenhum'
            ? `Agrupamento: ${agrupamento}`
            : 'Recomendado agrupar por período',
        reference: 'Boa prática de legibilidade',
      },
    ]
  }, [camposAluno, colunas, temTimbrado, formatoNota, agrupamento, iesEmissoraId, versaoXsd, historicoExibirDocente, historicoExibirTitulacao, iesCredenciamento, iesCredenciamentoData])

  // ── Contadores (excluir "info" dos totais de erro/warning) ──
  const actionableChecks = checks.filter(c => c.status !== 'info')
  const totalErrors = actionableChecks.filter(c => c.status === 'error').length
  const totalWarnings = actionableChecks.filter(c => c.status === 'warning').length
  const totalOk = actionableChecks.filter(c => c.status === 'compliant').length

  const colunasChecks = checks.filter(c => c.category === 'colunas')
  const colunasErrors = colunasChecks.filter(c => c.status === 'error').length

  // ── Badge ──
  const badgeClass = totalErrors > 0
    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : totalWarnings > 0
      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'

  const badgeIcon = totalErrors > 0
    ? <XCircle size={14} />
    : totalWarnings > 0
      ? <AlertTriangle size={14} />
      : <Shield size={14} />

  const badgeLabel = totalErrors > 0
    ? `${totalErrors} erro${totalErrors > 1 ? 's' : ''} MEC`
    : totalWarnings > 0
      ? `MEC OK · ${totalWarnings} aviso${totalWarnings > 1 ? 's' : ''}`
      : 'MEC OK'

  // ── Renderização de checks ──
  function renderCheck(check: ComplianceCheck) {
    const isInfo = check.status === 'info'
    const bg = isInfo ? 'bg-blue-50/60' :
      check.status === 'compliant' ? 'bg-green-50' :
      check.status === 'error' ? 'bg-red-50' :
      'bg-amber-50'
    const iconColor = isInfo ? 'text-blue-400' :
      check.status === 'compliant' ? 'text-green-600' :
      check.status === 'error' ? 'text-red-600' :
      'text-amber-600'
    const textColor = isInfo ? 'text-blue-700' :
      check.status === 'compliant' ? 'text-green-800' :
      check.status === 'error' ? 'text-red-800' :
      'text-amber-800'
    const subColor = isInfo ? 'text-blue-500' :
      check.status === 'compliant' ? 'text-green-600' :
      check.status === 'error' ? 'text-red-600' :
      'text-amber-600'
    const StatusIcon = isInfo ? Info :
      check.status === 'compliant' ? CheckCircle2 :
      check.status === 'error' ? XCircle :
      AlertTriangle

    return (
      <div key={check.id} className={`flex items-start gap-3 p-3 rounded-lg ${bg}`}>
        <StatusIcon size={16} className={`${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${textColor}`}>{check.label}</p>
            {check.isMandatory && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                isInfo ? 'bg-blue-100/60 text-blue-500' : 'bg-white/60 text-gray-500'
              }`}>
                Obrigatório
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${subColor}`}>{check.message}</p>
          <p className="text-[10px] text-gray-400 mt-1">{check.reference}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Badge compacto ── */}
      <button
        onClick={() => setShowDialog(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${badgeClass}`}
      >
        {badgeIcon}
        {badgeLabel}
      </button>

      {/* ── Dialog ── */}
      {showDialog && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Shield size={18} className="text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Conformidade MEC</h3>
                  <p className="text-xs text-gray-500">Portaria 1.095/2018 · Art. 17 · XSD v1.05</p>
                </div>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Summary bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs flex-wrap">
              {totalErrors > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-medium text-red-700">
                    {totalErrors} campo{totalErrors > 1 ? 's' : ''} faltando
                  </span>
                </span>
              )}
              {totalErrors === 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="font-medium text-green-700">
                    Colunas obrigatórias OK
                  </span>
                </span>
              )}
              {totalWarnings > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-medium text-amber-700">
                    {totalWarnings} recomendação{totalWarnings > 1 ? 'ões' : ''}
                  </span>
                </span>
              )}
              <span className="flex items-center gap-1.5 ml-auto">
                <Info size={12} className="text-blue-400" />
                <span className="font-medium text-gray-500">
                  Azul = validado na emissão
                </span>
              </span>
            </div>

            {/* Content by categories */}
            <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
              {CATEGORIES.map(cat => {
                const catChecks = checks.filter(c => c.category === cat.id)
                if (catChecks.length === 0) return null

                const catErrors = catChecks.filter(c => c.status === 'error').length
                const catOk = catChecks.filter(c => c.status === 'compliant').length
                const catInfo = catChecks.filter(c => c.status === 'info').length

                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-gray-400">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          {cat.label}
                        </p>
                        <p className="text-[10px] text-gray-400">{cat.desc}</p>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">
                        {catOk > 0 && <span className="text-green-600">{catOk} ok</span>}
                        {catErrors > 0 && <span className="text-red-500 ml-1.5">{catErrors} erro{catErrors > 1 ? 's' : ''}</span>}
                        {catInfo > 0 && <span className="text-blue-400 ml-1.5">{catInfo} na emissão</span>}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {catChecks.map(renderCheck)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
              <p className="text-[10px] text-gray-400 max-w-md leading-relaxed">
                <span className="inline-flex items-center gap-1"><XCircle size={10} className="text-red-500" /> Erro:</span> coluna faltando no modelo.{' '}
                <span className="inline-flex items-center gap-1"><AlertTriangle size={10} className="text-amber-500" /> Aviso:</span> recomendação.{' '}
                <span className="inline-flex items-center gap-1"><Info size={10} className="text-blue-400" /> Info:</span> validado na emissão.
              </p>
              <button
                onClick={() => setShowDialog(false)}
                className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
