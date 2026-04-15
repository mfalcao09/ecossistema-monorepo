"use client"

/**
 * Sprint 2 / Sessão 041 — Formulário de Revisão (Tela 2)
 *
 * REESCRITO para:
 *   - Visual consistente com Tela 3 (mesma linguagem de UI)
 *   - Enums XSD v1.05 corretos (Sexo F/M, Modalidade, Grau, FormaAcesso, ENADE)
 *   - Campos faltantes adicionados (codigo_emec, titulo_conferido, ENADE habilitado, filiação dinâmica)
 *   - Naturalidade em 3 campos: Município, Código IBGE (7 dígitos), UF (XSD v1.05)
 *   - Documento alternativo para estrangeiros
 *
 * Seções:
 *   1. Dados Pessoais do Diplomado + Filiação
 *   2. Dados do Curso / Acadêmicos
 *   3. IES Emissora
 *   4. ENADE
 *   5. Disciplinas do Histórico (readonly)
 */

import { useState, useCallback, useEffect, useRef } from "react"
import {
  UserPlus,
  BookOpen,
  GraduationCap,
  Building2,
  ClipboardCheck,
  BookText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Scale,
  Award,
  Gavel,
  Briefcase,
  Settings,
  Clock,
  Printer,
} from "lucide-react"

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS — XSD v1.05 + Railway dados_extraidos
   ═══════════════════════════════════════════════════════════════════════════ */

interface Genitor {
  nome?: string | null
  nome_social?: string | null
  sexo?: string | null
  [key: string]: unknown
}

interface Diplomado {
  nome_completo?: string | null
  nome_social?: string | null
  cpf?: string | null
  rg?: string | null
  rg_orgao?: string | null
  rg_uf?: string | null
  data_nascimento?: string | null
  sexo?: string | null
  nacionalidade?: string | null
  naturalidade?: string | null
  naturalidade_cidade?: string | null
  naturalidade_uf?: string | null
  naturalidade_codigo_municipio?: string | null
  genitores?: Genitor[]
  nome_mae?: string | null
  nome_pai?: string | null
  telefone?: string | null
  email?: string | null
  outro_doc_tipo?: string | null
  outro_doc_id?: string | null
  [key: string]: unknown
}

interface Curso {
  nome?: string | null
  codigo_emec?: string | null
  grau?: string | null
  titulo_conferido?: string | null
  modalidade?: string | null
  turno?: string | null
  forma_acesso?: string | null
  data_inicio?: string | null
  data_colacao?: string | null
  data_conclusao?: string | null
  carga_horaria?: number | null
  ch_cumprida?: number | null
  codigo_curriculo?: string | null
  situacao_discente?: string | null
  hora_aula_min?: number | null
  [key: string]: unknown
}

interface Ies {
  nome?: string | null
  cnpj?: string | null
  codigo_mec?: string | null
  [key: string]: unknown
}

interface Enade {
  habilitado?: string | null
  condicao?: string | null
  ano?: string | null
  situacao_curso?: string | null
  condicao_aluno?: string | null
  edicao_ano?: string | null
  [key: string]: unknown
}

interface Disciplina {
  codigo?: string | null
  nome?: string | null
  carga_horaria?: number | null
  nota?: number | null
  situacao?: string | null
  docente?: string | null
  titulacao_docente?: string | null
  periodo?: number | string | null
}

interface AtivComplementar {
  id?: string
  codigo?: string | null
  tipo?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  ch_hora_relogio?: string | null
  descricao?: string | null
}

interface EstagioRevisao {
  id?: string
  codigo_unidade_curricular?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  ch_hora_relogio?: string | null
  descricao?: string | null
  concedente_cnpj?: string | null
  concedente_razao_social?: string | null
  concedente_nome_fantasia?: string | null
}

interface AssinanteRevisao {
  id?: string
  nome?: string | null
  cpf?: string | null
  cargo?: string | null
}

interface HabilitacaoRevisao {
  id?: string
  nome?: string | null
  data?: string | null
}

interface AreaRevisao {
  codigo?: string | null
  nome?: string | null
}

export interface DadosRevisao {
  diplomado?: Diplomado
  curso?: Curso
  ies?: Ies
  enade?: Enade
  disciplinas?: Disciplina[]
  curso_id?: string | null
  // Dados do Processo
  turno?: string | null
  periodo_letivo?: string | null
  data_colacao?: string | null
  observacoes?: string | null
  // Campos acadêmicos extras
  data_emissao_historico?: string | null
  hora_emissao_historico?: string | null
  situacao_discente?: string | null
  carga_horaria_integralizada?: string | null
  areas?: AreaRevisao[]
  // Atividades, Estágio, Assinantes, Habilitações
  atividades_complementares?: AtivComplementar[]
  estagios?: EstagioRevisao[]
  ecnpj_emissora?: string | null
  assinantes?: AssinanteRevisao[]
  habilitacoes?: HabilitacaoRevisao[]
  // Campos personalizados (multi-função)
  campos_extras?: Array<{ chave: string; valor: string }>
  // Decisão Judicial
  decisao_judicial?: boolean
  dj_numero_processo?: string | null
  dj_nome_juiz?: string | null
  dj_decisao?: string | null
  dj_declaracoes?: string | null
  [key: string]: unknown
}

export interface CursoCadastro {
  id: string
  nome: string
  codigo_emec?: string | null
  grau?: string | null
  titulo_conferido?: string | null
  modalidade?: string | null
  carga_horaria_total?: number | null
  duracao_hora_aula_minutos?: number | null
  codigo_curriculo?: string | null
  instituicoes?: { nome?: string; cnpj?: string; codigo_mec?: string } | null
  [key: string]: unknown
}

interface Props {
  dados: DadosRevisao
  onChange: (novos: DadosRevisao) => void
  cursos?: CursoCadastro[]
  cursoSelecionadoId?: string | null
  onCursoSelecionado?: (cursoId: string) => void
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENUMS XSD v1.05
   ═══════════════════════════════════════════════════════════════════════════ */

const SEXO_OPTIONS = [
  { valor: "F", label: "Feminino" },
  { valor: "M", label: "Masculino" },
]

const GRAU_OPTIONS = [
  { valor: "Bacharelado", label: "Bacharelado" },
  { valor: "Licenciatura", label: "Licenciatura" },
  { valor: "Tecnólogo", label: "Tecnólogo" },
  { valor: "Curso sequencial", label: "Curso sequencial" },
]

const TITULO_OPTIONS = [
  { valor: "Bacharel", label: "Bacharel" },
  { valor: "Licenciado", label: "Licenciado" },
  { valor: "Tecnólogo", label: "Tecnólogo" },
  { valor: "Médico", label: "Médico" },
]

const MODALIDADE_OPTIONS = [
  { valor: "Presencial", label: "Presencial" },
  { valor: "EAD", label: "EAD" },
]

const FORMA_ACESSO_OPTIONS = [
  { valor: "Vestibular", label: "Vestibular" },
  { valor: "ENEM", label: "ENEM" },
  { valor: "Convênio", label: "Convênio" },
  { valor: "Transferência Ex-officio", label: "Transferência Ex-officio" },
  { valor: "Transferência", label: "Transferência" },
  { valor: "Matrícula Cortesia", label: "Matrícula Cortesia" },
  { valor: "Programa de Estudante-Convênio", label: "Programa de Estudante-Convênio" },
  { valor: "Reingresso", label: "Reingresso" },
  { valor: "Processo Seletivo", label: "Processo Seletivo" },
  { valor: "Outros", label: "Outros" },
]

const ENADE_CONDICAO_OPTIONS = [
  { valor: "Regular Habilitado", label: "Regular Habilitado" },
  { valor: "Regular não Habilitado", label: "Regular não Habilitado" },
  { valor: "Irregular", label: "Irregular" },
  { valor: "Dispensado", label: "Dispensado" },
  { valor: "Demais situações previstas na legislação do ENADE vigente", label: "Demais situações previstas" },
]

const SIM_NAO_OPTIONS = [
  { valor: "Sim", label: "Sim" },
  { valor: "Nao", label: "Não" },
]

const TURNO_OPTIONS = [
  { valor: "Matutino", label: "Matutino" },
  { valor: "Vespertino", label: "Vespertino" },
  { valor: "Noturno", label: "Noturno" },
  { valor: "Integral", label: "Integral" },
]

const CARGO_ASSINANTE_OPTIONS = [
  { valor: "Reitor", label: "Reitor" },
  { valor: "Vice-Reitor", label: "Vice-Reitor" },
  { valor: "Diretor", label: "Diretor" },
  { valor: "Secretario", label: "Secretário(a) Geral" },
  { valor: "Coordenador", label: "Coordenador(a) de Curso" },
  { valor: "Decano", label: "Decano(a)" },
  { valor: "Pro-Reitor", label: "Pró-Reitor(a)" },
  { valor: "OutroCargo", label: "Outro Cargo" },
]

const SITUACAO_DISCENTE_OPTIONS = [
  { valor: "Formado", label: "Formado" },
  { valor: "Desligado", label: "Desligado" },
  { valor: "Transferido", label: "Transferido" },
  { valor: "Jubilado", label: "Jubilado" },
]

const TITULACAO_DOCENTE_OPTIONS = [
  { valor: "Doutor", label: "Doutor(a)" },
  { valor: "Mestre", label: "Mestre(a)" },
  { valor: "Especialista", label: "Especialista" },
  { valor: "Graduado", label: "Graduado(a)" },
  { valor: "Residencia", label: "Residência Médica" },
]

const SITUACAO_DISCIPLINA_OPTIONS = [
  { valor: "Aprovado",   label: "Aprovado"   },
  { valor: "Reprovado",  label: "Reprovado"  },
  { valor: "Cumpriu",    label: "Cumpriu"    },
  { valor: "Dispensado", label: "Dispensado" },
  { valor: "Trancado",   label: "Trancado"   },
]

/** Retorna true quando a disciplina é de estágio (sem nota, situação "Cumpriu") */
function ehDisciplinaEstagio(d: { nome?: string | null; situacao?: string | null }): boolean {
  const nome = (d.nome ?? "").toLowerCase()
  const sit  = (d.situacao ?? "").toLowerCase()
  return sit === "cumpriu" || nome.includes("estágio") || nome.includes("estagio") || nome.includes("estag")
}

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
].map((u) => ({ valor: u, label: u }))

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTES UI (mesma linguagem visual da Tela 3)
   ═══════════════════════════════════════════════════════════════════════════ */

function Secao({
  titulo,
  icone,
  aberta,
  onToggle,
  children,
  badge,
  cor = "violet",
}: {
  titulo: string
  icone: React.ReactNode
  aberta: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: React.ReactNode
  cor?: string
}) {
  const corMap: Record<string, string> = {
    violet: "text-violet-600",
    blue: "text-blue-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    teal: "text-teal-600",
    rose: "text-rose-600",
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-700">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors dark:hover:bg-gray-800/50"
      >
        <div className="flex items-center gap-2.5">
          <span className={corMap[cor] ?? "text-violet-600"}>{icone}</span>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{titulo}</span>
          {badge}
        </div>
        {aberta ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>
      {aberta && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

function CampoInput({
  label,
  value,
  onChange,
  obrigatorio,
  tipo = "text",
  placeholder,
  readonly,
  destaque,
  dica,
  fonte,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  obrigatorio?: boolean
  tipo?: "text" | "date" | "email" | "tel" | "time" | "number"
  placeholder?: string
  readonly?: boolean
  destaque?: boolean
  dica?: string
  fonte?: "ia" | "cadastro"
}) {
  const vazio = !value || String(value).trim() === ""
  const borderClass =
    destaque && vazio
      ? "border-amber-400 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
      : readonly
        ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        : "border-gray-300 dark:border-gray-600"

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
        {destaque && vazio && (
          <AlertTriangle size={10} className="inline ml-1 text-amber-500" />
        )}
        {fonte === "ia" && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-medium text-violet-500">
            <Sparkles size={8} /> IA
          </span>
        )}
        {fonte === "cadastro" && (
          <span className="ml-1.5 text-[9px] font-medium text-blue-500">
            Cadastro
          </span>
        )}
      </label>
      <input
        type={tipo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || (obrigatorio && vazio ? "Obrigatório" : "")}
        readOnly={readonly}
        className={`w-full border ${borderClass} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:bg-gray-800 dark:text-gray-100 ${readonly ? "cursor-not-allowed text-gray-500 dark:text-gray-400" : ""}`}
      />
      {dica && <p className="text-[10px] text-gray-400 mt-0.5">{dica}</p>}
    </div>
  )
}

function CampoSelect({
  label,
  value,
  onChange,
  opcoes,
  obrigatorio,
  placeholder,
  readonly,
  fonte,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  opcoes: { valor: string; label: string }[]
  obrigatorio?: boolean
  placeholder?: string
  readonly?: boolean
  fonte?: "ia" | "cadastro"
}) {
  const vazio = !value
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
        {fonte === "ia" && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-medium text-violet-500">
            <Sparkles size={8} /> IA
          </span>
        )}
        {fonte === "cadastro" && (
          <span className="ml-1.5 text-[9px] font-medium text-blue-500">
            Cadastro
          </span>
        )}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readonly}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:bg-gray-800 dark:text-gray-100
          ${vazio && obrigatorio ? "border-amber-400 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20" : "border-gray-300 dark:border-gray-600"}
          ${readonly ? "bg-gray-50 cursor-not-allowed text-gray-500 dark:bg-gray-800 dark:text-gray-400" : ""}`}
      >
        <option value="">{placeholder || "Selecione"}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Separador({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-3 pb-1">
      <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
    </div>
  )
}

function BadgeCount({ atual, total }: { atual: number; total: number }) {
  const ok = atual >= total
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
        ok
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      }`}
    >
      {atual}/{total}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function str(v: unknown): string {
  if (v == null) return ""
  return String(v)
}

/** Extrai município de naturalidade (campo separado, objeto do reducer, ou string legada) */
function getNaturalMunicipio(d: Diplomado | undefined): string {
  if (!d) return ""
  if (d.naturalidade_cidade) return d.naturalidade_cidade
  // Fallback 1: reducer pode gravar naturalidade como objeto { cidade, uf }
  if (d.naturalidade && typeof d.naturalidade === "object") {
    const nat = d.naturalidade as unknown as { cidade?: string; uf?: string }
    return nat.cidade ?? ""
  }
  // Fallback 2: string legada "Cidade - UF" ou "Cidade/UF"
  if (d.naturalidade && typeof d.naturalidade === "string") {
    const m = d.naturalidade.match(/^(.+?)[\s]*[-\/][\s]*[A-Z]{2}$/)
    if (m) return m[1].trim()
    return d.naturalidade
  }
  return ""
}

/** Extrai UF de naturalidade */
function getNaturalUf(d: Diplomado | undefined): string {
  if (!d) return ""
  if (d.naturalidade_uf) return d.naturalidade_uf
  // Fallback 1: reducer pode gravar naturalidade como objeto { cidade, uf }
  if (d.naturalidade && typeof d.naturalidade === "object") {
    const nat = d.naturalidade as unknown as { cidade?: string; uf?: string }
    return nat.uf ?? ""
  }
  // Fallback 2: string legada
  if (d.naturalidade && typeof d.naturalidade === "string") {
    const m = d.naturalidade.match(/([A-Z]{2})$/)
    if (m) return m[1]
  }
  return ""
}

/** Código IBGE do município */
function getNaturalCodigo(d: Diplomado | undefined): string {
  if (!d) return ""
  return d.naturalidade_codigo_municipio ?? ""
}

function getGenitores(d: Diplomado | undefined): Genitor[] {
  if (!d) return [{ nome: "", sexo: "" }]
  if (d.genitores && d.genitores.length > 0) return d.genitores
  const gs: Genitor[] = []
  if (d.nome_mae) gs.push({ nome: d.nome_mae, sexo: "F" })
  if (d.nome_pai) gs.push({ nome: d.nome_pai, sexo: "M" })
  return gs.length > 0 ? gs : [{ nome: "", sexo: "" }]
}

function getEnadeNorm(e: Enade | undefined): { habilitado: string; condicao: string; ano: string } {
  if (!e) return { habilitado: "", condicao: "", ano: "" }
  return {
    habilitado: e.habilitado ?? "",
    condicao: e.condicao ?? e.condicao_aluno ?? "",
    ano: e.ano ?? e.edicao_ano ?? "",
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

export function FormularioRevisao({
  dados,
  onChange,
  cursos = [],
  cursoSelecionadoId,
  onCursoSelecionado,
}: Props) {
  const dip = dados.diplomado ?? {}
  const cur = dados.curso ?? {}
  const ies = dados.ies ?? {}
  const enade = getEnadeNorm(dados.enade)
  const disciplinas = dados.disciplinas ?? []
  const genitores = getGenitores(dados.diplomado)

  // ── IBGE: auto-lookup código município quando município + UF mudam ──
  const [buscandoIBGE, setBuscandoIBGE] = useState(false)
  const ibgeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Ref para evitar stale closure — sempre aponta pro onChange mais recente
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const dadosRef = useRef(dados)
  dadosRef.current = dados

  const buscarCodigoIBGE = useCallback(
    async (municipio: string, uf: string) => {
      if (!municipio || municipio.length < 3 || !uf) return
      setBuscandoIBGE(true)
      try {
        const params = new URLSearchParams({ nome: municipio, uf })
        const res = await fetch(`/api/ibge-municipios?${params}`)
        if (!res.ok) throw new Error("Erro IBGE")
        const data: { codigo: string; nome: string; uf: string }[] = await res.json()
        if (data.length > 0) {
          const nomNorm = municipio
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
          const match = data.find((m) =>
            m.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === nomNorm
          ) || data[0]
          // Usar refs para pegar o estado mais recente (sem stale closure)
          const dadosAtuais = dadosRef.current
          const dipAtual = dadosAtuais.diplomado ?? {}
          onChangeRef.current({
            ...dadosAtuais,
            diplomado: { ...dipAtual, naturalidade_codigo_municipio: match.codigo },
          })
        }
      } catch {
        // silencioso — operador pode preencher manualmente
      } finally {
        setBuscandoIBGE(false)
      }
    },
    [], // sem deps — usa refs para estado fresco
  )

  // Debounce: buscar IBGE 600ms após parar de digitar município ou UF
  const natMun = getNaturalMunicipio(dados.diplomado)
  const natUf = getNaturalUf(dados.diplomado)
  const natCod = getNaturalCodigo(dados.diplomado)
  useEffect(() => {
    if (ibgeTimerRef.current) clearTimeout(ibgeTimerRef.current)
    // Dispara se município (3+ chars) + UF presentes E código ainda vazio
    if (natMun && natMun.length >= 3 && natUf && !natCod) {
      ibgeTimerRef.current = setTimeout(() => buscarCodigoIBGE(natMun, natUf), 600)
    }
    return () => { if (ibgeTimerRef.current) clearTimeout(ibgeTimerRef.current) }
  }, [natMun, natUf, natCod, buscarCodigoIBGE])

  // Dados das novas seções
  const atividades = dados.atividades_complementares ?? []
  const estagios = dados.estagios ?? []
  const assinantes = dados.assinantes ?? []
  const habilitacoes = dados.habilitacoes ?? []
  const areas = dados.areas ?? []

  // Estado de seções abertas/fechadas
  const [secoes, setSecoes] = useState<Record<string, boolean>>({
    processo: true,
    pessoais: true,
    curso: true,
    emissora: true,
    enade: true,
    disciplinas: disciplinas.length > 0,
    academicos_extras: false,
    atividades: false,
    estagios: false,
    assinantes: false,
    habilitacoes: false,
    decisao_judicial: false,
  })
  const toggle = useCallback(
    (id: string) => setSecoes((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  )

  /* Helpers de atualização */
  function mudaDip(campo: string, valor: string) {
    const atual = dados.diplomado ?? {}
    onChange({ ...dados, diplomado: { ...atual, [campo]: valor || null } })
  }
  function mudaCur(campo: string, valor: string) {
    const atual = dados.curso ?? {}
    onChange({ ...dados, curso: { ...atual, [campo]: valor || null } })
  }
  function mudaIes(campo: string, valor: string) {
    const atual = dados.ies ?? {}
    onChange({ ...dados, ies: { ...atual, [campo]: valor || null } })
  }
  function mudaEnade(campo: string, valor: string) {
    const atual = dados.enade ?? {}
    onChange({ ...dados, enade: { ...atual, [campo]: valor || null } })
  }
  function mudaTop(campo: string, valor: unknown) {
    onChange({ ...dados, [campo]: valor })
  }

  /* ── Atividades Complementares ── */
  function addAtividade() {
    const nova: AtivComplementar = { id: `ativ-${Date.now()}`, tipo: "", descricao: "" }
    onChange({ ...dados, atividades_complementares: [...atividades, nova] })
  }
  function mudaAtividade(idx: number, campo: string, valor: string) {
    const novos = [...atividades]
    novos[idx] = { ...novos[idx], [campo]: valor || null }
    onChange({ ...dados, atividades_complementares: novos })
  }
  function removeAtividade(idx: number) {
    onChange({ ...dados, atividades_complementares: atividades.filter((_, i) => i !== idx) })
  }

  /* ── Estágios ── */
  function addEstagio() {
    const novo: EstagioRevisao = { id: `est-${Date.now()}`, descricao: "" }
    onChange({ ...dados, estagios: [...estagios, novo] })
  }
  function mudaEstagio(idx: number, campo: string, valor: string) {
    const novos = [...estagios]
    novos[idx] = { ...novos[idx], [campo]: valor || null }
    onChange({ ...dados, estagios: novos })
  }
  function removeEstagio(idx: number) {
    onChange({ ...dados, estagios: estagios.filter((_, i) => i !== idx) })
  }

  /* ── Assinantes ── */
  function addAssinante() {
    const novo: AssinanteRevisao = { id: `ass-${Date.now()}`, nome: "", cpf: "", cargo: "" }
    onChange({ ...dados, assinantes: [...assinantes, novo] })
  }
  function mudaAssinante(idx: number, campo: string, valor: string) {
    const novos = [...assinantes]
    novos[idx] = { ...novos[idx], [campo]: valor || null }
    onChange({ ...dados, assinantes: novos })
  }
  function removeAssinante(idx: number) {
    onChange({ ...dados, assinantes: assinantes.filter((_, i) => i !== idx) })
  }

  /* ── Habilitações ── */
  function addHabilitacao() {
    const nova: HabilitacaoRevisao = { id: `hab-${Date.now()}`, nome: "", data: "" }
    onChange({ ...dados, habilitacoes: [...habilitacoes, nova] })
  }
  function mudaHabilitacao(idx: number, campo: string, valor: string) {
    const novos = [...habilitacoes]
    novos[idx] = { ...novos[idx], [campo]: valor || null }
    onChange({ ...dados, habilitacoes: novos })
  }
  function removeHabilitacao(idx: number) {
    onChange({ ...dados, habilitacoes: habilitacoes.filter((_, i) => i !== idx) })
  }

  /* ── Disciplinas ── */
  function mudaDisciplina(idx: number, campo: string, valor: string) {
    const novos = [...disciplinas]
    // nota e carga_horaria são numéricos; demais campos são strings
    if (campo === "nota" || campo === "carga_horaria") {
      const n = parseFloat(valor)
      novos[idx] = { ...novos[idx], [campo]: valor === "" ? null : isNaN(n) ? null : n }
    } else {
      novos[idx] = { ...novos[idx], [campo]: valor || null }
    }
    onChange({ ...dados, disciplinas: novos })
  }

  function addDisciplina(periodo: string) {
    const novaDisciplina: Disciplina = {
      codigo: null, nome: "", carga_horaria: null, nota: null,
      situacao: "Aprovado", docente: null, titulacao_docente: null,
      periodo: /^\d+$/.test(periodo.trim()) ? parseInt(periodo.trim(), 10) : periodo,
    }
    onChange({ ...dados, disciplinas: [...disciplinas, novaDisciplina] })
  }

  function removeDisciplina(origIdx: number) {
    const novos = disciplinas.filter((_, i) => i !== origIdx)
    onChange({ ...dados, disciplinas: novos })
  }

  /* ── Áreas do Curso ── */
  function addArea() {
    onChange({ ...dados, areas: [...areas, { codigo: "", nome: "" }] })
  }
  function mudaArea(idx: number, campo: string, valor: string) {
    const novos = [...areas]
    novos[idx] = { ...novos[idx], [campo]: valor || null }
    onChange({ ...dados, areas: novos })
  }
  function removeArea(idx: number) {
    onChange({ ...dados, areas: areas.filter((_, i) => i !== idx) })
  }

  /* ── Campos Personalizados ── */
  const camposExtras = dados.campos_extras ?? []
  function addCampoExtra() {
    onChange({ ...dados, campos_extras: [...camposExtras, { chave: "", valor: "" }] })
  }
  function mudaCampoExtra(idx: number, campo: "chave" | "valor", valor: string) {
    const novos = [...camposExtras]
    novos[idx] = { ...novos[idx], [campo]: valor }
    onChange({ ...dados, campos_extras: novos })
  }
  function removeCampoExtra(idx: number) {
    onChange({ ...dados, campos_extras: camposExtras.filter((_, i) => i !== idx) })
  }

  function atualizarGenitor(idx: number, campo: string, valor: string) {
    const novos = [...genitores]
    novos[idx] = { ...novos[idx], [campo]: valor || null }
    onChange({ ...dados, diplomado: { ...dados.diplomado, genitores: novos } })
  }
  function adicionarGenitor() {
    onChange({
      ...dados,
      diplomado: { ...dados.diplomado, genitores: [...genitores, { nome: "", sexo: "" }] },
    })
  }
  function removerGenitor(idx: number) {
    if (genitores.length <= 1) return
    onChange({
      ...dados,
      diplomado: { ...dados.diplomado, genitores: genitores.filter((_, i) => i !== idx) },
    })
  }

  /* Contadores */
  const preenchDip = [dip.nome_completo, dip.cpf, dip.data_nascimento, dip.sexo, dip.nacionalidade, getNaturalMunicipio(dip), getNaturalCodigo(dip), getNaturalUf(dip), dip.rg]
    .filter((v) => v && String(v).trim() !== "").length
  const preenchCur = [cur.nome, cur.grau, cur.titulo_conferido, cur.forma_acesso, cur.data_inicio, cur.data_conclusao, cur.carga_horaria]
    .filter((v) => v != null && String(v).trim() !== "").length

  const temCadastro = !!cursoSelecionadoId

  /* ── Exportar PDF ─────────────────────────────────────────────────────── */
  function exportarPDF() {
    const cursoInfo = cursos.find((c) => c.id === cursoSelecionadoId)

    const fmt = (d: string | null | undefined) => {
      if (!d) return "—"
      try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR") } catch { return d }
    }
    const esc = (s: string | null | undefined) => {
      if (!s) return "—"
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }

    const nomeProcesso = dip.cpf && dip.nome_completo
      ? `${String(dip.cpf)} - ${String(dip.nome_completo)}`
      : esc(dip.nome_completo) || "Processo"

    const genitorText = genitores.length > 0
      ? genitores.map((g) => `${esc(String(g.nome ?? ""))} (${esc(String(g.sexo ?? ""))})`).join(", ")
      : "—"

    // ── Disciplinas — agrupadas por período (igual ao formulário)
    const discPorPeriodo = new Map<string, typeof dados.disciplinas>()
    ;(dados.disciplinas ?? []).forEach((d) => {
      const per = d.periodo != null ? String(d.periodo) : "Sem período"
      if (!discPorPeriodo.has(per)) discPorPeriodo.set(per, [])
      discPorPeriodo.get(per)!.push(d)
    })
    const discHtml = [...discPorPeriodo.entries()].map(([periodo, discs]) => {
      const chTotal = (discs ?? []).reduce((sum, d) => {
        const sit = (d.situacao ?? "").toLowerCase()
        if (sit === "reprovado" || sit === "trancado") return sum
        return sum + (d.carga_horaria ?? 0)
      }, 0)
      const rows = (discs ?? []).map((d, i) => {
        const estagio = ehDisciplinaEstagio(d)
        return `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(d.codigo)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(d.nome)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${d.carga_horaria ?? "—"}h</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${estagio ? "—" : (d.nota != null ? Number(d.nota).toFixed(2) : "—")}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(d.situacao)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(d.docente)}</td>
        </tr>`
      }).join("")
      return `
        <div style="margin-bottom:14px;page-break-inside:avoid;">
          <div style="display:flex;align-items:center;gap:10px;background:#f0fdf4;border-left:4px solid #16a34a;padding:6px 10px;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.3px;">${esc(periodo)}</span>
            <span style="font-size:11px;color:#6b7280;">${(discs ?? []).length} disciplina${(discs ?? []).length !== 1 ? "s" : ""}</span>
          </div>
          <table>
            <thead><tr>
              <th style="width:60px;">Código</th>
              <th>Disciplina</th>
              <th style="width:48px;text-align:center;">CH</th>
              <th style="width:48px;text-align:center;">Nota</th>
              <th style="width:80px;text-align:center;">Situação</th>
              <th>Docente</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr>
              <td colspan="2" style="padding:4px 8px;border:1px solid #ddd;font-size:11px;font-weight:600;color:#6b7280;">Total do período</td>
              <td colspan="4" style="padding:4px 8px;border:1px solid #ddd;font-size:11px;font-weight:700;color:#16a34a;">${chTotal}h</td>
            </tr></tfoot>
          </table>
        </div>`
    }).join("")

    // ── Atividades
    const ativRows = atividades.map((a, i) =>
      `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(a.descricao || a.tipo)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(a.ch_hora_relogio)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${fmt(a.data_inicio)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${fmt(a.data_fim)}</td>
      </tr>`
    ).join("")

    // ── Estágios
    const estagRows = estagios.map((e, i) =>
      `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(e.concedente_razao_social)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(e.ch_hora_relogio)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${fmt(e.data_inicio)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${fmt(e.data_fim)}</td>
      </tr>`
    ).join("")

    // ── Assinantes
    const assinRows = assinantes.map((a, i) =>
      `<tr style="${i % 2 === 0 ? "background:#fafafa;" : ""}">
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(a.nome)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${esc(a.cpf)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${esc(a.cargo)}</td>
      </tr>`
    ).join("")

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Processo - ${nomeProcesso}</title>
  <style>
    @media print {
      body { margin: 0; padding: 53mm 20mm 38mm; }
      .no-print { display: none !important; }
      @page { margin: 0; size: A4; }
    }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.4; padding: 170px 50px 130px; max-width: 860px; margin: 0 auto; }
    .header { text-align: center; margin: 0 0 20px 0; }
    .header-doc-title { font-size: 13px; font-weight: 700; color: #1e40af; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.3px; }
    .header .meta { font-size: 11px; color: #6b7280; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title { font-size: 13px; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 8px 12px; border-left: 4px solid #1e40af; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; padding: 0 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; padding: 0 12px; }
    .field { margin-bottom: 4px; }
    .field .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .field .value { font-size: 12px; color: #111827; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 8px 0; }
    th { background: #1e40af; color: white; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; z-index: 1000; box-shadow: 0 2px 8px rgba(220,38,38,0.25); font-weight: 600; }
    .print-btn:hover { background: #b91c1c; }
    .footer { text-align: center; font-size: 10px; color: #9ca3af; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 30px; }
    .footer-brand { font-weight: 700; color: #1e40af; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

  <div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <img src="${window.location.origin}/TimbradoSISTEMA.png" style="width:100%;height:100%;object-fit:fill;" alt="">
  </div>

  <div class="header">
    <div class="header-doc-title">Dados do Processo de Emissão de Diploma Digital</div>
    <div class="meta">
      <strong>${nomeProcesso}</strong>
      &nbsp;&middot;&nbsp;
      Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Dados do Processo</div>
    <div class="grid">
      <div class="field" style="grid-column:1/-1"><div class="label">Nome do Processo</div><div class="value">${nomeProcesso}</div></div>
      <div class="field"><div class="label">Curso</div><div class="value">${esc(cursoInfo?.nome)}${cursoInfo?.grau ? ` (${esc(cursoInfo.grau)})` : ""}</div></div>
      <div class="field"><div class="label">Observações</div><div class="value">${esc(dados.observacoes) || "—"}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Dados Pessoais do Diplomado</div>
    <div class="grid">
      <div class="field"><div class="label">Nome Completo</div><div class="value">${esc(dip.nome_completo)}</div></div>
      <div class="field"><div class="label">Nome Social</div><div class="value">${esc(dip.nome_social) || "—"}</div></div>
      <div class="field"><div class="label">CPF</div><div class="value">${esc(dip.cpf)}</div></div>
      <div class="field"><div class="label">Data de Nascimento</div><div class="value">${fmt(dip.data_nascimento)}</div></div>
      <div class="field"><div class="label">Sexo</div><div class="value">${esc(dip.sexo)}</div></div>
      <div class="field"><div class="label">Nacionalidade</div><div class="value">${esc(dip.nacionalidade)}</div></div>
      <div class="field"><div class="label">Naturalidade</div><div class="value">${esc(getNaturalMunicipio(dados.diplomado))} - ${esc(getNaturalUf(dados.diplomado))}</div></div>
      <div class="field"><div class="label">RG</div><div class="value">${esc(dip.rg)} (${esc(dip.rg_orgao)} - ${esc(dip.rg_uf)})</div></div>
      <div class="field"><div class="label">Telefone</div><div class="value">${esc(dip.telefone)}</div></div>
      <div class="field"><div class="label">E-mail</div><div class="value">${esc(dip.email)}</div></div>
      <div class="field"><div class="label">Filiação</div><div class="value">${genitorText}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Dados Acadêmicos / Histórico</div>
    <div class="grid">
      <div class="field"><div class="label">Nome do Curso</div><div class="value">${esc(cur.nome)}</div></div>
      <div class="field"><div class="label">Grau Conferido</div><div class="value">${esc(cur.grau)}</div></div>
      <div class="field"><div class="label">Título Conferido</div><div class="value">${esc(cur.titulo_conferido)}</div></div>
      <div class="field"><div class="label">Modalidade</div><div class="value">${esc(cur.modalidade)}</div></div>
      <div class="field"><div class="label">Forma de Acesso</div><div class="value">${esc(cur.forma_acesso)}</div></div>
      <div class="field"><div class="label">Data de Ingresso</div><div class="value">${fmt(cur.data_inicio)}</div></div>
      <div class="field"><div class="label">Data de Conclusão</div><div class="value">${fmt(cur.data_conclusao)}</div></div>
      <div class="field"><div class="label">Situação Discente</div><div class="value">${esc(dados.situacao_discente)}</div></div>
      <div class="field"><div class="label">Código Currículo</div><div class="value">${esc(cur.codigo_curriculo)}</div></div>
      <div class="field"><div class="label">CH Curso (prevista)</div><div class="value">${cur.carga_horaria ?? "—"}h</div></div>
      <div class="field"><div class="label">CH Integralizada</div><div class="value">${dados.carga_horaria_integralizada ?? "—"}h</div></div>
      <div class="field"><div class="label">Hora-Aula (min)</div><div class="value">${cur.hora_aula_min ?? "—"}</div></div>
    </div>
    <div style="margin-top:10px;padding:0 12px;">
      <div class="section-title" style="font-size:12px;margin-bottom:6px;">ENADE</div>
      <div class="grid-3">
        <div class="field"><div class="label">Habilitado</div><div class="value">${esc(dados.enade?.habilitado)}</div></div>
        <div class="field"><div class="label">Condição do Aluno</div><div class="value">${esc(dados.enade?.condicao)}</div></div>
        <div class="field"><div class="label">Edição/Ano</div><div class="value">${esc(dados.enade?.ano)}</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">4. Disciplinas (${(dados.disciplinas ?? []).length} disciplinas)</div>
    <div style="padding:0 4px;">
      ${(dados.disciplinas ?? []).length > 0 ? discHtml : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhuma disciplina cadastrada.</p>"}
    </div>
  </div>

  <div class="section">
    <div class="section-title">5. Atividades Complementares (${atividades.length})</div>
    ${atividades.length > 0 ? `
    <table>
      <thead><tr><th>Descrição</th><th style="text-align:center;">CH</th><th style="text-align:center;">Início</th><th style="text-align:center;">Fim</th></tr></thead>
      <tbody>${ativRows}</tbody>
    </table>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhuma atividade complementar.</p>"}
  </div>

  <div class="section">
    <div class="section-title">6. Estágios (${estagios.length})</div>
    ${estagios.length > 0 ? `
    <table>
      <thead><tr><th>Concedente</th><th style="text-align:center;">CH</th><th style="text-align:center;">Início</th><th style="text-align:center;">Fim</th></tr></thead>
      <tbody>${estagRows}</tbody>
    </table>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhum estágio cadastrado.</p>"}
  </div>

  <div class="section">
    <div class="section-title">7. Assinantes do Diploma</div>
    <div class="grid" style="margin-bottom:8px;">
      <div class="field"><div class="label">e-CNPJ Emissora</div><div class="value">${esc(dados.ecnpj_emissora)}</div></div>
    </div>
    ${assinantes.length > 0 ? `
    <table>
      <thead><tr><th>Nome</th><th style="text-align:center;">CPF</th><th>Cargo</th></tr></thead>
      <tbody>${assinRows}</tbody>
    </table>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhum assinante cadastrado.</p>"}
  </div>

  <div class="section">
    <div class="section-title">8. Habilitações (${habilitacoes.length})</div>
    ${habilitacoes.length > 0
      ? habilitacoes.map((h) => `<div style="padding:4px 12px;font-size:12px;"><strong>${esc(h.nome)}</strong> — ${fmt(h.data)}</div>`).join("")
      : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Nenhuma habilitação.</p>"}
  </div>

  <div class="section">
    <div class="section-title">9. Decisão Judicial</div>
    ${dados.decisao_judicial ? `
    <div class="grid">
      <div class="field"><div class="label">Nº Processo</div><div class="value">${esc(dados.dj_numero_processo)}</div></div>
      <div class="field"><div class="label">Nome do Juiz</div><div class="value">${esc(dados.dj_nome_juiz)}</div></div>
      <div class="field"><div class="label">Decisão</div><div class="value">${esc(dados.dj_decisao)}</div></div>
      <div class="field"><div class="label">Declarações</div><div class="value">${esc(dados.dj_declaracoes)}</div></div>
    </div>
    ` : "<p style='padding:0 12px;font-size:12px;color:#6b7280;'>Não se aplica — emissão sem decisão judicial.</p>"}
  </div>

  <div class="footer">
    <span class="footer-brand">FIC</span> — Faculdades Integradas de Cassilândia &middot; Sistema de Gestão Integrado — Diploma Digital &middot; Documento gerado automaticamente
  </div>
</body>
</html>`

    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Barra de ações ── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportarPDF}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm font-medium"
          title="Exportar dados do processo em PDF"
        >
          <Printer size={16} />
          Exportar PDF
        </button>
      </div>

      {/* ─────────────── SEÇÃO 0: DADOS DO PROCESSO ─────────────── */}
      {(() => {
        const nomeProcesso =
          dip.cpf && dip.nome_completo
            ? `${String(dip.cpf)} - ${String(dip.nome_completo)}`
            : str(dip.nome_completo) || "—"
        const cursoAtual = cursos.find((c) => c.id === cursoSelecionadoId)
        return (
          <Secao
            titulo="Dados do Processo"
            icone={<FileText size={18} />}
            aberta={secoes.processo ?? true}
            onToggle={() => toggle("processo")}
            cor="violet"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Nome do Processo — readonly, derivado de CPF + Nome */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nome do Processo
                </label>
                <input
                  type="text"
                  value={nomeProcesso}
                  readOnly
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-default"
                />
                <p className="text-xs text-gray-400 mt-1">Gerado automaticamente a partir do CPF e Nome do diplomado</p>
              </div>
              {/* Curso — readonly, exibido do cadastro */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Curso
                </label>
                <input
                  type="text"
                  value={cursoAtual?.nome ?? str(cur.nome) ?? "—"}
                  readOnly
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-default"
                />
              </div>
            </div>
            <Separador label="Observações" />
            <textarea
              value={str(dados.observacoes)}
              onChange={(e) => mudaTop("observacoes", e.target.value || null)}
              rows={3}
              placeholder="Observações gerais sobre o processo (opcional)"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:bg-gray-800 dark:text-gray-100"
            />
          </Secao>
        )
      })()}

      {/* ─────────────── SEÇÃO 1: DADOS PESSOAIS ─────────────── */}
      <Secao
        titulo="Dados Pessoais do Diplomado"
        icone={<UserPlus size={18} />}
        aberta={secoes.pessoais ?? true}
        onToggle={() => toggle("pessoais")}
        cor="blue"
        badge={<BadgeCount atual={preenchDip} total={9} />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoInput label="Nome completo" value={str(dip.nome_completo)} onChange={(v) => mudaDip("nome_completo", v)} obrigatorio destaque fonte="ia" />
          <CampoInput label="Nome social" value={str(dip.nome_social)} onChange={(v) => mudaDip("nome_social", v)} dica="Opcional — conforme identidade de gênero" />
          <CampoInput label="CPF" value={str(dip.cpf)} onChange={(v) => mudaDip("cpf", v)} obrigatorio destaque fonte="ia" dica="11 dígitos, sem pontos" />
          <CampoInput label="Data de nascimento" value={str(dip.data_nascimento)} onChange={(v) => mudaDip("data_nascimento", v)} tipo="date" obrigatorio destaque fonte="ia" />
          <CampoSelect label="Sexo" value={str(dip.sexo)} onChange={(v) => mudaDip("sexo", v)} opcoes={SEXO_OPTIONS} obrigatorio />
          <CampoInput label="Nacionalidade" value={str(dip.nacionalidade)} onChange={(v) => mudaDip("nacionalidade", v)} obrigatorio destaque fonte="ia" placeholder="Ex: Brasileira" />
          <CampoInput label="Naturalidade — Município" value={getNaturalMunicipio(dados.diplomado)} onChange={(v) => {
            const atual = dados.diplomado ?? {}
            onChange({ ...dados, diplomado: { ...atual, naturalidade_cidade: v || null, naturalidade_codigo_municipio: null } })
          }} obrigatorio placeholder="Ex: Cassilândia" />
          <div className="relative">
            <CampoInput
              label={`Naturalidade — Código IBGE${buscandoIBGE ? " (buscando...)" : ""}`}
              value={getNaturalCodigo(dados.diplomado)}
              onChange={(v) => mudaDip("naturalidade_codigo_municipio", v)}
              obrigatorio
              placeholder={buscandoIBGE ? "Consultando IBGE..." : "7 dígitos — auto-preenchido"}
              dica="Código IBGE de 7 dígitos (obrigatório no XSD)"
            />
            {buscandoIBGE && (
              <Loader2
                size={16}
                className="absolute right-3 top-9 animate-spin text-violet-500"
              />
            )}
          </div>
          <CampoSelect label="Naturalidade — UF" value={getNaturalUf(dados.diplomado)} onChange={(v) => {
            const atual = dados.diplomado ?? {}
            onChange({ ...dados, diplomado: { ...atual, naturalidade_uf: v || null, naturalidade_codigo_municipio: null } })
          }} opcoes={UF_OPTIONS} obrigatorio />
          <CampoInput label="RG — Número" value={str(dip.rg)} onChange={(v) => mudaDip("rg", v)} obrigatorio destaque fonte="ia" />
          <CampoInput label="Órgão expedidor" value={str(dip.rg_orgao)} onChange={(v) => mudaDip("rg_orgao", v)} placeholder="Ex: SSP" />
          <CampoSelect label="UF do RG" value={str(dip.rg_uf)} onChange={(v) => mudaDip("rg_uf", v)} opcoes={UF_OPTIONS} />
          <CampoInput label="Telefone" value={str(dip.telefone)} onChange={(v) => mudaDip("telefone", v)} tipo="tel" dica="Uso interno — não vai no XML" />
          <CampoInput label="E-mail" value={str(dip.email)} onChange={(v) => mudaDip("email", v)} tipo="email" dica="Uso interno — não vai no XML" />
        </div>

        {/* Documento alternativo (estrangeiros) */}
        <Separador label="Documento alternativo (estrangeiros)" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoInput label="Tipo do documento" value={str(dip.outro_doc_tipo)} onChange={(v) => mudaDip("outro_doc_tipo", v)} placeholder="Ex: Passaporte" />
          <CampoInput label="Identificador" value={str(dip.outro_doc_id)} onChange={(v) => mudaDip("outro_doc_id", v)} placeholder="Número do documento" />
        </div>

        {/* Filiação */}
        <Separador label="Filiação (mínimo 1 genitor obrigatório)" />
        <div className="space-y-3">
          {genitores.map((g, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
              <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-3">
                <CampoInput
                  label={`Genitor ${idx + 1} — Nome`}
                  value={str(g.nome)}
                  onChange={(v) => atualizarGenitor(idx, "nome", v)}
                  obrigatorio={idx === 0}
                  destaque={idx === 0}
                  fonte="ia"
                />
                <CampoInput
                  label="Nome social"
                  value={str(g.nome_social)}
                  onChange={(v) => atualizarGenitor(idx, "nome_social", v)}
                />
                <CampoSelect
                  label="Sexo"
                  value={str(g.sexo)}
                  onChange={(v) => atualizarGenitor(idx, "sexo", v)}
                  opcoes={SEXO_OPTIONS}
                  obrigatorio={idx === 0}
                />
              </div>
              {genitores.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerGenitor(idx)}
                  className="mt-5 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Remover genitor"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={adicionarGenitor}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus size={12} /> Adicionar genitor
          </button>
        </div>
      </Secao>

      {/* ─────────────── SEÇÃO 2: DADOS DO CURSO ─────────────── */}
      <Secao
        titulo="Dados do Curso / Acadêmicos"
        icone={<GraduationCap size={18} />}
        aberta={secoes.curso ?? true}
        onToggle={() => toggle("curso")}
        cor="green"
        badge={<BadgeCount atual={preenchCur} total={7} />}
      >
        {/* Seletor de curso do cadastro */}
        {cursos.length > 0 && (
          <div className="mb-5 p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
            <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">
              Vincular ao curso cadastrado (auto-preenche campos + IES)
            </label>
            <select
              value={cursoSelecionadoId ?? ""}
              onChange={(e) => onCursoSelecionado?.(e.target.value)}
              className="w-full border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">— Selecionar curso —</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.grau ? ` (${c.grau.toLowerCase()})` : ""}
                  {c.modalidade ? ` — ${c.modalidade.toLowerCase()}` : ""}
                </option>
              ))}
            </select>
            {temCadastro && (
              <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Sparkles size={12} /> Campos preenchidos do cadastro. Você pode editar manualmente.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoInput label="Nome do curso" value={str(cur.nome)} onChange={(v) => mudaCur("nome", v)} obrigatorio destaque fonte={temCadastro ? "cadastro" : "ia"} />
          <CampoInput label="Código e-MEC" value={str(cur.codigo_emec)} onChange={(v) => mudaCur("codigo_emec", v)} obrigatorio destaque fonte={temCadastro ? "cadastro" : undefined} dica="Obrigatório no XSD (ou SemCodigo)" />
          <CampoSelect label="Grau conferido" value={str(cur.grau)} onChange={(v) => mudaCur("grau", v)} opcoes={GRAU_OPTIONS} obrigatorio fonte={temCadastro ? "cadastro" : undefined} />
          <CampoSelect label="Título conferido" value={str(cur.titulo_conferido)} onChange={(v) => mudaCur("titulo_conferido", v)} opcoes={TITULO_OPTIONS} obrigatorio fonte={temCadastro ? "cadastro" : undefined} />
          <CampoSelect label="Modalidade" value={str(cur.modalidade)} onChange={(v) => mudaCur("modalidade", v)} opcoes={MODALIDADE_OPTIONS} fonte={temCadastro ? "cadastro" : undefined} />
          <CampoSelect label="Forma de acesso" value={str(cur.forma_acesso)} onChange={(v) => mudaCur("forma_acesso", v)} opcoes={FORMA_ACESSO_OPTIONS} obrigatorio />
        </div>

        <Separador label="Datas e carga horária" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CampoInput label="Data de ingresso" value={str(cur.data_inicio)} onChange={(v) => mudaCur("data_inicio", v)} tipo="date" obrigatorio destaque fonte="ia" />
          <CampoInput label="Data de conclusão" value={str(cur.data_conclusao)} onChange={(v) => mudaCur("data_conclusao", v)} tipo="date" obrigatorio destaque fonte="ia" />
          <CampoInput label="Data de colação de grau" value={str(cur.data_colacao)} onChange={(v) => mudaCur("data_colacao", v)} tipo="date" fonte="ia" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <CampoInput label="CH do curso (prevista)" value={str(cur.carga_horaria)} onChange={(v) => mudaCur("carga_horaria", v)} tipo="number" obrigatorio destaque fonte={temCadastro ? "cadastro" : "ia"} />
          <CampoInput label="CH integralizada" value={str(cur.ch_cumprida)} onChange={(v) => mudaCur("ch_cumprida", v)} tipo="number" dica="CH cumprida pelo aluno" />
          <CampoInput label="Hora-aula (min)" value={str(cur.hora_aula_min)} onChange={(v) => mudaCur("hora_aula_min", v)} tipo="number" dica="Duração em minutos" />
          <CampoInput label="Código do currículo" value={str(cur.codigo_curriculo)} onChange={(v) => mudaCur("codigo_curriculo", v)} />
        </div>
      </Secao>

      {/* ─────────────── SEÇÃO 3: IES EMISSORA ─────────────── */}
      <Secao
        titulo="IES Emissora"
        icone={<Building2 size={18} />}
        aberta={secoes.emissora ?? true}
        onToggle={() => toggle("emissora")}
        cor="violet"
        badge={
          temCadastro ? (
            <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full font-medium">
              Auto-preenchido
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <CampoInput label="Nome da IES" value={str(ies.nome)} onChange={(v) => mudaIes("nome", v)} obrigatorio destaque fonte={temCadastro ? "cadastro" : "ia"} />
          <CampoInput label="CNPJ" value={str(ies.cnpj)} onChange={(v) => mudaIes("cnpj", v)} obrigatorio destaque fonte={temCadastro ? "cadastro" : "ia"} dica="14 dígitos, sem pontos" />
          <CampoInput label="Código e-MEC" value={str(ies.codigo_mec)} onChange={(v) => mudaIes("codigo_mec", v)} fonte="cadastro" dica="Ex: 1606" />
        </div>
        <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
          Endereço, credenciamento e atos regulatórios são carregados automaticamente do cadastro da instituição ao gerar o XML.
        </p>
      </Secao>

      {/* ─────────────── SEÇÃO 4: ENADE ─────────────── */}
      <Secao
        titulo="ENADE"
        icone={<ClipboardCheck size={18} />}
        aberta={secoes.enade ?? true}
        onToggle={() => toggle("enade")}
        cor="amber"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <CampoSelect label="Habilitado" value={enade.habilitado} onChange={(v) => mudaEnade("habilitado", v)} opcoes={SIM_NAO_OPTIONS} obrigatorio />
          <CampoSelect label="Condição do aluno" value={enade.condicao} onChange={(v) => mudaEnade("condicao", v)} opcoes={ENADE_CONDICAO_OPTIONS} obrigatorio />
          <CampoInput label="Ano do ENADE" value={enade.ano} onChange={(v) => mudaEnade("ano", v)} tipo="number" placeholder="Ex: 2024" />
        </div>
      </Secao>

      {/* ─────────────── SEÇÃO 5: DISCIPLINAS (editável, agrupada por período) ─── */}
      <Secao
        titulo="Disciplinas do Histórico"
        icone={<BookText size={18} />}
        aberta={secoes.disciplinas ?? false}
        onToggle={() => toggle("disciplinas")}
        cor="teal"
        badge={
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              disciplinas.length > 0
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {disciplinas.length} disc.
          </span>
        }
      >
        {(() => {
          // ── Agrupamento por período ──────────────────────────────────────
          const grupos = new Map<string, Array<{ origIdx: number; d: Disciplina }>>()
          disciplinas.forEach((d, i) => {
            const per = String(d.periodo ?? "Sem período")
            if (!grupos.has(per)) grupos.set(per, [])
            grupos.get(per)!.push({ origIdx: i, d })
          })
          const gruposOrdenados = Array.from(grupos.entries()).sort(([a], [b]) => {
            const nA = parseFloat(a), nB = parseFloat(b)
            if (!isNaN(nA) && !isNaN(nB)) return nA - nB
            return a.localeCompare(b, "pt-BR")
          })
          gruposOrdenados.forEach(([, items]) =>
            items.sort((x, y) => (x.d.nome ?? "").localeCompare(y.d.nome ?? "", "pt-BR"))
          )
          const fmtPeriodo = (p: string) => {
            if (/^\d+$/.test(p.trim())) return `${p.trim()}º Período`
            if (p === "Sem período") return "Sem período"
            return p
          }
          // CH total integralizada (soma de todas as disciplinas aprovadas/cumpriu)
          const chTotal = disciplinas.reduce((acc, d) => {
            const sit = (d.situacao ?? "").toLowerCase()
            if (sit.includes("reprov") || sit.includes("tranc")) return acc
            return acc + (d.carga_horaria ?? 0)
          }, 0)

          return (
            <div className="space-y-5">
              {/* Aviso se vazio */}
              {disciplinas.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-4">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Nenhuma disciplina extraída</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      O histórico escolar é obrigatório no XML. Adicione as disciplinas manualmente abaixo.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Grupos por período ── */}
              {gruposOrdenados.map(([periodo, items]) => {
                const chPeriodo = items.reduce((acc, { d }) => {
                  const sit = (d.situacao ?? "").toLowerCase()
                  if (sit.includes("reprov") || sit.includes("tranc")) return acc
                  return acc + (d.carga_horaria ?? 0)
                }, 0)

                return (
                  <div key={periodo}>
                    {/* Cabeçalho do período */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full">
                          {fmtPeriodo(periodo)}
                        </span>
                        <span className="text-xs text-gray-400">{items.length} disciplina{items.length !== 1 ? "s" : ""}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addDisciplina(periodo)}
                        className="flex items-center gap-1 text-[11px] font-medium text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-200 px-2 py-1 rounded-md hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                        title={`Adicionar disciplina ao ${fmtPeriodo(periodo)}`}
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>

                    {/* Tabela editável */}
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 w-20">Código</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">Disciplina</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-500 dark:text-gray-400 w-16">CH</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-500 dark:text-gray-400 w-14">Nota</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 w-28">Situação</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">Docente</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 w-32">
                              Titulação <span className="text-teal-500">✎</span>
                            </th>
                            <th className="px-2 py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                          {items.map(({ origIdx, d }) => {
                            const isEstagio = ehDisciplinaEstagio(d)
                            return (
                              <tr key={origIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                {/* Código */}
                                <td className="px-2 py-1.5 font-mono">
                                  <input
                                    type="text"
                                    value={d.codigo ?? ""}
                                    onChange={(e) => mudaDisciplina(origIdx, "codigo", e.target.value)}
                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 text-xs text-gray-400 placeholder-gray-300"
                                    placeholder="—"
                                  />
                                </td>
                                {/* Nome */}
                                <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-gray-100 min-w-[180px]">
                                  <input
                                    type="text"
                                    value={d.nome ?? ""}
                                    onChange={(e) => mudaDisciplina(origIdx, "nome", e.target.value)}
                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 text-xs"
                                    placeholder="Nome da disciplina"
                                  />
                                </td>
                                {/* CH */}
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    type="number"
                                    value={d.carga_horaria ?? ""}
                                    onChange={(e) => mudaDisciplina(origIdx, "carga_horaria", e.target.value)}
                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 text-xs text-right text-gray-600 dark:text-gray-400"
                                    placeholder="0"
                                    min="0"
                                    step="1"
                                  />
                                </td>
                                {/* Nota — desabilitada para estágio */}
                                <td className="px-2 py-1.5 text-right">
                                  {isEstagio ? (
                                    <span className="text-[10px] text-gray-400 italic">—</span>
                                  ) : (
                                    <input
                                      type="number"
                                      value={d.nota ?? ""}
                                      onChange={(e) => mudaDisciplina(origIdx, "nota", e.target.value)}
                                      className="w-14 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 text-xs text-right text-gray-700 dark:text-gray-300"
                                      step="0.01"
                                      min="0"
                                      max="10"
                                      placeholder="—"
                                    />
                                  )}
                                </td>
                                {/* Situação */}
                                <td className="px-2 py-1.5">
                                  <select
                                    value={d.situacao ?? ""}
                                    onChange={(e) => mudaDisciplina(origIdx, "situacao", e.target.value)}
                                    className={`w-full rounded px-1.5 py-0.5 text-[11px] font-semibold border focus:outline-none focus:ring-1 focus:ring-teal-400 ${
                                      (d.situacao ?? "").toLowerCase().includes("aprov") || (d.situacao ?? "").toLowerCase() === "cumpriu"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                                        : (d.situacao ?? "").toLowerCase().includes("reprov")
                                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                          : "bg-white text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                    }`}
                                  >
                                    <option value="">— Situação —</option>
                                    {SITUACAO_DISCIPLINA_OPTIONS.map((o) => (
                                      <option key={o.valor} value={o.valor}>{o.label}</option>
                                    ))}
                                  </select>
                                </td>
                                {/* Docente */}
                                <td className="px-2 py-1.5 text-gray-500 min-w-[120px]">
                                  <input
                                    type="text"
                                    value={d.docente ?? ""}
                                    onChange={(e) => mudaDisciplina(origIdx, "docente", e.target.value)}
                                    className="w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-0 py-0 text-xs"
                                    placeholder="Nome do docente"
                                  />
                                </td>
                                {/* Titulação */}
                                <td className="px-2 py-1.5 min-w-[130px]">
                                  <select
                                    value={d.titulacao_docente ?? ""}
                                    onChange={(e) => mudaDisciplina(origIdx, "titulacao_docente", e.target.value)}
                                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400 dark:bg-gray-800"
                                  >
                                    <option value="">— Titulação —</option>
                                    {TITULACAO_DOCENTE_OPTIONS.map((o) => (
                                      <option key={o.valor} value={o.valor}>{o.label}</option>
                                    ))}
                                  </select>
                                </td>
                                {/* Excluir */}
                                <td className="px-1 py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeDisciplina(origIdx)}
                                    className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                    title="Remover disciplina"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        {/* Rodapé do período — totais */}
                        <tfoot>
                          <tr className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700">
                            <td colSpan={2} className="px-2 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                              Total do período
                            </td>
                            <td className="px-2 py-1.5 text-right text-[11px] font-bold text-teal-700 dark:text-teal-300">
                              {chPeriodo > 0 ? `${chPeriodo}h` : "—"}
                            </td>
                            <td colSpan={5} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })}

              {/* ── Botão para adicionar disciplina em novo período ── */}
              <button
                type="button"
                onClick={() => {
                  const novoPer = String(gruposOrdenados.length + 1)
                  addDisciplina(novoPer)
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-200 px-3 py-1.5 rounded-lg border border-dashed border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
              >
                <Plus size={13} /> Adicionar disciplina em novo período
              </button>

              {/* ── Total integralizado ── */}
              {disciplinas.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-teal-800 dark:text-teal-200">Carga Horária Integralizada</p>
                    <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-0.5">
                      Soma de disciplinas aprovadas / cumpriu ({disciplinas.filter((d) => {
                        const s = (d.situacao ?? "").toLowerCase()
                        return !s.includes("reprov") && !s.includes("tranc")
                      }).length} de {disciplinas.length} disciplinas)
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-teal-700 dark:text-teal-300">
                    {chTotal}h
                  </span>
                </div>
              )}
            </div>
          )
        })()}
        <p className="mt-3 text-xs text-gray-400">
          Todos os campos são editáveis. Estágios sem nota têm situação "Cumpriu". O total de CH exclui disciplinas reprovadas e trancadas.
        </p>
      </Secao>

      {/* ─────────────── SEÇÃO 6: CAMPOS ACADÊMICOS EXTRAS ─────────────── */}
      <Secao
        titulo="Campos Acadêmicos Extras"
        icone={<Clock size={18} />}
        aberta={secoes.academicos_extras ?? false}
        onToggle={() => toggle("academicos_extras")}
        cor="blue"
      >
        {/* Áreas do Curso */}
        <Separador label="Áreas do Curso" />
        <div className="space-y-2">
          {areas.map((a, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <CampoInput label="Código CINE" value={str(a.codigo)} onChange={(v) => mudaArea(idx, "codigo", v)} placeholder="Ex: 034" />
                <CampoInput label="Nome da área" value={str(a.nome)} onChange={(v) => mudaArea(idx, "nome", v)} placeholder="Ex: Negócios e administração" />
              </div>
              <button type="button" onClick={() => removeArea(idx)} className="mt-5 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Remover área">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addArea} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <Plus size={12} /> Adicionar área
          </button>
        </div>

        {/* Campos Personalizados */}
        <Separador label="Campos Personalizados" />
        <p className="text-xs text-gray-400 mb-3">
          Use para incluir qualquer campo que não tenha aparecido na extração automática.
        </p>
        <div className="space-y-2">
          {camposExtras.map((ce, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <CampoInput
                  label="Nome do campo"
                  value={ce.chave}
                  onChange={(v) => mudaCampoExtra(idx, "chave", v)}
                  placeholder="Ex: Código Curricular"
                />
                <CampoInput
                  label="Valor"
                  value={ce.valor}
                  onChange={(v) => mudaCampoExtra(idx, "valor", v)}
                  placeholder="Ex: GRAD-2023"
                />
              </div>
              <button
                type="button"
                onClick={() => removeCampoExtra(idx)}
                className="mb-1 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Remover campo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addCampoExtra}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus size={12} /> Adicionar campo personalizado
          </button>
        </div>
      </Secao>

      {/* ─────────────── SEÇÃO 7: ATIVIDADES COMPLEMENTARES ─────────────── */}
      <Secao
        titulo="Atividades Complementares"
        icone={<BookOpen size={18} />}
        aberta={secoes.atividades ?? false}
        onToggle={() => toggle("atividades")}
        cor="green"
        badge={atividades.length > 0 ? <BadgeCount atual={atividades.length} total={1} /> : undefined}
      >
        {atividades.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
            Nenhuma atividade complementar adicionada. Clique abaixo para incluir.
          </p>
        ) : (
          <div className="space-y-4">
            {atividades.map((a, idx) => (
              <div key={a.id ?? idx} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">Atividade {idx + 1}</span>
                  <button type="button" onClick={() => removeAtividade(idx)} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <CampoInput label="Código" value={str(a.codigo)} onChange={(v) => mudaAtividade(idx, "codigo", v)} placeholder="Código da atividade" />
                  <CampoInput label="Tipo" value={str(a.tipo)} onChange={(v) => mudaAtividade(idx, "tipo", v)} placeholder="Ex: Monitoria, Extensão" />
                  <CampoInput label="CH (hora-relógio)" value={str(a.ch_hora_relogio)} onChange={(v) => mudaAtividade(idx, "ch_hora_relogio", v)} tipo="number" />
                  <CampoInput label="Data início" value={str(a.data_inicio)} onChange={(v) => mudaAtividade(idx, "data_inicio", v)} tipo="date" />
                  <CampoInput label="Data fim" value={str(a.data_fim)} onChange={(v) => mudaAtividade(idx, "data_fim", v)} tipo="date" />
                </div>
                <CampoInput label="Descrição" value={str(a.descricao)} onChange={(v) => mudaAtividade(idx, "descricao", v)} placeholder="Descrição da atividade" />
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addAtividade} className="mt-3 flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
          <Plus size={12} /> Adicionar atividade complementar
        </button>
      </Secao>

      {/* ─────────────── SEÇÃO 8: ESTÁGIO NÃO-OBRIGATÓRIO ─────────────── */}
      <Secao
        titulo="Estágio Não-Obrigatório"
        icone={<Briefcase size={18} />}
        aberta={secoes.estagios ?? false}
        onToggle={() => toggle("estagios")}
        cor="amber"
        badge={estagios.length > 0 ? <BadgeCount atual={estagios.length} total={1} /> : undefined}
      >
        {estagios.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
            Nenhum estágio adicionado. Clique abaixo para incluir.
          </p>
        ) : (
          <div className="space-y-4">
            {estagios.map((e, idx) => (
              <div key={e.id ?? idx} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">Estágio {idx + 1}</span>
                  <button type="button" onClick={() => removeEstagio(idx)} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <CampoInput label="Código unid. curricular" value={str(e.codigo_unidade_curricular)} onChange={(v) => mudaEstagio(idx, "codigo_unidade_curricular", v)} />
                  <CampoInput label="CH (hora-relógio)" value={str(e.ch_hora_relogio)} onChange={(v) => mudaEstagio(idx, "ch_hora_relogio", v)} tipo="number" />
                  <CampoInput label="Data início" value={str(e.data_inicio)} onChange={(v) => mudaEstagio(idx, "data_inicio", v)} tipo="date" />
                  <CampoInput label="Data fim" value={str(e.data_fim)} onChange={(v) => mudaEstagio(idx, "data_fim", v)} tipo="date" />
                </div>
                <Separador label="Concedente" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <CampoInput label="CNPJ" value={str(e.concedente_cnpj)} onChange={(v) => mudaEstagio(idx, "concedente_cnpj", v)} placeholder="14 dígitos" />
                  <CampoInput label="Razão social" value={str(e.concedente_razao_social)} onChange={(v) => mudaEstagio(idx, "concedente_razao_social", v)} />
                  <CampoInput label="Nome fantasia" value={str(e.concedente_nome_fantasia)} onChange={(v) => mudaEstagio(idx, "concedente_nome_fantasia", v)} />
                </div>
                <CampoInput label="Descrição" value={str(e.descricao)} onChange={(v) => mudaEstagio(idx, "descricao", v)} placeholder="Descrição do estágio" />
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addEstagio} className="mt-3 flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors">
          <Plus size={12} /> Adicionar estágio não-obrigatório
        </button>
      </Secao>

      {/* ─────────────── SEÇÃO 9: ASSINANTES DO DIPLOMA (somente leitura) ── */}
      <Secao
        titulo="Assinantes do Diploma"
        icone={<Award size={18} />}
        aberta={secoes.assinantes ?? false}
        onToggle={() => toggle("assinantes")}
        cor="violet"
      >
        {assinantes.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-4">
            <Settings size={16} className="mt-0.5 shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Nenhum assinante configurado
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Os assinantes são configurados em{" "}
                <span className="font-semibold text-violet-600 dark:text-violet-400">
                  Configurações → Módulo Diploma
                </span>
                . Eles serão preenchidos automaticamente ao criar o processo.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-3">
              {assinantes.map((a, idx) => (
                <div key={a.id ?? idx} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 px-4 py-3">
                  <Award size={14} className="shrink-0 text-violet-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {a.nome ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      CPF: {a.cpf ?? "—"} · Cargo: {CARGO_ASSINANTE_OPTIONS.find((o) => o.valor === a.cargo)?.label ?? a.cargo ?? "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Settings size={11} />
              Para alterar os assinantes, acesse{" "}
              <span className="font-semibold text-violet-600 dark:text-violet-400 ml-1">
                Configurações → Módulo Diploma
              </span>
            </p>
          </>
        )}
      </Secao>

      {/* ─────────────── SEÇÃO 10: HABILITAÇÕES ─────────────── */}
      <Secao
        titulo="Habilitações"
        icone={<Settings size={18} />}
        aberta={secoes.habilitacoes ?? false}
        onToggle={() => toggle("habilitacoes")}
        cor="teal"
      >
        {habilitacoes.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
            Nenhuma habilitação adicionada. Cursos com habilitações específicas devem listá-las aqui.
          </p>
        ) : (
          <div className="space-y-3">
            {habilitacoes.map((h, idx) => (
              <div key={h.id ?? idx} className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <CampoInput label="Nome da habilitação" value={str(h.nome)} onChange={(v) => mudaHabilitacao(idx, "nome", v)} obrigatorio destaque />
                  <CampoInput label="Data" value={str(h.data)} onChange={(v) => mudaHabilitacao(idx, "data", v)} tipo="date" />
                </div>
                <button type="button" onClick={() => removeHabilitacao(idx)} className="mt-5 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Remover habilitação">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addHabilitacao} className="mt-3 flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
          <Plus size={12} /> Adicionar habilitação
        </button>
      </Secao>

      {/* ─────────────── SEÇÃO 11: DECISÃO JUDICIAL ─────────────── */}
      <Secao
        titulo="Decisão Judicial"
        icone={<Gavel size={18} />}
        aberta={secoes.decisao_judicial ?? false}
        onToggle={() => toggle("decisao_judicial")}
        cor="rose"
      >
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Diploma emitido por decisão judicial?
          </label>
          <button
            type="button"
            onClick={() => mudaTop("decisao_judicial", !dados.decisao_judicial)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              dados.decisao_judicial
                ? "bg-rose-500"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                dados.decisao_judicial ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-xs text-gray-500">{dados.decisao_judicial ? "Sim" : "Não"}</span>
        </div>
        {dados.decisao_judicial && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CampoInput label="Número do processo" value={str(dados.dj_numero_processo)} onChange={(v) => mudaTop("dj_numero_processo", v || null)} obrigatorio destaque placeholder="Ex: 0001234-56.2024.8.12.0001" />
              <CampoInput label="Nome do juiz" value={str(dados.dj_nome_juiz)} onChange={(v) => mudaTop("dj_nome_juiz", v || null)} obrigatorio destaque />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Decisão <span className="text-red-500">*</span>
              </label>
              <textarea
                value={str(dados.dj_decisao)}
                onChange={(e) => mudaTop("dj_decisao", e.target.value || null)}
                rows={3}
                placeholder="Texto da decisão judicial"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Declarações adicionais
              </label>
              <textarea
                value={str(dados.dj_declaracoes)}
                onChange={(e) => mudaTop("dj_declaracoes", e.target.value || null)}
                rows={2}
                placeholder="Declarações complementares (opcional)"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        )}
      </Secao>
    </div>
  )
}
