/**
 * Snapshot Imutável do Diploma
 *
 * Decisão arquitetural aprovada em 2026-04-22 (Fase 0.6):
 *
 *   Os artefatos oficiais do diploma (Histórico PDF, Termos, XMLs MEC, RVDD)
 *   são gerados a partir de um SNAPSHOT IMUTÁVEL dos dados extraídos e
 *   confirmados na Fase 1 (Extração). Tabelas normalizadas (`diplomados`,
 *   `cursos`, `diploma_disciplinas`) servem apenas para busca/relacionamento —
 *   NÃO são fonte dos documentos oficiais.
 *
 * Estados:
 *   - `rascunho` (dados_snapshot_travado = false) → editável com justificativa
 *   - `travado`  (dados_snapshot_travado = true)  → imutável permanentemente
 *
 * Trava por ação manual: "Confirmar e liberar assinaturas" (não automática).
 *
 * Após travado, os 2 fluxos BRy (XAdES para XMLs, HUB Signer para PDFs) leem
 * do mesmo snapshot, garantindo consistência entre artefatos.
 */

import { randomUUID } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// Tipos do Snapshot (formato canônico v1)
// ═══════════════════════════════════════════════════════════════════════════

export interface SnapshotDiplomado {
  nome: string
  nome_social?: string | null
  cpf: string
  rg_numero?: string | null
  rg_orgao?: string | null
  rg_uf?: string | null
  data_nascimento?: string | null // YYYY-MM-DD
  sexo?: string | null
  nacionalidade?: string | null
  naturalidade_municipio?: string | null
  naturalidade_uf?: string | null
  matricula?: string | null
  email?: string | null
}

export interface SnapshotCurso {
  nome: string
  grau?: string | null
  titulo_conferido?: string | null
  modalidade?: string | null
  carga_horaria_total?: number | null
  tipo_reconhecimento?: string | null
  numero_reconhecimento?: string | null
  data_reconhecimento?: string | null
  dou_reconhecimento?: string | null
  tipo_renovacao?: string | null
  numero_renovacao?: string | null
  data_renovacao?: string | null
}

export interface SnapshotDadosAcademicos {
  turno?: string | null
  periodo_letivo?: string | null
  data_ingresso?: string | null
  data_conclusao?: string | null
  data_colacao_grau?: string | null
  data_expedicao?: string | null
  forma_acesso?: string | null
  situacao_aluno?: string | null
  carga_horaria_integralizada?: number | null
  data_vestibular?: string | null
}

export interface SnapshotDisciplina {
  codigo?: string | null
  nome: string
  periodo?: string | null
  carga_horaria_aula?: number | null
  carga_horaria_relogio?: number | null
  nota?: string | null
  nota_ate_cem?: string | null
  conceito?: string | null
  conceito_rm?: string | null
  conceito_especifico?: string | null
  situacao?: string | null
  forma_integralizacao?: string | null
  etiqueta?: string | null
  docente_nome?: string | null
  docente_titulacao?: string | null
  ordem: number
}

export interface SnapshotAtividadeComplementar {
  descricao: string
  tipo?: string | null
  carga_horaria_relogio?: number | null
  data_inicio?: string | null
  data_fim?: string | null
}

export interface SnapshotEstagio {
  empresa?: string | null
  descricao?: string | null
  carga_horaria?: number | null
  data_inicio?: string | null
  data_fim?: string | null
}

export interface SnapshotAssinante {
  nome: string
  cargo: string
  cpf?: string | null
  email?: string | null
  ordem?: number
}

export interface SnapshotRegistro {
  numero_registro?: string | null
  livro?: string | null
  folha?: string | null
  processo?: string | null
  data_registro?: string | null
}

export interface DadosSnapshot {
  versao: 1
  snapshot_id: string // uuid gerado no builder (útil pra rastreio)
  extracao_sessao_id?: string | null
  processo_id?: string | null
  gerado_em: string // ISO-8601

  diplomado: SnapshotDiplomado
  curso: SnapshotCurso
  dados_academicos: SnapshotDadosAcademicos
  disciplinas: SnapshotDisciplina[]
  atividades_complementares: SnapshotAtividadeComplementar[]
  estagios: SnapshotEstagio[]
  enade?: { situacao?: string | null } | null
  assinantes: SnapshotAssinante[]
  registro?: SnapshotRegistro | null

  ies_emissora?: {
    nome?: string | null
    cnpj?: string | null
    codigo_mec?: string | null
    municipio?: string | null
    uf?: string | null
  } | null
  ies_registradora?: {
    nome?: string | null
    cnpj?: string | null
    codigo_mec?: string | null
  } | null
}

// ═══════════════════════════════════════════════════════════════════════════
// Input cru para o builder (dados vindos de `processos_emissao` ou equivalente)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formato aceito pelo builder. Representa o "super-payload" do POST /api/processos
 * ou equivalente — todos os campos de diplomado/curso/dados acadêmicos/disciplinas.
 *
 * Usa `any` nas listas internas porque o builder normaliza cada campo.
 */
export interface SnapshotBuilderInput {
  processo_id?: string | null
  extracao_sessao_id?: string | null

  diplomado: Record<string, any>
  curso?: Record<string, any> | null
  dados_academicos?: Record<string, any> | null
  disciplinas?: any[]
  atividades_complementares?: any[]
  estagios?: any[]
  enade?: { situacao?: string | null } | null
  assinantes?: any[]

  ies_emissora?: Record<string, any> | null
  ies_registradora?: Record<string, any> | null
}

// ═══════════════════════════════════════════════════════════════════════════
// Builder — monta um DadosSnapshot canônico a partir de input cru
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Constrói um snapshot canônico versão 1 a partir dos dados confirmados
 * na extração (pós-revisão humana).
 *
 * Normaliza campos (trim, null vs empty string, ordenação das disciplinas).
 * NÃO faz validação de negócio — quem chama já garante dados válidos.
 */
export function montarSnapshotExtracao(input: SnapshotBuilderInput): DadosSnapshot {
  const d = input.diplomado ?? {}
  const c = input.curso ?? {}
  const da = input.dados_academicos ?? {}

  return {
    versao: 1,
    snapshot_id: randomUUID(),
    extracao_sessao_id: input.extracao_sessao_id ?? null,
    processo_id: input.processo_id ?? null,
    gerado_em: new Date().toISOString(),

    diplomado: {
      nome: trimOrEmpty(d.nome),
      nome_social: nullOrTrim(d.nome_social),
      cpf: trimOrEmpty(d.cpf),
      rg_numero: nullOrTrim(d.rg_numero ?? d.rg),
      rg_orgao: nullOrTrim(d.rg_orgao_expedidor ?? d.rg_orgao),
      rg_uf: nullOrTrim(d.rg_uf),
      data_nascimento: nullOrTrim(d.data_nascimento),
      sexo: nullOrTrim(d.sexo),
      nacionalidade: nullOrTrim(d.nacionalidade),
      naturalidade_municipio: nullOrTrim(d.naturalidade_municipio ?? d.naturalidade),
      naturalidade_uf: nullOrTrim(d.naturalidade_uf),
      matricula: nullOrTrim(d.matricula ?? d.ra),
      email: nullOrTrim(d.email),
    },

    curso: {
      nome: trimOrEmpty(c.nome),
      grau: nullOrTrim(c.grau),
      titulo_conferido: nullOrTrim(c.titulo_conferido),
      modalidade: nullOrTrim(c.modalidade),
      carga_horaria_total: nullOrInt(c.carga_horaria_total),
      tipo_reconhecimento: nullOrTrim(c.tipo_reconhecimento),
      numero_reconhecimento: nullOrTrim(c.numero_reconhecimento),
      data_reconhecimento: nullOrTrim(c.data_reconhecimento),
      dou_reconhecimento: nullOrTrim(c.dou_reconhecimento),
      tipo_renovacao: nullOrTrim(c.tipo_renovacao),
      numero_renovacao: nullOrTrim(c.numero_renovacao),
      data_renovacao: nullOrTrim(c.data_renovacao),
    },

    dados_academicos: {
      turno: nullOrTrim(da.turno),
      periodo_letivo: nullOrTrim(da.periodo_letivo),
      data_ingresso: nullOrTrim(da.data_ingresso),
      data_conclusao: nullOrTrim(da.data_conclusao),
      data_colacao_grau: nullOrTrim(da.data_colacao_grau ?? da.data_colacao),
      data_expedicao: nullOrTrim(da.data_expedicao),
      forma_acesso: nullOrTrim(da.forma_acesso ?? da.forma_ingresso),
      situacao_aluno: nullOrTrim(da.situacao_aluno) ?? 'Formado',
      carga_horaria_integralizada: nullOrInt(da.carga_horaria_integralizada),
      data_vestibular: nullOrTrim(da.data_vestibular),
    },

    disciplinas: (input.disciplinas ?? []).map((raw: any, idx: number): SnapshotDisciplina => ({
      codigo: nullOrTrim(raw.codigo),
      nome: trimOrEmpty(raw.nome),
      periodo: nullOrTrim(raw.periodo),
      carga_horaria_aula: nullOrInt(raw.carga_horaria_aula ?? raw.carga_horaria),
      carga_horaria_relogio: nullOrInt(raw.carga_horaria_relogio ?? raw.ch_hora_relogio),
      nota: nullOrTrim(String(raw.nota ?? '')),
      nota_ate_cem: nullOrTrim(String(raw.nota_ate_cem ?? raw.nota_ate_100 ?? '')),
      conceito: nullOrTrim(raw.conceito),
      conceito_rm: nullOrTrim(raw.conceito_rm),
      conceito_especifico: nullOrTrim(raw.conceito_especifico),
      situacao: nullOrTrim(raw.situacao) ?? 'aprovado',
      forma_integralizacao: nullOrTrim(raw.forma_integralizacao ?? raw.forma_integralizada),
      etiqueta: nullOrTrim(raw.etiqueta),
      docente_nome: nullOrTrim(raw.docente_nome ?? raw.nome_docente),
      docente_titulacao: nullOrTrim(raw.docente_titulacao ?? raw.titulacao_docente),
      ordem: Number(raw.ordem ?? idx + 1),
    })),

    atividades_complementares: (input.atividades_complementares ?? []).map((raw: any): SnapshotAtividadeComplementar => ({
      descricao: trimOrEmpty(raw.descricao ?? raw.nome),
      tipo: nullOrTrim(raw.tipo),
      carga_horaria_relogio: nullOrInt(raw.carga_horaria_relogio ?? raw.carga_horaria),
      data_inicio: nullOrTrim(raw.data_inicio),
      data_fim: nullOrTrim(raw.data_fim),
    })),

    estagios: (input.estagios ?? []).map((raw: any): SnapshotEstagio => ({
      empresa: nullOrTrim(raw.empresa),
      descricao: nullOrTrim(raw.descricao),
      carga_horaria: nullOrInt(raw.carga_horaria),
      data_inicio: nullOrTrim(raw.data_inicio),
      data_fim: nullOrTrim(raw.data_fim),
    })),

    enade: input.enade
      ? { situacao: nullOrTrim(input.enade.situacao) }
      : null,

    assinantes: (input.assinantes ?? []).map((raw: any, idx: number): SnapshotAssinante => ({
      nome: trimOrEmpty(raw.nome),
      cargo: trimOrEmpty(raw.cargo ?? raw.outro_cargo ?? ''),
      cpf: nullOrTrim(raw.cpf),
      email: nullOrTrim(raw.email),
      ordem: Number(raw.ordem ?? idx + 1),
    })),

    registro: null, // Preenchido depois (etapa de Registro)

    ies_emissora: input.ies_emissora
      ? {
          nome: nullOrTrim(input.ies_emissora.nome),
          cnpj: nullOrTrim(input.ies_emissora.cnpj),
          codigo_mec: nullOrTrim(input.ies_emissora.codigo_mec),
          municipio: nullOrTrim(input.ies_emissora.municipio),
          uf: nullOrTrim(input.ies_emissora.uf),
        }
      : null,

    ies_registradora: input.ies_registradora
      ? {
          nome: nullOrTrim(input.ies_registradora.nome),
          cnpj: nullOrTrim(input.ies_registradora.cnpj),
          codigo_mec: nullOrTrim(input.ies_registradora.codigo_mec),
        }
      : null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers de snapshot diff (para auditoria de edições)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compara dois snapshots e retorna apenas os campos que mudaram no formato
 * { "path.to.field": { antes, depois }, ... }.
 * Usa dot-notation com `[idx]` em arrays.
 */
export function diffSnapshots(
  antes: DadosSnapshot | null,
  depois: DadosSnapshot,
): Record<string, { antes: unknown; depois: unknown }> {
  const diff: Record<string, { antes: unknown; depois: unknown }> = {}
  if (!antes) {
    diff['__snapshot_criado'] = { antes: null, depois: depois.snapshot_id }
    return diff
  }
  walkDiff(antes as any, depois as any, '', diff)
  return diff
}

function walkDiff(
  a: any,
  b: any,
  path: string,
  out: Record<string, { antes: unknown; depois: unknown }>,
) {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    out[path] = { antes: a, depois: b }
    return
  }
  if (a === null || b === null || typeof a !== 'object') {
    if (a !== b) out[path] = { antes: a, depois: b }
    return
  }
  if (Array.isArray(a)) {
    const max = Math.max(a.length, b.length)
    for (let i = 0; i < max; i++) {
      walkDiff(a[i], b[i], `${path}[${i}]`, out)
    }
    return
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    // Ignora metadados internos — não são dados do diploma
    if (path === '' && (k === 'gerado_em' || k === 'snapshot_id' || k === 'versao')) continue
    walkDiff(a[k], b[k], path ? `${path}.${k}` : k, out)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Verificações de estado
// ═══════════════════════════════════════════════════════════════════════════

/** Um diploma pode ter seu snapshot editado? Regra: existe snapshot + não travado. */
export function podeEditarSnapshot(diploma: {
  dados_snapshot_extracao?: unknown
  dados_snapshot_travado?: boolean | null
}): boolean {
  return Boolean(diploma.dados_snapshot_extracao) && !diploma.dados_snapshot_travado
}

/** O snapshot está travado (imutável)? */
export function snapshotEstaTravado(diploma: {
  dados_snapshot_travado?: boolean | null
}): boolean {
  return diploma.dados_snapshot_travado === true
}

// ═══════════════════════════════════════════════════════════════════════════
// Apply patches — edita um snapshot aplicando patches em dot-notation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aplica um objeto de patches { "path.to.field": novoValor } sobre um snapshot
 * e retorna o novo snapshot (não-mutativo). Dot-notation suporta `[idx]` em arrays.
 *
 * Campos desconhecidos são IGNORADOS (não cria novos paths).
 */
export function aplicarPatches(
  base: DadosSnapshot,
  patches: Record<string, unknown>,
): DadosSnapshot {
  const clone = deepClone(base)
  for (const [path, value] of Object.entries(patches)) {
    setByPath(clone as any, path, value)
  }
  // Metadados do snapshot sempre atualizam em edição
  clone.gerado_em = new Date().toISOString()
  return clone
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function setByPath(root: any, path: string, value: unknown) {
  const tokens = parsePath(path)
  let ref: any = root
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i]
    if (ref[t] == null) return // não cria paths novos — ignora
    ref = ref[t]
  }
  const last = tokens[tokens.length - 1]
  // Só sobrescreve se o campo já existe (evita injetar campos fora do schema)
  if (ref && Object.prototype.hasOwnProperty.call(ref, last)) {
    ref[last] = value
  }
}

/** Parse "a.b[2].c" em ["a","b",2,"c"] */
function parsePath(path: string): (string | number)[] {
  const tokens: (string | number)[] = []
  const re = /([^.[\]]+)|\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(path)) !== null) {
    if (m[1]) tokens.push(m[1])
    else if (m[2]) tokens.push(parseInt(m[2], 10))
  }
  return tokens
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers internos
// ═══════════════════════════════════════════════════════════════════════════

function trimOrEmpty(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function nullOrTrim(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function nullOrInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number.parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}
